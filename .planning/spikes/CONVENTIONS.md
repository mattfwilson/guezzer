# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow
these unless the question requires otherwise.

## Stack

- **In-app aesthetic/perf spikes** (Idea A) run inside the real Vite app behind a
  query flag (`?depth=1`), uncommitted, between `// ─── SPIKE` markers — see 001.
- **Standalone feasibility spikes** (Idea B) run as a throwaway static demo under
  the spike dir: a single `index.html` + plain-ESM `app.js` + any vendored lib,
  served with `npx serve <dir> -l <port>`. No bundler, no build step. Used for 002–004.

## Structure

- `.planning/spikes/NNN-name/` per spike; shared demos live in the lowest-numbered
  spike dir and are referenced by the others (002 hosts the demo for 003 + 004).
- Secrets & vendored blobs are gitignored per-spike (`app/config.local.js`,
  `app/supabase.umd.js`, `seed/.env`). A committed `config.example.js` documents shape.
- `serve` picks a random high port if the requested one is taken (5200 is the app's
  Vite dev server) — don't assume the port; read it back.

## Patterns

- **Supabase multi-user (validated 002–004):**
  - Auth = pre-made **email/password** accounts, created via the GoTrue admin API
    (`POST /auth/v1/admin/users`, `email_confirm:true`) with a dependency-free
    Node `fetch` seed script. Service key via env only, never committed.
  - Client uses the **vendored UMD** `@supabase/supabase-js` v2 (global `supabase`)
    so a static page boots **offline** — required to test session persistence.
  - Session restore: `getSession()` (sync from localStorage) + `onAuthStateChange`.
    Unexpired token boots offline with no network.
  - Durable shared state → Postgres table + RLS (**read-all to `authenticated`,
    write-own via `auth.uid() = user_id`**) + `postgres_changes` subscription
    (added to the `supabase_realtime` publication).
  - Ephemeral activity → Realtime **Presence** (who's online) + **Broadcast**
    (waves/pings) on one channel. Never persisted. Keep this split.
- **Remote device testing:** `serve` (no host-check) + `cloudflared tunnel --url
  http://localhost:PORT` gives an HTTPS `trycloudflare.com` link — no
  `--http-host-header` needed (that was a Vite-only workaround). Netlify Drop of
  the static folder is the durable alternative.

## Tools & Libraries

- `@supabase/supabase-js` v2 (v2.91+) — vendored UMD for spikes.
- Node ≥ 24 (native `fetch`, native `.ts`/`.mjs` execution) for seed scripts.
- `cloudflared` 2026.7.x installed at `C:\Program Files (x86)\cloudflared\` (winget
  `Cloudflare.cloudflared`); may need a fresh terminal to land on PATH.
- Avoid: `npx untun` (did not run headless here); Vite for standalone static spikes
  (host-check + no offline-boot benefit vs a vendored lib + `serve`).
