---
phase: 20-presence-interactions
plan: 05
subsystem: verification
tags: [uat, two-device, presence, realtime, waves, human-verify]
type: execute

# Dependency graph
requires:
  - phase: 20-presence-interactions
    plan: 04
    provides: "Live presence dots + activity labels on Friends, ReactionPalette entry points, offline dot-hide"
provides: "On-device confirmation that PRES-01/02/03/05/07 hold live across two real devices"

requirements: [PRES-01, PRES-02, PRES-05, PRES-07]
verdict: pass
---

# 20-05 — Two-Device Live Presence + Wave UAT

## Result: PASS (owner-verified, 2026-07-24)

Owner ran the full six-step two-device script over the HTTPS cloudflared tunnel
(`vite preview` on :4173 + `cloudflared --url http://localhost:4173 --http-host-header localhost`,
per MEMORY `device-uat-hosting`) against the production build (`packages/app/dist`,
SW precache 40 entries). Two distinct seeded Phase-18 identities signed in on two
devices. **All six checks passed.**

| # | Check | Requirement | Verdict |
|---|-------|-------------|---------|
| 1 | Present-now dots appear on connect, disappear on disconnect (no stale-green) | PRES-01 | ✅ |
| 2 | Live coarse activity updates across devices, incl. `At a show 🎸` | PRES-04 | ✅ (see caveat) |
| 3 | Broadcast + targeted waves land correctly; third-party target excluded | PRES-02/05 | ✅ |
| 4 | Burst of waves reads as distinct one-at-a-time pops, never blocks a tap | D-10 | ✅ |
| 5 | Offline device hides friend dots + reads `offline`; reconnect restores | PRES-01/D-16/17 | ✅ |
| 6 | Nothing persisted — no missed-wave replay, no last-seen | PRES-03 | ✅ |

## Regression backstop

- Full automated suite green before the device gate: **124 files / 947 tests** (`npm test`, incl. the core-purity guard).
- `npx tsc -p packages/app --noEmit` → exit 0.
- Production build succeeded (`npm run build --workspace packages/app`).

## Caveat — follow-up bug (does NOT block this gate)

The owner judged check #2 a **pass** overall (cross-device coarse activity does
propagate, and `At a show 🎸` was confirmed), but observed that **on a mobile
observer device the friend's current-tab activity label updates inconsistently —
it does not always refresh promptly. The same observation on desktop behaves as
intended.** This is a runtime-robustness issue on the read path, not a missing
implementation (the derivation + reduce + read hooks are unit-proven in 20-01/03/04).

Captured as a tracked bug for a dedicated debug/research pass:
`.planning/todos/pending/2026-07-24-bug-mobile-friend-activity-inconsistent-updates.md`.
It is deliberately **not** filed as a Phase-20 verification gap — the owner
confirmed PRES-04 works — but as an independent robustness bug to investigate and fix.

## Notes

- No code changed in this plan (verification-only gate, per the plan contract).
- Ephemeral tunnel URL was torn down after the run (both preview + cloudflared stopped).
