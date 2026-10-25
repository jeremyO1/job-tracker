import time

from fastapi import Header, HTTPException

from .db import get_db

# token -> (user_id, expires_at). Avoids a round-trip to Supabase on every request.
_cache: dict[str, tuple[str, float]] = {}
_TTL = 300


async def current_user_id(authorization: str = Header(default="")) -> str:
    """Resolve the Supabase access token sent by the frontend to a user id.

    The old backend trusted whatever user_id the browser sent, so anyone could
    sync or delete another user's data. Now the token is verified with Supabase.
    """
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "Missing access token")

    cached = _cache.get(token)
    if cached and cached[1] > time.time():
        return cached[0]

    db = await get_db()
    try:
        res = await db.auth.get_user(token)
    except Exception:
        raise HTTPException(401, "Invalid or expired session")
    if not res or not res.user:
        raise HTTPException(401, "Invalid or expired session")

    _cache[token] = (res.user.id, time.time() + _TTL)
    return res.user.id
