# Spike Manifest

Index of all spikes in this directory. Grouped by idea.

## Idea A — Constellation depth/volume

Add a genuine sense of **depth/volume** to the GizzVerse constellation while
keeping the current 2D `react-force-graph-2d` structure (no 3D/three.js migration).
Research surfaced a "depth stack": Tier-1 (spherical shading, playCount
depth-scaling, occlusion draw-order, depth-weighted edges) + #5 nebula parallax on
`onZoom`. Governing constraint (from `force-graph` source): `autoPauseRedraw` means
depth must be baked-in or interaction-driven — never continuous per-frame — to
respect EXPL-06 low-power.

### Requirements (Idea A)

- Stay 2D `react-force-graph-2d` — no three.js (bundle/one-thumb/battery).
- Depth must be **baked-in or interaction-driven** (no continuous canvas repaint;
  `autoPauseRedraw` must keep pausing at rest).
- Color helpers must handle BOTH `#hex` and `rgb(...)` inputs (spike bug #1).
- The real build must **depth-shade the unseen grayscale path**, not just
  hex/caught nodes (spike finding #2) — the dex overlay is ON by default.
- All real-build tunables in `config.explore` (single-config ethos).

## Idea B — Multi-user Supabase foundation

Give the ~5-friend group **distinct identities and lightweight awareness of each
other** in the Gizz With Friends PWA, without going "full live." Spike a Supabase
backend (auth + Postgres + Realtime) covering: (1) log in as 1 of 5 pre-made
accounts → distinct identity that survives reload, incl. offline boot; (2) synced
progress friends can see live; (3) a simple in-app interaction (presence + wave).
Explicitly **revises the current "no backend / no accounts" hard constraints** in
CLAUDE.md. Frontend stays a static PWA; Supabase is a new hosted dependency.
Throwaway standalone demo (not wired into the real app).

### Requirements (Idea B) — tracked as spikes confirm them

- Frontend stays a **static PWA**; Supabase is a hosted dependency, no server we run.
- Auth = **pre-made email/password** accounts (hand out 5 credentials), created via
  the GoTrue admin API (`email_confirm:true`) — no email-confirmation step.
- Session must **survive offline boot** (unexpired token restored from localStorage
  with no network) — non-negotiable given the offline-first core value.
- **Read-all / write-own** via RLS for shared progress; ephemeral activity
  (presence, waves) rides Realtime, never persisted.
- Core module stays pure/DOM-free — all auth/networking lives in the app layer.
- Secrets: `anon` key + project URL in gitignored local config; `service_role`
  key only ever via env in the seed script, never committed.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | constellation-depth-shading | standard | Spherical shading + playCount depth-scaling reads as volume AND stays smooth at 264 nodes | PARTIAL ⚠ | explore, constellation, canvas, depth |
| 002 | supabase-auth-identity | standard | 5 pre-made accounts log in with distinct identity; session persists incl. offline boot | VALIDATED ✓ | supabase, auth, identity, offline |
| 003 | synced-progress | standard | User A bumps progress → user B sees it live; RLS read-all/write-own | VALIDATED ✓ | supabase, realtime, postgres-changes, rls |
| 004 | presence-and-ping | standard | Live "who's online" + a wave the recipient receives | VALIDATED ✓ | supabase, realtime, presence, broadcast |
