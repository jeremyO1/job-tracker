# Vestigo – Job Tracker

Connect Gmail and Vestigo builds a board of your job applications automatically: it reads
new emails, works out which ones are about your applications, and tracks each one from
"applied" to "offer". Interview times and assessment deadlines go on a calendar.

A demo mode with sample data lets anyone try every screen without an account.

**Stack:** React 19 + Vite + Tailwind 4 · FastAPI · Supabase (Postgres + Auth) · OpenAI · Gmail API

```
frontend/   React app (reads data directly from Supabase, protected by row-level security)
backend/    FastAPI: Gmail OAuth, background sync, AI extraction, deletes
supabase/   SQL migrations
```

## How a sync works

1. Ask Gmail only for messages newer than the last sync (`after:` query, paginated).
2. Fetch sender/subject/preview for those messages concurrently.
3. A small model (`gpt-5-nano`) screens them in batches of 40 and keeps only job-related ones.
4. For those, fetch the full body and extract company, role, stage, outcome and any
   interview time with `gpt-5-mini` (structured JSON output), in parallel.
5. Match each email to an existing application by Gmail thread, then by normalised company
   name; update it or create a new one, and store the email on its timeline.

The sync runs as a background job; the frontend polls `/api/sync` for progress.

## Running locally

**One-off database step:** run `supabase/migrations/001_gmail_threading.sql` in the
Supabase SQL editor. It only adds columns/indexes, so the old app keeps working.

```bash
# backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env             # fill in the values
uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
npm install
cp .env.example .env
npm run dev                      # http://localhost:5173
```

The Google OAuth client in `GOOGLE_CLIENT_ID` must list
`http://localhost:8000/api/gmail/callback` as an authorised redirect URI
(desktop-type clients accept any localhost redirect).

## Deploying

* **Frontend** → Vercel or Netlify. Set the three `VITE_*` variables. Add a rewrite of all
  paths to `/index.html` (client-side routing).
* **Backend** → Render, Railway or Fly.io. Start command:
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set the variables from
  `backend/.env.example`, with `BACKEND_URL`, `FRONTEND_URL` and `CORS_ORIGINS` set to the
  deployed URLs. Run a single instance (sync progress is kept in memory).
* **Google Cloud:** use a *Web application* OAuth client and add
  `https://<backend>/api/gmail/callback` as a redirect URI.
* **Supabase → Authentication → URL configuration:** set the Site URL to the frontend URL
  and add `https://<frontend>/**` to the redirect URLs.

### Gmail access for other people

`gmail.readonly` is a Google *restricted* scope. While the OAuth app is in **Testing**
mode, only accounts added as test users (max 100) can connect Gmail, and their access
expires after 7 days. Opening it to everyone requires Google's verification plus a yearly
third-party security assessment. Signing in to Vestigo itself (Google or email/password)
is not affected, and the demo needs neither.
