-- Durable shared-progress foundation (SETUP-01 / D-01/D-02/D-03/D-04).
-- Source: adapted from the VALIDATED spike schema
-- (.planning/spikes/002-supabase-multiuser/seed/schema.sql) with the D-01 columns
-- (drops `songs_caught`; adds the single `summary jsonb` payload column).
--
-- One row per user, keyed by auth.users(id). Everyone signed in can READ every
-- row (the "see each other's progress" feature); you can only WRITE your own (RLS).
-- Plain one-shot DDL — a tracked migration runs exactly once, so no
-- `if not exists` / `drop policy` guards are needed.

create table public.progress (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  display_name text        not null,
  updated_at   timestamptz not null default now(),
  summary      jsonb       -- whole Option-B payload (D-01); Phase 19 shapes it, no later migration
);

alter table public.progress enable row level security;

-- D-02: read-all to authenticated (NOT anon).
create policy "read all progress"
  on public.progress for select
  to authenticated
  using (true);

-- D-02: insert only your own row.
create policy "insert own progress"
  on public.progress for insert
  to authenticated
  with check (auth.uid() = user_id);

-- D-02: update only your own row (using + with check).
create policy "update own progress"
  on public.progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- D-03: REQUIRED — without this, postgres_changes silently never fires (blueprint gotcha).
alter publication supabase_realtime add table public.progress;
