# Phase 12: Data Safety & Integrity - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 11 (9 modified, 2 new)
**Analogs found:** 11 / 11 (this is a bug-fix cluster on existing files — most "analogs" are the edit site's own sibling code or an in-repo idiom to mirror)

## Orientation

This phase edits EXISTING files. The root causes, files, and line numbers are already
locked in CONTEXT.md and verified in RESEARCH.md. The only genuinely NEW code is:
1. a `triggerDownload()` helper in `packages/app` (SAFE-02, D-07), and
2. an app-level `BackupToast` overlay + emitter seam (SAFE-03, D-05), and
3. (recommended) a shared `attendance-key.ts` pure-core module (SAFE-04 dedup-the-duplication).

For each, the closest in-repo analog and the concrete excerpt to mirror are below.

## File Classification

| File | New/Mod | Role | Data Flow | Closest Analog | Match |
|------|---------|------|-----------|----------------|-------|
| `packages/core/src/data-safety/merge.ts` | modify | core / pure-transform | batch / transform | its own `attendanceGroupKey` (L58) + `derive-dex.ts` twin | self / exact |
| `packages/core/src/dex/derive-dex.ts` | modify | core / pure-transform | batch / transform | its own `attendanceGroupKey` (L71) + `merge.ts` twin | self / exact |
| `packages/core/src/data-safety/attendance-key.ts` | **new (optional)** | core / utility (pure helper) | transform | `serialize.ts` / `merge.ts` pure-module header idiom | role-match |
| `packages/app/src/show/EndShowDialog.tsx` | modify | app / component (dialog) | event → async | its own `handleConfirm` (L82) + `useEffect` async-guard (L57-76) | self / exact |
| `packages/app/src/App.tsx` | modify | app / provider (overlay host) | event-driven | `<UpdateToast/>` sibling in the L81-83 overlay stack | exact |
| `packages/app/src/components/BackupToast.tsx` | **new** | app / component (toast) | event-driven / pub-sub | `components/UpdateToast.tsx` | exact |
| `packages/app/src/settings/triggerDownload.ts` | **new** | app / utility (browser I/O) | file-I/O | anchor idiom in `exportDownload.ts` L50-61 + `shareCard.ts` L275-291 | exact |
| `packages/app/src/settings/exportDownload.ts` | modify | app / service (DB→file) | file-I/O | consumes new `triggerDownload`; keep never-throw wrap | self |
| `packages/app/src/dex/shareCard.ts` | modify | app / service (canvas→file) | file-I/O | consumes new `triggerDownload` in the fallback branch (L274-288) | self |
| `packages/app/src/config.ts` | modify | app / config | — | `dataSafety.SCHEMA_VERSION` constant (L286-295) | exact |
| Tests (4) | modify/new | test | — | see Test Analogs section | exact |

---

## Pattern Assignments

### `packages/core/src/data-safety/merge.ts` + `packages/core/src/dex/derive-dex.ts` (SAFE-04)

**The change (Mechanism A, per RESEARCH):** key the UNBOUND branch by
`date:${date}#${sessionId}` so every unbound session is its own attendance. The
`id:${showId}` branch is UNTOUCHED (preserves every show_id join + online multi-device
dedup). Retro `attendedShows` always pass a non-null showId, so `sessionId` is only
consulted on the unbound branch.

**Current `merge.ts` L57-60** (edit site — signature takes a `show` object):
```typescript
/** Stable grouping key for same-show dedupe (D-11): bound → by show_id, unbound → by date. */
function attendanceGroupKey(show: ExportEnvelope["trackedShows"][number]): string {
  return show.showId != null ? `id:${show.showId}` : `date:${show.date}`;
}
```

**Current `derive-dex.ts` L70-73** (edit site — signature takes `(showId, date)`):
```typescript
/** Stable grouping key for tracked∪retro dedupe (D-11): bound → by show_id, unbound → by date. */
function attendanceGroupKey(showId: number | null, date: string): string {
  return showId != null ? `id:${showId}` : `date:${date}`;
}
```

**Recommended shared-module form** (kills the duplication, matches D-07's own logic —
new file `packages/core/src/data-safety/attendance-key.ts`):
```typescript
export function attendanceKey(showId: number | null, date: string, sessionId: string): string {
  return showId != null ? `id:${showId}` : `date:${date}#${sessionId}`;
}
```
- `merge.ts` call sites currently pass a `show` object → adapt to `attendanceKey(show.showId, show.date, show.sessionId)`.
- `derive-dex.ts` currently calls `attendanceGroupKey(showId, date)` at two sites:
  - retro (L137): `attendanceKey(attended.show_id, attended.showDate, /* unused */ "")` — showId non-null so sessionId ignored.
  - tracked (L141): `attendanceKey(tracked.showId, tracked.date, tracked.sessionId)`.

**D-03 join safety — DO NOT change the grouping mechanics** (`derive-dex.ts` L126-166):
archive setlists attach STRICTLY by `group.showIds` (L157-160), and an unbound tracked
show never adds to `showIds` (guard at L142 `if (tracked.showId != null)`). So splitting
the unbound key cannot drop an archive join — an unbound-only group draws sightings purely
from `trackedSightingsBySession` (L162-166). This code path stays byte-for-byte; only the
key string changes.
```typescript
for (const tracked of snapshot.trackedShows) {
  const group = ensureGroup(attendanceGroupKey(tracked.showId, tracked.date), tracked.date);
  if (tracked.showId != null) group.showIds.add(tracked.showId);   // ← unbound adds NOTHING to showIds
  group.sessionIds.add(tracked.sessionId);
}
```

**Merge-side ripple:** the Step-5 dedupe/adoption (L174-275) and `addedShows`/`addedSongs`
metrics (L291-300) both key off `attendanceGroupKey`. With Mechanism A, two unbound
same-date shows get distinct keys → the `if (bucket.length === 1) continue;` fast-path
(L243) fires → both survive, no song-union collapse. Unifying the function keeps metrics
consistent automatically. Do NOT alter Step-5's bound-group logic.

---

### `packages/app/src/show/EndShowDialog.tsx` (SAFE-01 + SAFE-03)

**Analog:** the file's own `handleConfirm` (L82-87) and its existing async-effect guard
(L57-76) — mirror the `void (async () => { ... })()` + `cancelled` pattern for the
post-close await if not lifting to App.

**Current buggy `handleConfirm` (L82-87):**
```typescript
const handleConfirm = () => {
  void endShow(sessionId);
  void exportBackup(); // D-13 auto-backup — never-throws, fire-and-forget
  onEnded?.(sessionId); // D-13 recap seam (06-09) — AFTER finalize + backup
  onClose();
};
```

**Target sequence (D-04/D-05 — from RESEARCH §SAFE-01):**
```typescript
const handleConfirm = async () => {
  await endShow(sessionId);           // SAFE-01: commit finalize BEFORE snapshot
  onEnded?.(sessionId);               // recap may open in parallel (no confirmation)
  onClose();                          // dialog closes immediately (D-05)
  const { ok } = await exportBackup(); // snapshot now reads a finalized show
  if (ok) showBackupToast();          // SAFE-03: fire app-level emitter, NOT dialog state
};
```
Note: because the dialog unmounts on `onClose`, the toast trigger must be a module-level
emitter (see BackupToast below), never `setState` on this component. `exportBackup` never
throws (`{ ok: boolean }`), so making `handleConfirm` async is safe (RESEARCH §SAFE-01 seam note).

**Remove (SAFE-03) — the static CircleCheck markup at L108-112:**
```jsx
{/* D-13 auto-backup nudge — muted, non-blocking, not a per-show nag. */}
<p className="mt-3 flex items-center gap-2 text-base leading-normal text-text-muted">
  <CircleCheck size={16} className="shrink-0" />
  <span>{settingsCopy.endShowBackupConfirmation}</span>
</p>
```
Also drop the now-unused `CircleCheck` import (L23) if no other use remains (`ShieldAlert`
at L118 stays — the persist-warning block is unrelated).

---

### `packages/app/src/components/BackupToast.tsx` (SAFE-03, NEW) + `App.tsx` host

**Analog:** `packages/app/src/components/UpdateToast.tsx` (mirror it almost exactly) and
the `App.tsx` overlay stack at L81-83.

**UpdateToast pattern to mirror** (`UpdateToast.tsx` L18-58) — fixed bottom overlay,
`role="status"`, `config.ui.z.toast` z-tier, `useBottomOverlayHeightRegistration`, renders
null until triggered:
```tsx
export function UpdateToast() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  const ref = useBottomOverlayHeightRegistration("updateToast", needRefresh);
  if (!needRefresh) return null;
  const { text, cta, dismiss } = config.copy.updateToast;
  return (
    <div ref={ref} role="status"
      className="fixed inset-x-0 bottom-16 flex items-center justify-between gap-3 border-t border-hairline bg-elevated px-4 py-4 motion-safe:transition-all motion-safe:duration-200"
      style={{ zIndex: config.ui.z.toast, paddingBottom: "env(safe-area-inset-bottom)" }}>
      ...
    </div>
  );
}
```
**BackupToast differences:** trigger source is a module-level emitter (not `useRegisterSW`),
auto-dismisses on a timer instead of a CTA, and reuses existing copy
`config.copy.settings.endShowBackupConfirmation` = "Backup saved to your downloads." (or
`exportSuccess` = "Backup saved." — do NOT add new copy; verified in `config.ts` ~L760-777).
Register its height under a new key e.g. `"backupToast"`.

**Emitter seam** (RESEARCH Open Question 1 — recommend module-level emitter): a tiny
`let listener; export function showBackupToast(){...}; export function subscribeBackupToast(fn){...}`
in the BackupToast module, subscribed via `useEffect` inside `<BackupToast/>`. This is the
least-invasive option that survives the recap swap.

**`App.tsx` host — add a sibling in the existing overlay stack (L81-83):**
```tsx
<InstallBanner />
<UpdateToast />
<BackupToast />        {/* ← add: app-level, survives the ShowView→RecapView swap */}
<AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
```
CRITICAL (RESEARCH §SAFE-03 landmine): the toast MUST be app-level because confirming End
Show makes `ShowView` early-return `<RecapView>` (ShowView.tsx L272-276), unmounting the
dialog's whole subtree. A toast owned by the dialog or ShowView's main tree would never render.

---

### `packages/app/src/settings/triggerDownload.ts` (SAFE-02, NEW helper) + consumers

**Analog:** the duplicated anchor idiom in `exportDownload.ts` L50-61 and `shareCard.ts`
L275-291 — the helper IS the deduplication of these two.

**Current same-tick-revoke bug (`exportDownload.ts` L50-61):**
```typescript
try {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `guezzer-backup-${backupDateStamp()}.json`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
} finally {
  // Always release the object URL, even if the click threw.
  URL.revokeObjectURL(url);     // ← SAME-TICK revoke aborts iOS download
}
```
**Identical bug in `shareCard.ts` L275-291** (Web-Share fallback branch — same `finally { URL.revokeObjectURL(url) }`).

**Target helper (D-06/D-07 — deferred revoke, ONE place):**
```typescript
// packages/app/src/settings/triggerDownload.ts  (browser-only → app, NOT core)
import { config } from "../config.ts";

/** Anchor-download a Blob/File and defer the object-URL revoke so iOS Safari
 *  has time to start the download (SAFE-02). Never same-tick revoke. */
export function triggerDownload(data: Blob | File, filename: string): void {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS);
}
```
**Consumers adopt it:**
- `exportDownload.ts`: replace the inner `try/finally` (L50-61) with
  `triggerDownload(blob, \`guezzer-backup-${backupDateStamp()}.json\`)`. Keep the OUTER
  never-throw `try { ... } catch { return { ok: false }; }` wrapper (L36-68) intact.
- `shareCard.ts`: in `shareOrDownload`'s fallback branch, replace the `try/finally`
  (L276-287) with `triggerDownload(file, file.name)`. Keep the surrounding never-throw
  `try/catch → { ok, method }` contract.
- `previewUrl` (shareCard.ts L234): DO NOT touch — RESEARCH verified it is already released
  by `ShareCardSheet` effect cleanup (not a leak). Optionally leave a one-line comment so a
  reviewer doesn't "fix" a non-bug.

---

### `packages/app/src/config.ts` (SAFE-02 constant, D-06)

**Analog:** the existing `dataSafety.SCHEMA_VERSION` constant (L286-295) — add the new
delay constant alongside it in the SAME `dataSafety` block.
```typescript
/** Phase-5 data-safety tunables (05-UI-SPEC §Config surface). */
dataSafety: {
  SCHEMA_VERSION: 2,
  /** Deferred object-URL revoke delay (SAFE-02): long enough for iOS Safari to
   *  begin the anchor download before the URL is freed. Config-tunable; verified
   *  on-device during SAFE-02 UAT. 1000–10000 ms is the safe band. */
  OBJECT_URL_REVOKE_DELAY_MS: 5000,
},
```
Keep this app-only (no core mirror needed — it's a browser-timing constant).

---

## Shared Patterns

### Never-throw browser-call idiom
**Source:** `packages/app/src/settings/exportDownload.ts` L35-68 (mirrors `pwa/persist.ts`)
**Apply to:** `exportBackup`, `shareOrDownload` — the `{ ok: boolean }` contract stays; the
SAFE-01/03 confirmation keys off the REAL resolved `ok`. Wrap browser calls so a failure
surfaces as `{ ok: false }`, never breaking the finalize flow.
```typescript
export async function exportBackup(): Promise<{ ok: boolean }> {
  try { /* ...assemble + triggerDownload... */ return { ok: true }; }
  catch { return { ok: false }; }
}
```

### Pure core module header (for the optional `attendance-key.ts`)
**Source:** `merge.ts` L1-22 / `derive-dex.ts` L1-12 headers — "Zero DOM, zero db.ts
dependency — Node-testable (CLAUDE.md)." A new shared helper is pure, erasable-syntax-only,
imports no React/DOM.

### App-level overlay stack
**Source:** `App.tsx` L81-83 — persistent overlays (`InstallBanner`, `UpdateToast`) sit as
siblings ABOVE the route switch, so they outlive any single view. Add `BackupToast` here.

### Config single-source constants
**Source:** `config.ts` `dataSafety` block — all tunables in one file, no scattered magic
numbers (CLAUDE.md). The revoke delay belongs here.

---

## Test Analogs

### SAFE-04 core unit tests
- **Fixture factories:** `packages/core/test/fixtures/dex/synthetic.ts` (L24-60) —
  override-spread `Partial<...>` factory idiom (`trackedShow`, `attendedShow`, `dexSnapshot`,
  `trackedEntry`). `merge.test.ts` L46-84 has the parallel `show()` / `entry()` / `rawExport()`
  factories.
- **`merge.test.ts` L246-266** — REWRITE "collapses two unbound shows sharing a date to ONE
  attendance" → "keeps two unbound same-date shows as TWO attendances" (`toHaveLength(2)`).
  RETAIN the bound-dedup case at L216-244 (`show_id` 999 → ONE) unchanged.
- **`derive-dex.test.ts` L91-107** — REWRITE "dedupes two unbound tracked nights on the same
  date — ONE attendance" → assert `showCount === 2`. RETAIN the bound-dedup case at L75-89
  (same `show_id` → `showCount === 1`) unchanged.
- These two rewrites are INTENTIONAL inversions (D-01), NOT regressions — a plan-checker must
  not restore the old collapse assertions.

### SAFE-01/03 component test
- **`packages/app/test/endShowDialog.test.tsx`** (whole file, 68 lines) — existing pattern:
  `vi.mock("../src/db/db.ts", () => ({ endShow: ... }))` (L12-14), render + `fireEvent.click`
  the confirm button, assert `endShowMock` calls.
- EXTEND: the mock currently exports ONLY `endShow`. Add `exportBackup` mock, make the click
  `await`ed (`handleConfirm` is now async), assert finalize-before-snapshot ORDER and
  toast-only-on-`{ok:true}`. Watch Pitfall 4 (RESEARCH): an unmocked `snapshot` would throw
  into the never-throw catch and mask ordering.

### SAFE-02 helper test (NEW)
- **`packages/app/test/triggerDownload.test.tsx`** — no direct analog; use Vitest fake timers
  (`vi.useFakeTimers()`), call `triggerDownload`, assert `URL.revokeObjectURL` is NOT called
  on the click tick and IS called only after advancing `config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS`.

## No Analog Found

None. Every change either edits an existing site or mirrors a verified in-repo idiom
(`UpdateToast` for the toast, `exportDownload`/`shareCard` anchor for the helper,
`SCHEMA_VERSION` for the config constant, `synthetic.ts`/`merge.test.ts` factories for tests).
The `triggerDownload.test.tsx` fake-timer structure is the only piece with no direct
in-repo precedent, and that is standard Vitest.

## Metadata

**Analog search scope:** `packages/core/src/{data-safety,dex}`, `packages/app/src/{show,settings,dex,components}`, `packages/app/src/config.ts`, `packages/app/src/App.tsx`, `packages/core/test/**`, `packages/app/test/**`
**Files scanned:** ~15
**Pattern extraction date:** 2026-07-19

## PATTERN MAPPING COMPLETE

**Phase:** 12 - Data Safety & Integrity
**Files classified:** 11 (9 modify, 2 new + 1 optional shared core module)
**Analogs found:** 11 / 11

### Coverage
- Files with exact analog: 10
- Files with role-match analog: 1 (optional `attendance-key.ts` shared helper)
- Files with no analog: 0

### Key Patterns Identified
- SAFE-04 changes ONLY the unbound branch of the two `attendanceGroupKey` twins to `date:${date}#${sessionId}`; the archive join (by `showIds`) is provably untouched — recommend unifying into one pure core module to kill the drift.
- SAFE-01/03 target sequence is `await endShow → onEnded → onClose → await exportBackup → (ok) showBackupToast`; the toast MUST be app-level (`<BackupToast/>` sibling of `<UpdateToast/>`) to survive ShowView's recap early-return.
- SAFE-02 centralizes the duplicated anchor idiom into one `triggerDownload()` with a deferred `setTimeout` revoke driven by a new `config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS`.

### File Created
`.planning/phases/12-data-safety-integrity/12-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. The planner can reference each analog file + line range directly in PLAN.md action steps.
