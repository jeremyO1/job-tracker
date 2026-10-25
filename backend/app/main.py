import logging
from urllib.parse import urlencode

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from . import db, gmail, sync
from .auth import current_user_id
from .config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(title="Job Tracker API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"ok": True}


# --- Gmail connection ---------------------------------------------------------

@app.get("/api/gmail/connect")
async def gmail_connect(user_id: str = Depends(current_user_id)):
    """Return the Google consent URL; the frontend navigates the browser there.

    The old version ran a local OAuth server on the backend machine, which only
    worked when backend and browser were the same computer.
    """
    return {"url": gmail.authorization_url(user_id)}


@app.get("/api/gmail/callback")
async def gmail_callback(code: str | None = None, state: str = "", error: str | None = None):
    back = f"{settings.frontend_url}/settings"
    user_id = gmail.read_state(state) if state else None
    if error or not code or not user_id:
        return RedirectResponse(f"{back}?{urlencode({'gmail': 'error', 'reason': error or 'invalid_state'})}")
    try:
        account = await gmail.exchange_code(code)
    except Exception:
        logging.exception("Gmail token exchange failed")
        return RedirectResponse(f"{back}?gmail=error&reason=exchange_failed")
    await db.upsert_account(user_id, account["email"], account["access_token"], account["refresh_token"], account["expiry"])
    return RedirectResponse(f"{back}?{urlencode({'gmail': 'connected', 'email': account['email']})}")


@app.get("/api/gmail/accounts")
async def gmail_accounts(user_id: str = Depends(current_user_id)):
    # Tokens never leave the backend.
    return [
        {"id": a["id"], "email": a["connected_email"], "last_synced": a["last_timestamp"]}
        for a in await db.list_accounts(user_id)
    ]


@app.delete("/api/gmail/accounts/{account_id}")
async def gmail_disconnect(account_id: int, user_id: str = Depends(current_user_id)):
    if not await db.delete_account(account_id, user_id):
        raise HTTPException(404, "Account not found")
    return {"ok": True}


# --- Sync -----------------------------------------------------------------------

@app.post("/api/sync")
async def start_sync(user_id: str = Depends(current_user_id)):
    return sync.start(user_id)


@app.get("/api/sync")
async def sync_status(user_id: str = Depends(current_user_id)):
    return sync.get_status(user_id)


# --- Applications ---------------------------------------------------------------

@app.delete("/api/applications/{application_id}")
async def delete_application(application_id: str, user_id: str = Depends(current_user_id)):
    if not await db.delete_application(application_id, user_id):
        raise HTTPException(404, "Application not found")
    return {"ok": True}
