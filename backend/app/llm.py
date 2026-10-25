"""LLM calls: triage (which emails matter) and extraction (what they say).

Speed-ups over the old version:
* The old code sent every email, one at a time, to gpt-5 on the "flex" tier
  (cheaper but deliberately slow) and made a second call for interview times.
* Now a small model screens emails in batches from sender/subject/snippet, and
  only job-related ones get a full extraction call, run concurrently, with
  interview timings extracted in the same call.
* Structured outputs guarantee valid JSON, replacing string slicing + eval().
"""
import asyncio
import json
from datetime import date

from openai import AsyncOpenAI

from .config import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)
_sem = asyncio.Semaphore(settings.llm_concurrency)

STAGES = ["action_required", "applied", "assessment", "interview", "unsure"]
SUBSTATES = ["applied", "rejected", "accepted", "completed", "action_required", "upcoming", "deadline", "unsure"]
POSITIONS = ["FULL_TIME", "PART_TIME", "INTERN", "CONTINGENCY", "UNKNOWN"]
TRIAGE_BATCH = 40
MAX_BODY_CHARS = 8000


async def _structured(model: str, prompt: str, name: str, schema: dict, effort: str) -> dict:
    async with _sem:
        res = await client.responses.create(
            model=model,
            input=prompt,
            reasoning={"effort": effort},
            text={"format": {"type": "json_schema", "name": name, "schema": schema, "strict": True}},
        )
    return json.loads(res.output_text)


# --- Triage -------------------------------------------------------------------

TRIAGE_SCHEMA = {
    "type": "object",
    "properties": {"relevant": {"type": "array", "items": {"type": "integer"}}},
    "required": ["relevant"],
    "additionalProperties": False,
}


def _triage_prompt(emails: list[dict]) -> str:
    lines = "\n".join(
        f"[{i}] From: {e['from']} | Subject: {e['subject']} | Preview: {e['snippet'][:200]}"
        for i, e in enumerate(emails)
    )
    return f"""You screen a job seeker's inbox. Return the numbers of emails that are about one of
THEIR OWN job applications: application confirmations, rejections, offers, assessment or
interview invitations/scheduling, recruiter replies about a specific role, or notifications
that a recruiter/company sent them a message (e.g. "You have a new message" on LinkedIn/Indeed).

Do NOT include: job alerts or recommendations ("jobs you may be interested in"), newsletters,
marketing, generic career advice, or anything unrelated to job applications.
When genuinely unsure, include it.

{lines}"""


async def triage(emails: list[dict]) -> list[dict]:
    batches = [emails[i:i + TRIAGE_BATCH] for i in range(0, len(emails), TRIAGE_BATCH)]

    async def run(batch):
        out = await _structured(settings.triage_model, _triage_prompt(batch), "triage", TRIAGE_SCHEMA, "minimal")
        return [batch[i] for i in sorted(set(out["relevant"])) if 0 <= i < len(batch)]

    results = await asyncio.gather(*(run(b) for b in batches))
    return [e for batch in results for e in batch]


# --- Extraction ---------------------------------------------------------------

EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "relevant": {"type": "boolean"},
        "company": {"type": "string"},
        "job_title": {"type": "string"},
        "stage": {"type": "string", "enum": STAGES},
        "substate": {"type": "string", "enum": SUBSTATES},
        "position": {"type": "string", "enum": POSITIONS},
        "event": {
            "anyOf": [
                {
                    "type": "object",
                    "properties": {
                        "date": {"type": "string", "description": "YYYY-MM-DD"},
                        "time": {"type": ["string", "null"], "description": "HH:MM:SS+HH, e.g. 15:00:00+01"},
                        "duration_minutes": {"type": ["integer", "null"]},
                    },
                    "required": ["date", "time", "duration_minutes"],
                    "additionalProperties": False,
                },
                {"type": "null"},
            ],
        },
    },
    "required": ["relevant", "company", "job_title", "stage", "substate", "position", "event"],
    "additionalProperties": False,
}


def _extract_prompt(email: dict, known_companies: list[str]) -> str:
    return f"""You extract job-application details from an email sent to a job seeker. Today is {date.today().isoformat()}.

Set relevant=false if the email is not about one of their own applications (e.g. job alerts,
"jobs you might like" from LinkedIn/Indeed, marketing).

Companies they have already applied to: {", ".join(known_companies) or "none yet"}.
If the email refers to one of these (names may differ slightly, e.g. "Google LLC" vs "Google"),
use exactly the existing name. For recruitment agencies or job boards, give the hiring company
if it is stated, otherwise the agency.

stage (where the application is):
  applied - application submitted / acknowledged
  action_required - the candidate must do something (reply, pick interview slots, fill a form,
                    or they received a message on LinkedIn/Indeed)
  assessment - online test, coding challenge, case study, assessment centre
  interview - any interview round
  unsure - job related but the stage is unclear

substate (the latest outcome):
  applied - just an acknowledgement of the application
  rejected - "we have decided to move forward with other candidates"
  accepted - an offer was made
  completed - acknowledgement that a task/interview was completed
  action_required - the candidate needs to respond
  upcoming - an interview/assessment has been scheduled at a specific time
  deadline - an assessment must be completed by a date
  unsure - unclear

Valid combinations: applied -> applied|rejected; action_required -> action_required|completed|rejected;
assessment -> upcoming|completed|rejected|deadline; interview -> upcoming|completed|rejected.
An offer is substate "accepted" under the stage the process had reached.

event: only when substate is "upcoming" or "deadline", give the date (YYYY-MM-DD; if no year is
given, use the next occurrence after the email date), the time with UTC offset if known
(e.g. 15:00 BST -> 15:00:00+01) and the duration in minutes if stated. Otherwise null.

--- EMAIL ---
Date: {email['date_iso']}
From: {email['from']}
Subject: {email['subject']}

{email['body'][:MAX_BODY_CHARS]}"""


async def extract(email: dict, known_companies: list[str]) -> dict:
    return await _structured(
        settings.extract_model, _extract_prompt(email, known_companies), "application", EXTRACT_SCHEMA, "low"
    )
