-- GizzMap on Supabase — replaces the Cloudflare Worker relay + group-phrase
-- E2E crypto (the Phase-18 auth roster IS the group now; no join flow).
-- Mirrors the progress foundation: RLS read-all to authenticated, write-own
-- keyed by auth.users(id). Locations are readable by the project owner — an
-- accepted trade (owner decision 2026-07-30) for dropping the group phrase.
--
-- Beacons: one row per user, upserted — never a history. Staleness/TTL is
-- client-side (core stalenessTier; `gone` rows simply never render).
-- Pins: group data — ANY signed-in friend may delete any pin (the 5-friend
-- -scale simplification the relay had), which also lets clients TTL-purge.

create table public.map_beacons (
  user_id      uuid             primary key references auth.users (id) on delete cascade,
  display_name text             not null,
  lat          double precision not null,
  lng          double precision not null,
  accuracy_m   double precision,          -- null when the device didn't report one
  status       text,                      -- one-tap check-in; null when unset
  avatar       text,                      -- Gizz-set emoji; null = initial fallback
  updated_at   timestamptz      not null default now()  -- client-set from the GPS fix stamp
);

alter table public.map_beacons enable row level security;

create policy "read all beacons"
  on public.map_beacons for select
  to authenticated
  using (true);

create policy "insert own beacon"
  on public.map_beacons for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own beacon"
  on public.map_beacons for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.map_pins (
  pin_id          uuid             primary key,  -- client-minted (offline drops sync later)
  created_by      uuid             not null references auth.users (id) on delete cascade,
  created_by_name text             not null,
  label           text             not null,
  lat             double precision not null,
  lng             double precision not null,
  created_at      timestamptz      not null default now()
);

alter table public.map_pins enable row level security;

create policy "read all pins"
  on public.map_pins for select
  to authenticated
  using (true);

create policy "insert own pin"
  on public.map_pins for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Anyone signed in can remove any pin (and TTL-purge expired ones).
create policy "delete any pin"
  on public.map_pins for delete
  to authenticated
  using (true);

-- REQUIRED — without this, postgres_changes silently never fires (blueprint gotcha).
alter publication supabase_realtime add table public.map_beacons;
alter publication supabase_realtime add table public.map_pins;
