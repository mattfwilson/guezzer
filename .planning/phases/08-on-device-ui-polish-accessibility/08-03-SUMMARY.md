---
phase: 08-on-device-ui-polish-accessibility
plan: 03
subsystem: ui
tags: [react19, accessibility, focus-trap, sheet, dialog, z-index, migration, vitest]

# Dependency graph
requires:
  - phase: 08-on-device-ui-polish-accessibility
    plan: 01
    provides: shared <Sheet> primitive (modal | non-modal | fullscreen) + useFocusTrap/useDialogDismiss/inertRoot + config.ui.z tiers
provides:
  - "AppMenu rendered through <Sheet modal variant=bottom-sheet>"
  - "ShareCardSheet rendered through <Sheet modal variant=bottom-sheet>"
  - "CompareView rendered through <Sheet modal variant=fullscreen> (header X, no backdrop)"
  - "'Whose dex is this?' prompt through <Sheet modal> + initialFocusRef on the #whose-dex input"
affects: [08-04, 08-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Modal migration = wrap children only; the primitive owns backdrop/shell/z-index/focus/Escape/inert"
    - "Fullscreen <Sheet> variant exercised for the first time (CompareView): no scrim, view supplies its own header-X"
    - "initialFocusRef wires a text field to auto-focus on open without an autoFocus attribute"

key-files:
  created: []
  modified:
    - packages/app/src/components/AppMenu.tsx
    - packages/app/src/dex/ShareCardSheet.tsx
    - packages/app/src/dex/CompareView.tsx
    - packages/app/src/settings/SettingsView.tsx
    - packages/app/test/shareCard.test.tsx
    - packages/app/test/compareView.test.tsx
    - packages/app/test/settingsOwner.test.tsx

key-decisions:
  - "Added maxLength={OWNER_NAME_MAX_LENGTH} to the #whose-dex input (it was absent pre-migration) to satisfy the plan verification + T-08-07; this is a focus/UX clamp — the core schema clamp remains the security control (V5)"
  - "CompareView error/hold branch wrapped in a `flex min-h-full flex-col` div inside the fullscreen Sheet to preserve the header-on-top hold-frame layout the raw `flex flex-col` container gave"
  - "Removed each component's own `if (!open) return null` guard — the <Sheet> primitive owns the V7 closed-sheet guard"

patterns-established:
  - "Every audited A11Y-01 modal now dismisses with Escape, traps focus, and restores focus to its trigger via the single <Sheet> primitive"

requirements-completed: [A11Y-01]

# Metrics
duration: ~15min
completed: 2026-07-18
---

# Phase 8 Plan 03: Modal Migration (Menu / Share / Compare / Name-Prompt) Summary

**Migrated the remaining four audited A11Y-01 surfaces — `AppMenu`, `ShareCardSheet`, the fullscreen `CompareView`, and the inline "Whose dex is this?" prompt — onto the shared `<Sheet>` primitive, giving each Escape-dismiss, focus-trap, and focus-restore, with the name field auto-focused via `initialFocusRef` and every guarded error/build-failure branch preserved.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-18
- **Tasks:** 3
- **Files modified:** 7 (0 created, 7 modified)

## Accomplishments
- `AppMenu` now renders through `<Sheet modal variant="bottom-sheet" ariaLabel="Menu">`; the raw `z-20`, the duplicated backdrop/shell, and the local `if (!open) return null` guard are gone — the primitive owns all of it. Install/Settings row callbacks are byte-identical.
- `ShareCardSheet` migrated to `<Sheet modal variant="bottom-sheet">`; the Pitfall-7 pre-built-File-on-open behavior and the calm build-failure branch are untouched. `z-40` removed.
- `CompareView` migrated to the **fullscreen** `<Sheet>` variant (header X, NO backdrop) — the first exercise of that variant. Both `z-40` literals removed; the read-only / zero-DB-writes contract (06-10) and the loader error/hold branch are preserved intact.
- The "Whose dex is this?" prompt is now `<Sheet modal>` with `initialFocusRef={promptInputRef}` — the `#whose-dex` field focuses on open. The WARNING-1 name→restore resolution (quick 260716-vw2) and escaped-React-text rendering are unchanged.
- Added focus/Escape/guarded-branch assertions across three suites; full app suite green at **258 tests** (up from 250).

## Task Commits

Each task was committed atomically:

1. **Task 1: AppMenu → `<Sheet modal>`** - `022e29f` (feat)
2. **Task 2: ShareCardSheet (bottom-sheet) + CompareView (fullscreen) → `<Sheet>`** - `6d05313` (feat)
3. **Task 3: "Whose dex is this?" prompt → `<Sheet modal>` + initialFocusRef** - `d36eee2` (feat)

## Files Created/Modified
- `packages/app/src/components/AppMenu.tsx` — wrapped rows in `<Sheet modal>`; removed `z-20` + backdrop/shell + open-guard.
- `packages/app/src/dex/ShareCardSheet.tsx` — wrapped in `<Sheet variant="bottom-sheet">`; removed `z-40`; build-failure branch preserved.
- `packages/app/src/dex/CompareView.tsx` — both branches wrapped in `<Sheet variant="fullscreen">`; removed both `z-40`; error/hold branch preserved.
- `packages/app/src/settings/SettingsView.tsx` — prompt → `<Sheet modal initialFocusRef>`; added `promptInputRef` + `maxLength` on `#whose-dex`.
- `packages/app/test/shareCard.test.tsx` — new ShareCardSheet render describe: build-failure branch + Escape→onClose (mocks `@archive`/`@dexAlbums`).
- `packages/app/test/compareView.test.tsx` — added Escape→onClose + guarded-branch-renders-through-Sheet assertions.
- `packages/app/test/settingsOwner.test.tsx` — new prompt describe: initialFocus + maxLength, Escape→close, "It's mine" merge path, name-submit→compare path (mocks `importPicker`/`@archive`/`@dexAlbums`).

## Decisions Made
- **`maxLength` on `#whose-dex` (Rule 2 / deviation):** the plan's read_first + verification + threat register (T-08-07) all treat the `#whose-dex` input as already carrying a `maxLength={40}` clamp, but the pre-migration code had none (only the sibling owner-name field did). Added `maxLength={config.dex.OWNER_NAME_MAX_LENGTH}` (=40) to align with the plan contract. Per V5 this is a focus/UX clamp only — the core zod schema clamp remains the actual security control, so validation posture is unchanged.
- **Fullscreen inner wrapper:** CompareView's error/hold branch is wrapped in `flex min-h-full flex-col` inside the Sheet so the header stays pinned above the (optional) error copy, matching the old `flex flex-col` container. The main branch renders header + content directly (the Sheet container is already `overflow-y-auto`).
- **ariaLabel source:** used `copy.banner(friendName)` (the existing accessible name, a function) for CompareView rather than the plan's shorthand `config.copy.compare.banner`, keeping the announced name identical to pre-migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added `maxLength` to the `#whose-dex` input**
- **Found during:** Task 3
- **Issue:** The plan's verification (`maxLength={40}` still present on `#whose-dex`) and threat register T-08-07 assumed the clamp already existed, but the pre-migration input had no `maxLength` attribute.
- **Fix:** Added `maxLength={config.dex.OWNER_NAME_MAX_LENGTH}` (=40), matching the owner-name field. Focus/UX only — the schema clamp remains the security control (V5), so no validation change.
- **Files modified:** `packages/app/src/settings/SettingsView.tsx`
- **Commit:** `d36eee2`

## Threat Model Compliance
- **T-08-07 (V5, whose-dex input):** `initialFocusRef` changes focus, not validation; `maxLength={40}` clamp added + escaped-text rendering preserved verbatim. No new input surface.
- **T-08-08 (V7, guarded branches):** ShareCardSheet build-failure branch and CompareView error/hold branch both still render (asserted in their tests) — `<Sheet>` renders children as-is and keeps the `if (!open) return null` guard; no throw.
- **T-08-09 (tampering, compare/share names):** React-text-only rendering preserved; no `dangerouslySetInnerHTML` introduced.
- **T-08-SC (supply chain):** ZERO new npm packages — refactor only.

## Issues Encountered
- None blocking. jsdom emits benign "Not implemented: getContext / navigation" notices (canvas + install-prompt), consistent with the existing suite — all tests pass.

## User Setup Required
None — no external configuration; no new dependencies.

## Next Phase Readiness
- All seven audited A11Y-01 modal surfaces are now migrated (08-02 handled AppMenu-adjacent + WhyDetail/TrailNodeSheet/EndShowDialog; this plan closed ShareCardSheet, CompareView, and the name prompt). 08-04 (FilterFab lift + non-modal NodeSheet Escape/restore) and 08-05 (remaining raw `z-*` → `config.ui.z`) can proceed.
- Deferred at the primitive level (per 08-01): real Tab-order focus movement + the on-device VoiceOver/keyboard AT sweep (jsdom cannot move focus on Tab without `@testing-library/user-event`).

---
*Phase: 08-on-device-ui-polish-accessibility*
*Completed: 2026-07-18*

## Self-Check: PASSED

- All 7 modified source/test files present on disk.
- Task commits `022e29f`, `6d05313`, `d36eee2` present in git history.
- Full app suite green (258 tests); app `tsc --noEmit` exits 0; no raw `z-[0-9]` literal remains in any of the four migrated components.
