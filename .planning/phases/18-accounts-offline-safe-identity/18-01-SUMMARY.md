---
phase: 18-accounts-offline-safe-identity
plan: 01
subsystem: identity-foundation
tags: [identity, config, rebrand, pure-core, tdd]
requires: []
provides:
  - "identityColorIndex (pure-core deterministic identity→palette-index hash, barrel-exported)"
  - "config.auth.IDENTITY_COLORS (6-hue identity avatar palette)"
  - "config.copy.auth (sign-in / connect-once / reconnecting / sign-out copy)"
  - "Gizz With Friends chrome rebrand (title, manifest, install copy, share wordmark)"
affects:
  - "Phase 18 Plan 05 (header avatar), Phase 19 friend rows, Phase 20 presence dots — all reuse identityColorIndex + IDENTITY_COLORS"
tech-stack:
  added: []
  patterns:
    - "Palette-agnostic core hash: returns an index, app injects the palette (D-13)"
    - "Chrome-only rebrand discipline guarded by a DB_NAME-unchanged test (D-15)"
key-files:
  created:
    - packages/core/src/identity/color.ts
    - packages/core/test/identity/color.test.ts
    - packages/app/test/rebrand.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/app/src/config.ts
    - packages/app/index.html
    - packages/app/vite.config.ts
    - packages/app/src/dex/shareCard.ts
decisions:
  - "identityColorIndex returns an INDEX, never a color string — core stays palette-agnostic; the app injects config.auth.IDENTITY_COLORS.length (D-13)"
  - "IDENTITY_COLORS is a fresh 6-hue pastel family, deliberately NOT config.map.MEMBER_COLORS (identity avatars are their own surface)"
  - "Rebrand touched display strings only; DB_NAME/persisted keys/routes/paths unchanged, guarded by a regression test (D-15)"
  - "Extended the rebrand to iosInstall.heading (same install/CTA copy surface) — minor completeness deviation, documented below"
metrics:
  duration: ~9min
  tasks: 3
  files: 8
  completed: 2026-07-22
---

# Phase 18 Plan 01: Identity-Color Helper + Gizz With Friends Rebrand Summary

Pure-core deterministic `identityColorIndex` primitive (AUTH-07/D-13) plus the `config.auth`
palette and `config.copy.auth` strings it and later plans consume, and the chrome-only "Gizz With
Friends" rebrand of every remaining brand surface (AUTH-06/D-15/D-16) — with a test proving no
persisted key or DB name moved.

## What Was Built

**Task 1 — Pure-core `identityColorIndex` (AUTH-07 / D-13, TDD):**
`packages/core/src/identity/color.ts` exports `identityColorIndex(userId, paletteLength): number`
using the exact MapView hash idiom (`hash = (hash * 31 + charCodeAt(i)) | 0`, then
`Math.abs(hash) % paletteLength`). It returns the INDEX only — the app injects the palette, so core
stays palette-agnostic and node-testable. Barrel-exported from `@guezzer/core`. A node-env test
pins determinism, range-safety (`0 <= i < len`), non-throwing UUID handling, and exact idiom parity.
Core purity scan stays green (no DOM, no `@supabase`, no config import).

**Task 2 — `config.auth` + `config.copy.auth` (D-13/D-18/D-03/D-07):**
Added `config.auth.IDENTITY_COLORS` (`["#7DD3FC","#FDA4AF","#86EFAC","#FCD34D","#C4B5FD","#5EEAD4"]`)
beside `config.map` — a fresh pastel family decoupled from `MEMBER_COLORS`, each hue clearing
≥4.5:1 against the `#0C0C10` initials. Added `config.copy.auth` with the exact 18-UI-SPEC
Copywriting Contract strings (`signIn`, `whosHere`, `passwordPlaceholder`, `invalidCredentials`,
`forgotOwner`, `connectOnceHeading`, `connectOnceBody`, `reconnecting`, `signOut`, `signOutSubline`).

**Task 3 — "Gizz With Friends" rebrand (AUTH-06 / D-15/D-16, TDD):**
Swapped display strings on `index.html` `<title>`, `vite.config.ts` manifest `name`/`short_name`/
`description`, `config.copy.installBanner.headline`/`installCta`/`installUnavailable`/
`iosInstall.heading`, and `config.copy.share.card.wordmark`. Reduced the share-card wordmark font
68→44px so the longer mark fits the fixed 1080px card width. `rebrand.test.ts` asserts every surface
reads the rebrand AND that `config.DB_NAME === "guezzer"` (chrome-only discipline guard).

## Deviations from Plan

### Auto-added (Rule 2 — completeness within the named surface)

**1. [Rule 2] Rebranded `config.copy.iosInstall.heading` alongside the named install/CTA strings**
- **Found during:** Task 3
- **Issue:** The plan action named `installBanner.headline`/`installCta`/`installUnavailable`, but
  the iOS "Add Guezzer to your Home Screen" heading is the same install/CTA copy surface (UI-SPEC
  rebrand-table "Install / CTA copy" row) and would have read the old brand mid-flow.
- **Fix:** Swapped to "Add Gizz With Friends to your Home Screen"; also updated the `wordmarkGold`
  doc comment that named the old brand.
- **Files modified:** packages/app/src/config.ts
- **Commit:** d39497b

### Deliberately left unchanged (scope discipline, D-15)

Non-chrome / out-of-contract "Guezzer" references were intentionally NOT touched: internal code
identifiers `GuezzerDB` (db.ts) and the backup-format error strings (`"That's not a Guezzer
backup."`, `"Reopen Guezzer to try again."`, `"Your device may clear Guezzer's data."`, the
https-join hint) plus `AppMenu.tsx`'s wordmark — all outside this plan's file scope and outside the
UI-SPEC rebrand table. Flagging for a possible follow-up if a full brand sweep is later desired.

## TDD Gate Compliance

Both TDD tasks followed RED→GREEN with distinct commits:
- Task 1: `test(18-01)` 1ded14d (failing) → `feat(18-01)` fd61daa (passing)
- Task 3: `test(18-01)` 6f73faa (failing, 4/5 red) → `feat(18-01)` d39497b (passing)
No REFACTOR commits were needed (implementations were minimal and clean).

## Verification

- `npx vitest run packages/core/test/identity/color.test.ts` — green
- `npx vitest run packages/core/test/purity.test.ts` — green (core purity preserved)
- `npx vitest run packages/app/test/rebrand.test.ts` — green
- `npm test` — full suite 793 passed (104 files), no regression
- `tsc --noEmit` core + app — both clean

## Known Stubs

None — both deliverables are fully wired: `identityColorIndex` is exported and node-tested; the
config blocks hold real contract values; the rebrand strings are live. Consumer wiring (header
avatar) is Plan 05 by design, not a stub.

## Self-Check: PASSED
