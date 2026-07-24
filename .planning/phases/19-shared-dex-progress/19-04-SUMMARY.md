---
phase: 19-shared-dex-progress
plan: 04
type: execute
status: complete
requirements: [PROG-03, PROG-05]
---

# 19-04 Summary — Human/Device Verification

## What this plan was

A blocking `checkpoint:human-verify` gate — the venue-realistic behaviors a mocked-supabase
unit test cannot cover, verified across two authenticated clients against the live Supabase
project (ref yunfqfldgbgjdqzywbdy). No code was written; the output is recorded results.

## How it was verified

Two devices, each signed into a distinct seeded friend account, on the current build:
- Device A (desktop): http://localhost:5181 (Vite dev)
- Device B (phone): HTTPS cloudflared tunnel → same dev server / same live Supabase project

All five checks passed (see `19-HUMAN-UAT.md`):

1. **Live propagation (PROG-05, D-16)** — a catch on A moved A's row on B's Friends list
   live via `postgres_changes`, no manual refresh.
2. **Head-to-head (PROG-06 live)** — B tapping A's row opened the "You vs A" overlay with
   populated columns and matching numbers.
3. **Reconnect flush (D-17)** — offline marker shown; offline catches flushed + friends
   re-pulled on reconnect; B saw A's new numbers.
4. **Never-blank offline view (D-18)** — cached rows + live "You" row always present.
5. **RLS write-own (PROG-03, T-19-authz)** — an authenticated upsert of a foreign `user_id`
   was rejected server-side: HTTP 403, code `42501`,
   `new row violates row-level security policy for table "progress"`, `data: null`.

## Requirements satisfied

- PROG-03 — server-side write-own enforcement empirically confirmed against the live project.
- PROG-05 — live two-device propagation confirmed.

## Threat model dispositions confirmed

- **T-19-authz** (Tampering/Elevation) — mitigated: cross-user write rejected (step 5).
- **T-19-realtime** (DoS / silent-non-firing) — mitigated: live events fired on both the
  initial write (step 1) and the resubscribe-on-reconnect path (step 3).
- **T-19-SC** — accepted: verification-only plan, no packages installed.

## Deviations

None. Verification-only plan; no source files modified.

## Self-Check: PASSED
