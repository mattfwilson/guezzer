-- Festival schedule picks (owner request 2026-07-30): who's going to what.
-- Mirrors the progress foundation exactly: one row per user keyed by
-- auth.users(id), display_name first-class, the picks as a single jsonb
-- array of event-id slugs from the committed schedule artifact
-- (data/schedule/fov-2026.json). Everyone signed in READS every row (the
-- "who's going to the same things" feature); you WRITE only your own.
-- Clients validate event_ids at the read boundary (core sanitizeEventIds) —
-- the column is deliberately unconstrained jsonb so a newer bundled artifact
-- never needs a migration here.

create table public.schedule_picks (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  display_name text        not null,
  event_ids    jsonb       not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.schedule_picks enable row level security;

create policy "read all schedule picks"
  on public.schedule_picks for select
  to authenticated
  using (true);

create policy "insert own schedule picks"
  on public.schedule_picks for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own schedule picks"
  on public.schedule_picks for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- REQUIRED — without this, postgres_changes silently never fires (blueprint gotcha).
alter publication supabase_realtime add table public.schedule_picks;
