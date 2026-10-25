"""Gmail access over plain async HTTP.

Speed-ups over the old version:
* Gmail is asked only for messages newer than the last sync (`after:` query),
  instead of listing the inbox and fetching every message just to read its date.
* Messages are fetched concurrently instead of one request at a time.
* Only metadata + snippet is fetched for every message; the full body is
  downloaded just for the few that triage marks as job-related.
"""
import asyncio
import base64
import hashlib
import hmac
import html
import json
import time
from urllib.parse import urlencode

import httpx
from bs4 import BeautifulSoup

from .config import settings

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
API = "https://gmail.googleapis.com/gmail/v1/users/me"
REDIRECT_URI = f"{settings.backend_url}/api/gmail/callback"
STATE_TTL = 600


class GmailAuthError(Exception):
    """The stored token can't be refreshed; the user has to reconnect."""


# --- OAuth --------------------------------------------------------------------

def _sign(payload: str) -> str:
    return hmac.new(settings.state_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def make_state(user_id: str) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"u": user_id, "t": int(time.time())}).encode()).decode()
    return f"{payload}.{_sign(payload)}"


def read_state(state: str) -> str | None:
    payload, _, sig = state.partition(".")
    if not hmac.compare_digest(_sign(payload), sig):
        return None
    data = json.loads(base64.urlsafe_b64decode(payload))
    if time.time() - data["t"] > STATE_TTL:
        return None
    return data["u"]


def authorization_url(user_id: str) -> str:
    return AUTH_URL + "?" + urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent select_account",
        "state": make_state(user_id),
    })


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(TOKEN_URL, data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        res.raise_for_status()
        tokens = res.json()
        profile = await client.get(f"{API}/profile", headers={"Authorization": f"Bearer {tokens['access_token']}"})
        profile.raise_for_status()
    return {
        "email": profile.json()["emailAddress"],
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token"),
        "expiry": int(time.time()) + tokens["expires_in"],
    }


async def refresh_access_token(refresh_token: str) -> tuple[str, int]:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "grant_type": "refresh_token",
        })
    if res.status_code != 200:
        raise GmailAuthError(res.text)
    body = res.json()
    return body["access_token"], int(time.time()) + body["expires_in"]


# --- Fetching -----------------------------------------------------------------

class GmailClient:
    def __init__(self, access_token: str):
        self._http = httpx.AsyncClient(
            base_url=API,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )
        self._sem = asyncio.Semaphore(settings.gmail_concurrency)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        await self._http.aclose()

    async def _get(self, path: str, params=None) -> dict:
        async with self._sem:
            for attempt in range(4):
                res = await self._http.get(path, params=params)
                if res.status_code == 429 or res.status_code >= 500:
                    await asyncio.sleep(2 ** attempt)
                    continue
                if res.status_code == 401:
                    raise GmailAuthError("Access token rejected")
                res.raise_for_status()
                return res.json()
            res.raise_for_status()

    async def list_new_ids(self, after_ms: int, limit: int) -> list[str]:
        # Gmail's `after:` has 1-second granularity; exact filtering on internalDate happens later.
        query = f"after:{after_ms // 1000} -in:sent -in:drafts -in:chats"
        ids: list[str] = []
        page_token = None
        while len(ids) < limit:
            params = {"q": query, "maxResults": min(500, limit - len(ids))}
            if page_token:
                params["pageToken"] = page_token
            page = await self._get("/messages", params)
            ids += [m["id"] for m in page.get("messages", [])]
            page_token = page.get("nextPageToken")
            if not page_token:
                break
        return ids

    async def get_metadata(self, ids: list[str]) -> list[dict]:
        params = [("format", "metadata")] + [
            ("metadataHeaders", h) for h in ("From", "Subject", "Date", "Message-ID")
        ]
        msgs = await asyncio.gather(*(self._get(f"/messages/{i}", params) for i in ids))
        return [_summarise(m) for m in msgs]

    async def get_body(self, message_id: str) -> str:
        msg = await self._get(f"/messages/{message_id}", {"format": "full"})
        return _extract_body(msg.get("payload", {}))


def _summarise(msg: dict) -> dict:
    headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
    return {
        "id": msg["id"],
        "thread_id": msg.get("threadId"),
        "internal_date": int(msg["internalDate"]),
        "from": headers.get("from", ""),
        "subject": headers.get("subject", "(no subject)"),
        "message_id": headers.get("message-id"),
        "snippet": html.unescape(msg.get("snippet", "")),
    }


def _html_to_text(raw: str) -> str:
    soup = BeautifulSoup(raw, "html.parser")
    for tag in soup(["script", "style", "noscript", "head"]):
        tag.decompose()
    return soup.get_text("\n", strip=True)


def _decode(data: str) -> str:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", errors="ignore")


def _extract_body(payload: dict) -> str:
    """Prefer text/plain; fall back to text/html converted to text."""
    plain, rich = [], []

    def walk(part):
        mime = part.get("mimeType", "")
        data = part.get("body", {}).get("data")
        if data and "attachmentId" not in part.get("body", {}):
            if mime == "text/plain":
                plain.append(_decode(data))
            elif mime == "text/html":
                rich.append(_html_to_text(_decode(data)))
        for sub in part.get("parts", []):
            walk(sub)

    walk(payload)
    text = "\n".join(plain) if plain else "\n".join(rich)
    return text.strip()
