# Spike Wrap-Up Summary

**Date:** 2026-07-21
**Spikes processed:** 3 (002, 003, 004)
**Feature areas:** Multi-user Supabase foundation
**Skill output:** `./.claude/skills/spike-findings-guezzer/`

## Processed Spikes

| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 002 | supabase-auth-identity | standard | VALIDATED ✓ | Multi-user Supabase foundation |
| 003 | synced-progress | standard | VALIDATED ✓ | Multi-user Supabase foundation |
| 004 | presence-and-ping | standard | VALIDATED ✓ | Multi-user Supabase foundation |

_Not processed:_ 001-constellation-depth-shading (separate idea, PARTIAL — future wrap-up).

## Key Findings

- Supabase (auth + Postgres + Realtime) is a validated fit for a ~5-user layer that
  **coexists with the offline-first constraint** rather than fighting it.
- The highest-risk unknown — **session surviving an offline reload** — held up: an
  unexpired token restores synchronously from localStorage with no network.
- Architecture split confirmed: **durable state → Postgres + read-all/write-own RLS
  + `postgres_changes`**; **ephemeral activity → Realtime presence + broadcast**.
  The presence channel is the extensible path to "see what they're doing."
- Verified live across two remote devices via a Cloudflare quick tunnel to a local
  `serve` (which, unlike Vite, does no host-checking).
- Only open item: token *refresh* during long offline stretches — a UX/reconnect
  detail, not a feasibility blocker.
- **Action for the real build:** update the CLAUDE.md "no backend / no accounts"
  hard constraints; use distinct per-person passwords.

Full blueprint: `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md`.
