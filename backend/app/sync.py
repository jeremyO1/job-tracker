"""Gmail -> applications sync, run as a background job.

The old sync ran inside the HTTP request (the browser waited the whole time),
re-queried the database several times per email, and only ever synced the
first connected account. Here everything the sync needs from the database is
loaded once up front, all connected accounts are synced, and the frontend
polls a status endpoint for progress.
"""
import asyncio
import logging
import re
import time
from datetime import datetime, timezone

from . import db, llm
from .config import settings
from .gmail import GmailAuthError, GmailClient, refresh_access_token

log = logging.getLogger("sync")

# user_id -> status dict. In-memory is fine for a single backend instance.
_jobs: dict[str, dict] = {}

_SUFFIXES = re.compile(r"\b(ltd|limited|inc|llc|plc|corp|corporation|co|gmbh|llp|careers|recruiting|recruitment)\b")


def normalise_company(name: str) -> str:
    name = _SUFFIXES.sub("", name.lower())
    return re.sub(r"[^a-z0-9]+", "", name)


def get_status(user_id: str) -> dict:
    return _jobs.get(user_id, {"state": "idle"})


def start(user_id: str) -> dict:
    job = _jobs.get(user_id)
    if job and job["state"] == "running":
        return job
    job = {"state": "running", "step": "Starting", "scanned": 0, "relevant": 0,
           "added": 0, "updated": 0, "errors": [], "started_at": time.time()}
    _jobs[user_id] = job
    asyncio.create_task(_run(user_id, job))
    return job


async def _run(user_id: str, job: dict) -> None:
    try:
        await _sync_user(user_id, job)
        job["state"] = "done"
        job["step"] = "Finished"
    except Exception as e:
        log.exception("Sync failed for %s", user_id)
        job["state"] = "error"
        job["step"] = str(e)
    job["finished_at"] = time.time()


async def _sync_user(user_id: str, job: dict) -> None:
    accounts = await db.list_accounts(user_id)
    if not accounts:
        raise RuntimeError("No Gmail account connected")

    apps = await db.list_applications(user_id)
    ctx = {
        "user_id": user_id,
        "by_company": {normalise_company(a["company"] or ""): a for a in apps},
        "by_id": {a["application_id"]: a for a in apps},
    }
    app_ids = list(ctx["by_id"])
    ctx["known"], ctx["threads"] = await asyncio.gather(db.known_message_ids(app_ids), db.thread_index(app_ids))

    for account in accounts:
        try:
            await _sync_account(account, ctx, job)
        except GmailAuthError:
            job["errors"].append(f"{account['connected_email']}: access expired, please reconnect")


async def _access_token(account: dict) -> str:
    if account.get("access_token") and (account.get("expiry") or 0) > time.time() + 60:
        return account["access_token"]
    if not account.get("refresh_token") or account["refresh_token"] == "None":
        raise GmailAuthError("No refresh token")
    token, expiry = await refresh_access_token(account["refresh_token"])
    await db.update_account(account["id"], {"access_token": token, "expiry": expiry})
    return token


async def _sync_account(account: dict, ctx: dict, job: dict) -> None:
    email = account["connected_email"]
    since = account.get("last_timestamp") or int((time.time() - settings.initial_sync_days * 86400) * 1000)

    async with GmailClient(await _access_token(account)) as gmail:
        job["step"] = f"Checking {email} for new mail"
        ids = await gmail.list_new_ids(since, settings.max_emails_per_sync)
        if not ids:
            return

        job["step"] = f"Reading {len(ids)} new emails"
        metas = await gmail.get_metadata(ids)
        metas = [m for m in metas if m["internal_date"] > since]
        newest = max((m["internal_date"] for m in metas), default=since)
        metas = [m for m in metas if (m["message_id"] or m["id"]) not in ctx["known"]]
        metas.sort(key=lambda m: m["internal_date"])
        job["scanned"] += len(metas)

        job["step"] = f"Screening {len(metas)} emails for job updates"
        relevant = await llm.triage(metas) if metas else []
        job["relevant"] += len(relevant)

        job["step"] = f"Analysing {len(relevant)} job emails"
        companies = sorted({a["company"] for a in ctx["by_id"].values() if a["company"]})

        async def analyse(meta):
            meta["body"] = await gmail.get_body(meta["id"]) or meta["snippet"]
            meta["date_iso"] = datetime.fromtimestamp(meta["internal_date"] / 1000, timezone.utc).isoformat()
            try:
                return meta, await llm.extract(meta, companies)
            except Exception as e:
                log.warning("Extraction failed for %s: %s", meta["subject"], e)
                return meta, None

        results = await asyncio.gather(*(analyse(m) for m in relevant))

    # Writes stay sequential and in date order so later emails update earlier ones correctly.
    job["step"] = "Saving"
    failed = 0
    for meta, data in results:
        if data:
            await _apply(meta, data, ctx, job)
        else:
            failed += 1

    if failed:
        # Leave last_timestamp alone so the next sync retries them; saved emails are skipped by message id.
        job["errors"].append(f"{email}: {failed} emails couldn't be analysed and will be retried next sync")
        return
    await db.update_account(account["id"], {"last_timestamp": newest})


async def _apply(meta: dict, data: dict, ctx: dict, job: dict) -> None:
    if not data["relevant"] or data["stage"] == "unsure":
        return

    user_id = ctx["user_id"]
    day = meta["date_iso"][:10]
    app = ctx["by_id"].get(ctx["threads"].get(meta["thread_id"])) \
        or ctx["by_company"].get(normalise_company(data["company"]))

    if app:
        fields = {}
        if not app.get("latest_date") or day >= app["latest_date"]:
            fields["latest_date"] = day
            if data["stage"] != "unsure":
                fields["stage"] = data["stage"]
            if data["substate"] != "unsure":
                fields["substate"] = data["substate"]
        if fields:
            await db.update_application(app["application_id"], user_id, fields)
            app.update(fields)
        job["updated"] += 1
    else:
        app = await db.insert_application({
            "user_id": user_id,
            "company": data["company"],
            "job_title": data["job_title"],
            "stage": data["stage"],
            "substate": "applied" if data["substate"] == "unsure" else data["substate"],
            "position": None if data["position"] == "UNKNOWN" else data["position"],
            "applied_date": day,
            "latest_date": day,
            "email_address": meta["from"],
        })
        ctx["by_id"][app["application_id"]] = app
        ctx["by_company"][normalise_company(app["company"])] = app
        job["added"] += 1

    message_key = meta["message_id"] or meta["id"]
    await db.insert_event({
        "application_id": app["application_id"],
        "event_date": meta["date_iso"],
        "event_summary": meta["subject"],
        "email_text": meta["body"],
        "gmail_message_id": message_key,
        "gmail_thread_id": meta["thread_id"],
    })
    ctx["known"].add(message_key)
    if meta["thread_id"]:
        ctx["threads"][meta["thread_id"]] = app["application_id"]

    event = data.get("event")
    if event and data["substate"] in ("upcoming", "deadline"):
        await db.insert_calendar({
            "application_id": app["application_id"],
            "date": event["date"],
            "time": event["time"] or ("23:59:00" if data["substate"] == "deadline" else "09:00:00"),
            "duration": event["duration_minutes"],
        })
