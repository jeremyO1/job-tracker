-- Adds the columns the sync uses to group emails by Gmail thread and to avoid
-- storing the same email twice. The old code referenced these columns but they
-- were never created, so those lookups silently failed.
-- Purely additive: safe to run while the old app still uses this database.

alter table public.application_events
  add column if not exists gmail_message_id text,
  add column if not exists gmail_thread_id text;

-- One row per email. Existing rows have NULLs, which Postgres treats as distinct.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'application_events_gmail_message_id_key'
  ) then
    alter table public.application_events
      add constraint application_events_gmail_message_id_key unique (gmail_message_id);
  end if;
end $$;

create index if not exists application_events_thread_idx on public.application_events (gmail_thread_id);
create index if not exists application_events_application_idx on public.application_events (application_id);
create index if not exists calendar_application_idx on public.calendar (application_id);
create index if not exists job_applications_user_idx on public.job_applications (user_id);
