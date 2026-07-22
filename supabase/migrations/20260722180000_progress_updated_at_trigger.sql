-- WR-03 follow-up (ADDITIVE migration): auto-maintain public.progress.updated_at.
--
-- The foundation migration (20260722160617_progress_foundation.sql) sets
-- updated_at only at INSERT time (`default now()`), so it went stale on every
-- UPDATE. That migration is ALREADY applied to the hosted project and recorded
-- in the remote migration history — a tracked migration never re-runs — so this
-- fix ships as a NEW, later-timestamped migration rather than an in-place edit
-- (which would create file-vs-remote drift and never reach the database).
--
-- Written idempotently (`create or replace function` / `drop trigger if exists`)
-- so it is safe to (re-)apply. The owner applies it with `supabase db push`
-- (needs live secrets) — do NOT run db push from tooling.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists progress_set_updated_at on public.progress;

create trigger progress_set_updated_at
  before update on public.progress
  for each row
  execute function public.set_updated_at();
