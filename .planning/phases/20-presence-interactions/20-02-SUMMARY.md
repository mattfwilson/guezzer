---
phase: 20-presence-interactions
plan: 02
subsystem: ui
tags: [react, toast, module-emitter, fifo-queue, reactions, presence, sheet, tdd]

# Dependency graph
requires:
  - phase: 20-presence-interactions
    plan: 01
    provides: "config.presence (QUEUE_CAP/TOAST_MS/DRAIN_GAP_MS/EMOJIS) + config.copy.presence strings + sendWave(emoji,to) module seam"
  - phase: 19-shared-dex-progress
    provides: "getSyncState().friends trusted store + the exported IdentityGlyph + FriendRowData shape"
  - phase: 16-gizz-bingo
    provides: "BingoCelebration/BackupToast module-emitter + App-level host idiom cloned here"
provides:
  - "WaveToast.tsx — showWaveToast/subscribeWaveToast emitter + App-level host with a bounded FIFO brief-drain queue (D-10)"
  - "WaveToastPayload type ({ from; emoji; targeted })"
  - "ReactionPalette.tsx — fixed 4-chip wave-led palette + Everyone/per-friend target picker calling the shared sendWave"
affects: [reaction-toast-host, reaction-palette, app-mount, friend-detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded FIFO brief-drain queue (peek-don't-shift while showing) — the one deliberate departure from BingoCelebration's latest-wins (D-10)"
    - "Trusted-store sender resolution: name resolved from getSyncState().friends by `from` userId, never the payload (V5/T-20-02)"
    - "Thin UI shell over the shipped Sheet — no new hash route, no new z-tier, accent-RING (not fill) selection"

key-files:
  created:
    - packages/app/src/components/WaveToast.tsx
    - packages/app/src/dex/ReactionPalette.tsx
    - packages/app/test/components/WaveToast.test.tsx
  modified: []

key-decisions:
  - "UNKNOWN_SENDER fallback (\"Someone\") kept as a host-local constant, not a config.copy string — it is an internal safety label that never carries untrusted input, so it stays out of the tunable copy block"
  - "Palette send is a two-step (emoji + target) pick; initialTarget pre-selects a friend so FriendDetail needs only the emoji tap (D-07); Everyone is the top target row → to:null"

patterns-established:
  - "Module-emitter toast host cloning BingoCelebration but buffering into a bounded FIFO instead of latest-wins"

requirements-completed: [PRES-02, PRES-05, PRES-06]

# Metrics
duration: 16min
completed: 2026-07-24
---

# Phase 20 Plan 02: Presence Interactions (Wave Toast + Reaction Palette) Summary

**The two user-facing surfaces of the ephemeral interaction layer: an app-wide `WaveToast` host (module-emitter + App-level host cloning BingoCelebration, departing only at a bounded FIFO brief-drain queue that reads a flurry as distinct pops) and the `ReactionPalette` (a fixed 4-emoji wave-led send surface + Everyone/per-friend target picker) — both net-new, echoing shipped primitives without importing/altering them.**

## Performance

- **Duration:** ~16 min
- **Completed:** 2026-07-24
- **Tasks:** 2 (Task 1 TDD RED→GREEN; Task 2 a thin UI shell, plan-directed no test file)
- **Files modified:** 3 (3 created, 0 modified)

## Accomplishments

- `WaveToast.tsx`: the `showWaveToast`/`subscribeWaveToast` module emitter (verbatim BingoCelebration shape) + the App-level host. The ONE departure (D-10) is a bounded FIFO in a `useRef` that peeks-don't-shift while showing, so a burst drains one-at-a-time (each `config.presence.TOAST_MS`, `DRAIN_GAP_MS` between pops) and an over-cap emit (buffer at `config.presence.QUEUE_CAP`) is DROPPED (T-20-04) — never throws.
- Sender identity is re-resolved from the trusted `getSyncState().friends` store by `from` userId (V5/T-20-02), never the payload; an unknown `from` renders a neutral escaped fallback. Broadcast reads `{name} {emoji}`; targeted reads `{name} waved at you {emoji}` plus a `to you` mark (PRES-05). All text is escaped React text (T-20-06) — no `dangerouslySetInnerHTML`.
- Host chrome copied from BingoCelebration verbatim: `role="status"`, `pointer-events-none` at `config.ui.z.toast`, `useBottomOverlayHeightRegistration("waveToast", …)` so it never covers the live loop (D-17), `useReducedMotion()` with the opacity-only reduced path, `AnimatePresence` keyed on a monotonic id.
- `ReactionPalette.tsx`: a thin shell over the shipped `Sheet`. Fixed 4 chips mapped from the single `config.presence.EMOJIS` source (wave-led, D-05/D-06); the 🎯 chip carries the visible `caught it!` label, the other three emoji-only; each chip has an `aria-label`. Target picker lists `Everyone` (→ `to:null`) then one row per friend (→ `to:userId`) with `IdentityGlyph` + escaped `displayName`. A completed (emoji, target) pick calls the shared `sendWave(emoji, to)` once and closes; `initialTarget` pre-selects a friend (D-07). All interactive elements are `min-h-11 min-w-11` with accent-RING selection (not fill).
- 11 new unit assertions for WaveToast cover the full `<behavior>` table; the whole app suite (921 tests) stays green and `packages/app` typechecks clean.

## Task Commits

1. **Task 1 (RED): WaveToast failing test** — `1a3fa07` (test)
2. **Task 1 (GREEN): WaveToast FIFO brief-drain host** — `44d20d8` (feat)
3. **Task 2: ReactionPalette 4-chip send surface** — `8fda422` (feat)

_No REFACTOR commits needed._

## Files Created/Modified

- `packages/app/src/components/WaveToast.tsx` — module emitter + App-level host with a bounded FIFO brief-drain queue, trusted-store sender resolution, escaped text.
- `packages/app/src/dex/ReactionPalette.tsx` — fixed 4-chip wave-led palette + Everyone/per-friend target picker calling the shared `sendWave`.
- `packages/app/test/components/WaveToast.test.tsx` — full behavior table: broadcast/targeted copy, store-only sender resolution, FIFO drain cadence, over-cap drop, reduced-motion opacity-only, escaped-text no-injection.

## Decisions Made

- **`UNKNOWN_SENDER` fallback is host-local, not config copy.** The plan required a "neutral escaped fallback" for an unknown `from`. I kept it as a module-local `const UNKNOWN_SENDER = "Someone"` rather than adding to `config.copy.presence`: it is an internal safety label that never carries untrusted input, so it stays out of the user-tunable copy block and keeps Task 1 to its declared files (no `config.ts` edit). Not a deviation — a scoping choice within the plan's instruction.
- **Palette is a two-step (emoji + target) pick.** On completing the pair `sendWave` fires once and the sheet closes. `initialTarget` pre-selects a friend so the FriendDetail entry needs only the emoji tap (D-07). `Everyone` is the top target row and maps to `to:null`.

## Deviations from Plan

None — plan executed as written. (See the `UNKNOWN_SENDER` note above: a scoping choice explicitly permitted by the plan's "neutral escaped fallback" instruction, not a functional deviation.)

## TDD Gate Compliance

- **Task 1** followed the RED→GREEN cycle: a `test(20-02)` commit (`1a3fa07`) with the failing spec (module absent) preceded the `feat(20-02)` GREEN commit (`44d20d8`).
- **Task 2** is marked `tdd="true"` in the plan but the plan's `<action>` explicitly directs "No test file this task — coverage of the send path is via presenceSync.test (20-01) + friendPresence.test (20-04); keep this a thin UI shell." The `feat` commit therefore has no preceding `test` commit by plan design; verification is the typecheck gate, which passes. This is plan-directed, not a gate violation.

## Threat Register Coverage

All `mitigate`-disposition threats assigned to this plan's files are implemented:
- **T-20-06** (XSS) — every sender/emoji/displayName renders as escaped React text; `truncate min-w-0` clamped; no `dangerouslySetInnerHTML` (grep-clean in both files); unit test asserts a markup-bearing name is not injected.
- **T-20-02** (spoofing) — sender name resolved from the trusted `getSyncState().friends`, never the payload; unknown `from` → neutral escaped fallback.
- **T-20-04** (wave-flood DoS) — bounded FIFO with `config.presence.QUEUE_CAP` + over-cap DROP; unit-tested.
- **T-20-09** (tap-blocking DoS) — host is `pointer-events-none` at `config.ui.z.toast` and height-registered so it never covers the live loop.
- **T-20-SC** (installs) — no new dependencies added.

## Verification

- `npm test -- --run packages/app/test/components/WaveToast.test.tsx` → 11/11 green.
- `npx tsc -p packages/app --noEmit` → exits 0.
- Full app suite → 121 files / 921 tests green.
- Manual grep: no `dangerouslySetInnerHTML` in either new file.

## Next Phase Readiness

- The receive path (`showWaveToast` + the `<WaveToast/>` host) and the send path (`<ReactionPalette/>` → `sendWave`) are ready to wire: the host mounts once in `App.tsx` (D-11) and the palette opens from the Friends-header "React" entry + a pre-targeted FriendDetail button — those mount/entry-point wirings are the remaining phase-20 plans (20-03/20-04).
- Both components are pure consumers of the 20-01 contracts (`config.presence`, `config.copy.presence`, `sendWave`, the presence store) — no reverse coupling introduced.

## Self-Check: PASSED

All 3 created files + the SUMMARY exist on disk; all 4 commits (`1a3fa07`, `44d20d8`, `8fda422`, `3ca7e6c`) are in git history. `dangerouslySetInnerHTML` appears in both new files ONLY inside documentation comments asserting it is never used — no actual JSX prop usage (verified). Worktree clean.
