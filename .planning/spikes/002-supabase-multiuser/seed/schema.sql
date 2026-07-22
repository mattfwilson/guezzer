-- ── Spike schema: shared friend progress ────────────────────────────────────
-- Paste this whole file into the Supabase dashboard → SQL Editor → Run.
-- One row per user. Everyone can READ everyone's row (that's the "see each
-- other's progress" feature); you can only WRITE your own (RLS).

create table if not exists public.progress (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  display_name text        not null,
  songs_caught integer     not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.progress enable row level security;

-- Any logged-in friend can see all rows.
drop policy if exists "read all progress" on public.progress;
create policy "read all progress"
  on public.progress for select
  to authenticated
  using (true);

-- You may create only your own row.
drop policy if exists "insert own progress" on public.progress;
create policy "insert own progress"
  on public.progress for insert
  to authenticated
  with check (auth.uid() = user_id);

-- You may update only your own row.
drop policy if exists "update own progress" on public.progress;
create policy "update own progress"
  on public.progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Stream row changes to subscribed clients (postgres_changes / spike 003).
alter publication supabase_realtime add table public.progress;
