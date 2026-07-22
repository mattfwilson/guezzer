---
spike: 002
name: supabase-auth-identity
type: standard
validates: "Given 5 pre-made email/password accounts, when a user logs in and reloads (including offline boot), then the app shows their distinct identity and the session persists"
verdict: VALIDATED
related: [003, 004]
tags: [supabase, auth, identity, multi-user, offline, pwa, throwaway]
---

# Spike 002: Supabase Auth / Identity

Foundation spike for a Supabase-backed multi-user layer. Highest-risk of the
three because it collides with the app's core value — **offline-first**. Supabase
auth for 5 people is trivially feasible; the real unknown is whether a session
*survives a reload in a dead-signal venue*.

This spike's demo is **shared** by spikes 003 (synced progress) and 004
(presence + wave) — one page, one Supabase project.

## What This Validates

Given the 5 pre-made accounts (`gizz1`…`gizz5`), when a user logs in on their
phone/browser and reloads — **including with the network killed** — then the app
boots straight to their own distinct identity without a round-trip, and only a
`signOut()` returns them to the login screen.

## Research

- **Library:** `@supabase/supabase-js` v2 (v2.91+ current as of 2026-07). Vendored
  as a local UMD bundle (`app/supabase.umd.js`, gitignored) so the demo page boots
  with **no network** — required to honestly test offline session restore.
- **Auth API:** `signInWithPassword({email,password})`, `getSession()` (sync read
  from localStorage), `onAuthStateChange()`, `signOut()`.
- **Offline behavior (the key question):** supabase-js persists the session in
  `localStorage` and restores it **synchronously**, so an *unexpired* access token
  is readable with no network. Token *refresh* needs the network, but boot-time
  identity does not. This is the property the spike must confirm on-device.
- **Accounts:** created via the GoTrue admin API (`POST /auth/v1/admin/users`,
  `email_confirm:true`) so there's no email-confirmation step. See `seed/`.

| Approach | How | Verdict |
|----------|-----|---------|
| Pre-made email/password + admin seed | `signInWithPassword` + `admin/users` | **Chosen** — matches "hand out 5 credentials" exactly |
| Magic-link / OTP email | passwordless | Rejected — needs a mail step at a venue with bad signal |
| Anonymous + client name-picker | no server trust | Rejected — gives no real identity, throwaway toward the real build |

## How To Run

**One-time setup**
1. Create a free Supabase project → **Project Settings → API**; copy the Project
   URL, the `anon` key, and the `service_role` key.
2. **SQL Editor** → paste and run `seed/schema.sql` (creates the `progress` table
   + RLS + realtime).
3. Seed the accounts (service key via env — never committed):
   ```powershell
   $env:SUPABASE_URL="https://xxxx.supabase.co"
   $env:SUPABASE_SERVICE_KEY="eyJ...service_role..."
   node seed/seed-users.mjs
   ```
4. In `app/`, copy `config.example.js` → `config.local.js` and paste the Project
   URL + `anon` key.

**Serve the demo** (static; served locally so offline boot is testable)
```powershell
# If app/supabase.umd.js is missing (it's gitignored), re-vendor it first:
#   curl -sSL -o app/supabase.umd.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js
npx serve .planning/spikes/002-supabase-multiuser/app -l 5200
```
Open `http://localhost:5200`. To try it as two users, open a second **incognito**
window (or a phone on the LAN) and log in as a different `gizz#`.

## What To Expect

- **Identity:** log in as `gizz1@gizz.local` / `gizzpass1` → header shows
  "Signed in as **gizz1**". Log in as `gizz2` elsewhere → that window shows gizz2.
- **Session persistence:** reload → you stay logged in as the same identity, no
  re-login.
- **Offline boot (the crux):** with a session active, open DevTools → Network →
  **Offline**, then reload. The page (local assets) loads, the `online/offline`
  chip flips to **offline**, and you still boot as your identity. Only **Log out**
  clears it.

## Investigation Trail

1. Built the shared demo (`app/`): vendored UMD lib, `config.local.js` indirection,
   login card with `gizz1..5` quick-pick, `onAuthStateChange` + `getSession()`
   boot restore.
2. Parse-checked `app.js` (ESM) and `seed/seed-users.mjs` — both clean.
3. Seed script written dependency-free against the GoTrue admin REST API (no
   `npm install`), idempotent on re-run.
4. Seeded 5 real accounts (`matt/max/tim/shawn/brian@fov.gizz`) via the admin API
   — all 5 returned `✓ created`, confirming the "hand out N credentials" model.
5. **Live run across two remote devices** (Matt local, Max via a Cloudflare quick
   tunnel to the local `serve`): each device showed its own distinct identity.
6. **Offline-boot crux confirmed:** DevTools → Network Offline → reload → the app
   still booted the user in as themselves; the net chip flipped to `offline`. The
   unexpired token restored synchronously from localStorage with no round-trip.

### Hosting notes discovered
- `serve` does **not** host-check (unlike Vite's `allowedHosts`), so a Cloudflare
  quick tunnel (`cloudflared tunnel --url http://localhost:PORT`) reaches it with
  no `--http-host-header` workaround. Vendoring supabase-js locally was what made
  the page boot offline at all.

## Results

**Verdict: VALIDATED ✓** — 5 pre-made email/password accounts each log in to a
distinct identity, the session persists across reload, **and it survives an
offline reload** (the one real risk). Confirmed live on two remote devices, not
just a happy-path unit check. Supabase auth is a sound fit for the offline-first
constraint. For the real build, the only open item is token-*refresh* while
offline for long stretches (an unexpired token boots fine; a very stale one will
need reconnection) — a UX detail, not a feasibility blocker.
