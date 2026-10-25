from supabase import AsyncClient, acreate_client

from .config import settings

_client: AsyncClient | None = None


async def get_db() -> AsyncClient:
    global _client
    if _client is None:
        _client = await acreate_client(settings.supabase_url, settings.supabase_service_key)
    return _client


# --- Gmail accounts ---------------------------------------------------------

async def list_accounts(user_id: str) -> list[dict]:
    db = await get_db()
    res = await (
        db.table("user_email")
        .select("id, connected_email, access_token, refresh_token, expiry, last_timestamp")
        .eq("user_id", user_id)
        .order("id")
        .execute()
    )
    return res.data


async def upsert_account(user_id: str, email: str, access_token: str, refresh_token: str | None, expiry: int) -> None:
    db = await get_db()
    existing = await (
        db.table("user_email").select("id, refresh_token")
        .eq("user_id", user_id).eq("connected_email", email).limit(1).execute()
    )
    row = {"access_token": access_token, "expiry": expiry}
    # Google only returns a refresh token on first consent; keep the old one otherwise.
    if refresh_token:
        row["refresh_token"] = refresh_token
    if existing.data:
        await db.table("user_email").update(row).eq("id", existing.data[0]["id"]).execute()
    else:
        await db.table("user_email").insert({**row, "user_id": user_id, "connected_email": email}).execute()


async def update_account(account_id: int, fields: dict) -> None:
    db = await get_db()
    await db.table("user_email").update(fields).eq("id", account_id).execute()


async def delete_account(account_id: int, user_id: str) -> bool:
    db = await get_db()
    res = await db.table("user_email").delete().eq("id", account_id).eq("user_id", user_id).execute()
    return bool(res.data)


# --- Applications -----------------------------------------------------------

async def list_applications(user_id: str) -> list[dict]:
    db = await get_db()
    res = await (
        db.table("job_applications")
        .select("application_id, company, job_title, stage, substate, latest_date")
        .eq("user_id", user_id)
        .execute()
    )
    return res.data


async def known_message_ids(application_ids: list[str]) -> set[str]:
    """Gmail Message-IDs already stored, so re-syncs never duplicate events."""
    if not application_ids:
        return set()
    db = await get_db()
    res = await (
        db.table("application_events")
        .select("gmail_message_id")
        .in_("application_id", application_ids)
        .not_.is_("gmail_message_id", "null")
        .execute()
    )
    return {r["gmail_message_id"] for r in res.data}


async def thread_index(application_ids: list[str]) -> dict[str, str]:
    """Map Gmail thread id -> application id for the user's existing events."""
    if not application_ids:
        return {}
    db = await get_db()
    res = await (
        db.table("application_events")
        .select("gmail_thread_id, application_id")
        .in_("application_id", application_ids)
        .not_.is_("gmail_thread_id", "null")
        .execute()
    )
    return {r["gmail_thread_id"]: r["application_id"] for r in res.data}


async def insert_application(row: dict) -> dict:
    db = await get_db()
    res = await db.table("job_applications").insert(row).execute()
    return res.data[0]


async def update_application(application_id: str, user_id: str, fields: dict) -> None:
    db = await get_db()
    await (
        db.table("job_applications").update(fields)
        .eq("application_id", application_id).eq("user_id", user_id).execute()
    )


async def insert_event(row: dict) -> None:
    db = await get_db()
    await db.table("application_events").upsert(row, on_conflict="gmail_message_id", ignore_duplicates=True).execute()


async def insert_calendar(row: dict) -> None:
    db = await get_db()
    await db.table("calendar").insert(row).execute()


async def delete_application(application_id: str, user_id: str) -> bool:
    db = await get_db()
    owned = await (
        db.table("job_applications").select("application_id")
        .eq("application_id", application_id).eq("user_id", user_id).limit(1).execute()
    )
    if not owned.data:
        return False
    await db.table("application_events").delete().eq("application_id", application_id).execute()
    await db.table("calendar").delete().eq("application_id", application_id).execute()
    await db.table("job_applications").delete().eq("application_id", application_id).execute()
    return True
