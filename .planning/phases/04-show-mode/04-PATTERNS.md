# Phase 4: Show Mode - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 21 new / 3 modified
**Analogs found:** 20 / 24 (4 have no direct analog — noted below)

Phase 4 is ~90% wiring over frozen Phase 2 core + the Phase 3 shell. Almost every new file has a strong in-repo analog. The genuinely new logic (`searchCatalog`, `layoutOrbs`, Dexie `version(2)`) still maps cleanly onto existing structural conventions. The one real gap: **`useLiveQuery` is not yet used anywhere in `packages/app/src`** — the app's only Dexie access today is direct `db.table.put/get` (in `db.test.ts`), so the reactive-read pattern is new-to-app and must follow the RESEARCH.md code examples rather than an existing analog.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/search/search-catalog.ts` | utility (core, pure) | transform | `packages/core/src/ingest/tuning-tags.ts` | role-match (pure core module) |
| `packages/core/src/index.ts` (MODIFY — barrel export) | config/barrel | — | `packages/core/src/index.ts` (self) | exact |
| `packages/core/test/search-catalog.test.ts` | test (node) | — | `packages/core/test/tuning-tags.test.ts` | exact |
| `packages/app/src/show/orbitLayout.ts` | utility (app, pure) | transform | `packages/core/src/model/decay.ts` (pure math fn) / `useHashRoute.ts` (pure app helper) | role-match |
| `packages/app/test/orbitLayout.test.ts` | test (jsdom) | — | `packages/app/test/platform.test.ts` | role-match (pure-fn unit test) |
| `packages/app/src/db/db.ts` (MODIFY — add `version(2)`) | model/persistence | CRUD | `packages/app/src/db/db.ts` (self — v1 + documented v2 hook) | exact |
| `packages/app/test/showSession.test.ts` | test (jsdom + fake-indexeddb) | CRUD | `packages/app/test/db.test.ts` | exact |
| `packages/app/test/tally.test.ts` | test (jsdom) | transform | `packages/core/test/tuning-tags.test.ts` (pure derivation) | role-match |
| `packages/app/test/confidence.test.ts` | test (jsdom) | transform | `packages/app/test/platform.test.ts` | role-match |
| `packages/app/src/show/showContext.ts` | utility (app, pure) | transform | `packages/core/src/ingest/tuning-tags.ts` (pure assembly) | role-match |
| `packages/app/src/show/matrix.ts` | provider/loader | file-I/O (bundled import) | *(none — new import path)* | no analog |
| `packages/app/src/show/useShowSession.ts` | hook | event-driven (reactive read) | *(none — `useLiveQuery` unused in app)* | no analog |
| `packages/app/src/config.ts` (MODIFY — add `show` + `copy.show`) | config | — | `packages/app/src/config.ts` (self) / `packages/core/src/config.ts` | exact |
| `packages/app/src/show/ShowView.tsx` | component (view root) | event-driven | `packages/app/src/App.tsx` + `PlaceholderView.tsx` | role-match |
| `packages/app/src/show/PreShowLauncher.tsx` | component | request-response | `packages/app/src/components/PlaceholderView.tsx` | role-match |
| `packages/app/src/show/OrbitStage.tsx` | component | transform (render) | `packages/app/src/components/AppShell.tsx` | role-match |
| `packages/app/src/show/CenterNode.tsx` | component | — | `packages/app/src/components/PlaceholderView.tsx` | role-match |
| `packages/app/src/show/PredictionOrb.tsx` | component | event-driven | `packages/app/src/components/BottomTabBar.tsx` (tap button) | role-match |
| `packages/app/src/show/CometTrail.tsx` | component | event-driven | `packages/app/src/components/BottomTabBar.tsx` | role-match |
| `packages/app/src/show/TallyReadout.tsx` | component | — | `packages/app/src/components/VersionStamp.tsx` | role-match |
| `packages/app/src/show/ActionBar.tsx` | component | event-driven | `packages/app/src/components/BottomTabBar.tsx` | exact (bottom-bar idiom) |
| `packages/app/src/show/SearchSheet.tsx` | component | request-response | `packages/app/src/components/AppMenu.tsx` (overlay sheet) | role-match |
| `packages/app/src/show/WhyDetail.tsx` / `WakeLockNotice.tsx` / `TrailNodeSheet.tsx` / `EndShowDialog.tsx` | component (overlays/dialogs) | event-driven | `packages/app/src/components/AppMenu.tsx` / `UpdateToast.tsx` / `IosInstallInstructions.tsx` | role-match |
| `packages/app/src/wakeLock.ts` | utility (browser API) | event-driven | `packages/app/src/pwa/persist.ts` | role-match |

> Note: I could not read `AppMenu.tsx`, `UpdateToast.tsx`, `VersionStamp.tsx`, `IosInstallInstructions.tsx`, or `persist.ts` in full this pass — they are named as overlay/dialog/browser-API analogs by role from the file listing; the executor should read them directly when building those components. The high-signal analogs (Dexie, config, tests, nav chrome, pure-core module) are extracted concretely below.

## Pattern Assignments

### `packages/app/src/db/db.ts` — MODIFY (model/persistence, CRUD) — THE critical additive migration

**Analog:** the same file. The `version(2)` hook is already documented in place — grow it, never rewrite `version(1)`.

**Existing v1 schema + additive-hook comment** (`db.ts:31-49`):
```typescript
export class GuezzerDB extends Dexie {
  meta!: Table<MetaRow, string>;
  attendedShows!: Table<AttendedShow, number>;

  constructor() {
    super(config.DB_NAME);

    // Version 1: thin-but-real schema (D-08). `&` = unique inbound primary key.
    this.version(1).stores({
      meta: "&key",
      attendedShows: "&show_id, showDate",
    });

    // Additive-migration pattern for Phase 4+ (D-08 — never rewrite version(1)):
    //   this.version(2).stores({ trackedShows: '&show_id, ...', /* only NEW/CHANGED tables */ });
    // Tables not listed in a later version().stores() call carry forward
    // unchanged automatically — do not re-declare `meta`/`attendedShows`
    // here unless their shape actually changes.
  }
}
```

**What to copy / apply (per RESEARCH Pattern 1):**
- Add the new `Table<T, K>` field declarations next to `meta`/`attendedShows` (same `!:` non-null convention).
- Append `this.version(2).stores({ trackedShows: "&sessionId, status, date", trackedEntries: "++id, sessionId, [sessionId+position]" })` AFTER the `version(1)` block. Do NOT re-declare `meta`/`attendedShows`.
- Mirror the file's existing interface-doc style (see `AttendedShow` at `db.ts:26-29`): a JSDoc block per new interface (`TrackedShow`, `TrackedEntry`) explaining the D-0x rationale.
- `SetNumber` type must mirror core's exact union `"1" | "2" | "e"` (`packages/core/src/domain/types.ts:48`). Either import from core or re-declare with a comment pointing at the core union.
- Keep helper fns (like the existing `setMeta`/`getMeta` at `db.ts:54-60`) as the model for `logSong`/`undoLast` write helpers — module-level `async` fns wrapping `db.transaction("rw", …)`.

---

### `packages/core/src/search/search-catalog.ts` — NEW (utility, pure core, transform)

**Analog:** `packages/core/src/ingest/tuning-tags.ts` — the canonical "pure, zero-DOM, exported-and-tested core module wrapping a lib" pattern.

**Module-doc + closed-vocab + type-export idiom** (`tuning-tags.ts:1-26`):
```typescript
/**
 * <module purpose>. This module is pure: it never reads/writes files itself.
 */
import { z } from "zod";
import type { NormalizedCorpus } from "../domain/types.ts";

export const tuningFamilyValues = ["standard", "cs-standard", "microtonal", "other"] as const;
export type TuningFamily = (typeof tuningFamilyValues)[number];
```

**What to copy / apply:**
- Open with a JSDoc block stating purity and DOM-freedom (fuse.js has zero DOM deps — keeps core's `"lib": ["ES2023"]`/no-React purity, mirroring how this file justifies zod).
- Import types from `../domain/types.ts` with the `.ts` extension (Node-native TS convention used throughout core — see `tuning-tags.ts:22`).
- Export the function(s) + their result/param types together (`export function …` + `export interface …` / `export type …`), exactly as `deriveCatalogFromCorpus`/`CatalogSong` are co-located here.
- Catalog source = the 264 `MatrixNode`s (each has `songId` + `songName`); no separate catalog file. See RESEARCH Pattern 4 for the concrete fuse.js config (`threshold: 0.4`, `ignoreLocation: true`, `includeScore: true`).
- Threshold/distance are tunables → add to `packages/core/src/config.ts` under a `search` key, following the `config` object idiom (`core/config.ts:9` — a single `as const` object with JSDoc-per-key).

**Barrel export** — add to `packages/core/src/index.ts` following the existing grouped-export-with-JSDoc pattern (`index.ts:50-62`, the tuning-tags block). Add a new `export { makeCatalogSearcher, toCatalog, type CatalogEntry, type SearchResult } from "./search/search-catalog.ts";` block with a rationale comment.

---

### `packages/core/test/search-catalog.test.ts` — NEW (test, node env)

**Analog:** `packages/core/test/tuning-tags.test.ts` — exact.

**Structure** (`tuning-tags.test.ts:1-40`):
```typescript
import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import { generateTuningTags, /* … */ type CatalogSong } from "../src/ingest/tuning-tags.ts";

describe("generateTuningTags", () => {
  it("Test 1: <behavioral description>", () => {
    const catalog: CatalogSong[] = [ /* small fixture */ ];
    const [entry] = generateTuningTags(catalog, albumRows);
    expect(entry).toEqual<TuningTagEntry>({ /* known expected output */ });
  });
});
```

**What to copy:** `import { describe, expect, it } from "vitest"`, `.ts` import extensions, small fixture arrays with known expected outputs (the "fixture setlists with known expected outputs" mandate from CLAUDE.md). Cover: fuzzy-matches a known song, tolerates a one-char typo, empty query → `[]` (RESEARCH VALIDATION map, SHOW-04). Runs in the `node` project automatically (it lives under `packages/core/test/`).

---

### `packages/app/src/show/orbitLayout.ts` — NEW (utility, app, pure, transform)

**Analog:** `packages/core/src/model/decay.ts` (pure exported math fn) for the shape; `useHashRoute.ts` for the "small pure app helper with an `as const` domain constant + `export function`" idiom. Concrete math is in RESEARCH Pattern 3 (`layoutOrbs`).

**What to apply:** Pure `export function layoutOrbs(candidates, stage, cfg): OrbLayout[]`. No React, no DOM reads inside (viewport px passed in as `stage`). All constants (`ORB_MIN_DIAMETER`, ring insets, count bounds) come from `config.show` — never inline literals (CLAUDE.md no-scattered-magic-numbers; the file already lives by this, see `config.ts:1-11`). Deterministic: same input → same output (SHOW-02 test contract).

---

### `packages/app/test/showSession.test.ts` — NEW (test, jsdom + fake-indexeddb)

**Analog:** `packages/app/test/db.test.ts` — exact (real Dexie under `fake-indexeddb`).

**Structure** (`db.test.ts:1-17`):
```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { db, getMeta, setMeta } from "../src/db/db.ts";

describe("db: Dexie v1 schema round-trips", () => {
  beforeEach(async () => {
    await db.attendedShows.clear();
    await db.meta.clear();
  });

  it("round-trips an attendedShows row …", async () => {
    await db.attendedShows.put(show);
    const read = await db.attendedShows.get(1234567890);
    expect(read).toEqual(show);
  });
});
```

**What to copy:** `beforeEach` clears every touched table (add `db.trackedShows.clear()` / `db.trackedEntries.clear()`); `async` `it` blocks awaiting real Dexie writes then reading back. `fake-indexeddb/auto` is ALREADY imported in `packages/app/test/setup.ts:7` — no new wiring. Cover write-through (SHOW-11), restore/single-active (D-03), undo (D-15), set structure (SHOW-06), provisional attendance (DEX-01/D-02).

---

### `packages/app/src/show/useShowSession.ts` — NEW (hook, reactive read) — NO ANALOG

**No existing analog:** `useLiveQuery` is not used anywhere in `packages/app/src` today. Follow RESEARCH.md "Reactive restore + tally" code example verbatim:
```typescript
import { useLiveQuery } from "dexie-react-hooks";
const active = useLiveQuery(() => db.trackedShows.where("status").equals("active").first());
const entries = useLiveQuery(
  () => active ? db.trackedEntries.where("sessionId").equals(active.sessionId).sortBy("position") : [],
  [active?.sessionId],
) ?? [];
```
Do NOT hand-sync trail/tally React state alongside Dexie (RESEARCH anti-pattern) — the DB is the single source of truth. `dexie-react-hooks@4.4.0` is installed per CLAUDE.md stack.

---

### `packages/app/src/show/ActionBar.tsx` — NEW (component, event-driven) — best UI analog

**Analog:** `packages/app/src/components/BottomTabBar.tsx` — exact bottom-bar idiom (fixed, safe-area inset, ≥44px tap targets, lucide icons).

**Fixed-bottom + safe-area + tap-floor pattern** (`BottomTabBar.tsx:13-38`):
```tsx
<nav
  className="fixed bottom-0 left-0 right-0 flex items-stretch justify-around border-t border-hairline bg-elevated"
  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
>
  {TABS.map(({ route, label, Icon }) => (
    <button
      type="button"
      onClick={() => navigate(route)}
      className="flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 py-2 text-text-muted"
    >
      <Icon size={22} />
      <span className="text-[14px] font-semibold leading-tight">{label}</span>
    </button>
  ))}
</nav>
```

**What to copy:** `min-h-11 min-w-11` (the 44px floor), `env(safe-area-inset-bottom)` inline style, `border-hairline`/`bg-elevated`/`text-text-muted` theme tokens (all inherited Phase 3 — do NOT re-derive), `<Icon size={22} />` from `lucide-react`, `text-[14px] font-semibold` Label typography. Show-Mode icons per 04-UI-SPEC: `Search`, `CircleHelp`, `Undo2`, `SkipForward`/`Minus`, `Star`. Two-row layout per D-13 mockup.

---

### `packages/app/src/show/ShowView.tsx` — NEW (view root) — branching root

**Analog:** `packages/app/src/App.tsx` (composition root with `useEffect`/state + conditional children) + `PlaceholderView.tsx` (reads `config.copy`, renders centered dark states).

**Centered-state + config-copy pattern** (`PlaceholderView.tsx:4-14`):
```tsx
export function PlaceholderView({ route }: { route: Route }) {
  const { heading, body } = config.copy.placeholders[route];
  return (
    <div className="flex flex-col items-center pt-16 px-4 text-center">
      <h1 className="text-[20px] font-semibold leading-tight text-text-primary">{heading}</h1>
      <p className="mt-2 text-base leading-normal text-text-muted">{body}</p>
    </div>
  );
}
```

**What to apply:** ShowView branches pre-show / active / finalized off `useLiveQuery` (D-03). All copy from `config.copy.show.*` (new — mirror the existing `config.copy.placeholders` shape). Reuse the `text-[20px] font-semibold` Heading + `text-base text-text-muted` Body classes verbatim for the pre-show launcher / model-load-failure states. `PlaceholderView` at `#/show` is REPLACED by `ShowView` — update `App.tsx` to render `ShowView` when `route === "show"`.

**Pitfall (RESEARCH #5):** `AppShell.tsx:31` wraps children in `<main className="flex-1 overflow-y-auto pb-16">`. The orbit stage must NOT scroll/rubber-band (SHOW-13). Decide during planning: parametrize `AppShell` to disable `<main>` scroll for `#/show`, or have `ShowView` own a full-height non-scroll flex layout.

---

### `packages/app/src/wakeLock.ts` — NEW (utility, browser API, event-driven)

**Analog:** `packages/app/src/pwa/persist.ts` (`requestPersistenceOnce` — a silent-on-failure browser-API wrapper, invoked from `App.tsx:23`). Same shape: feature-detect, try/catch, never throw, expose an idempotent acquire fn. Concrete acquire/reacquire code in RESEARCH Pitfall 1 (verify the sentinel actually held — iOS <18.4 installed-PWA false-positive).

## Shared Patterns

### Theme tokens (inherited — never re-derive)
**Source:** `AppShell.tsx`, `BottomTabBar.tsx`, `PlaceholderView.tsx` + Phase 3 `styles.css` `@theme`.
**Apply to:** every Show-Mode component.
Use the named Tailwind tokens directly: `bg-surface` (`#0C0C10` dominant), `bg-elevated` (`#17171F` secondary), `text-text-primary` (`#F5F5F7`), `text-text-muted` (`#A1A1AA`), `border-hairline` (`#2A2A34`), `text-accent` (gold, reserved — Start Show / focus ring only). Typography: `text-[20px] font-semibold` (Heading), `text-[14px] font-semibold` (Label), `text-base` (Body ≥16px). NEW Phase-4 data colors (tuning families, hit/miss) come from 04-UI-SPEC §Color — key tuning color off the EXACT core union string `"standard"|"cs-standard"|"microtonal"|"other"` (`tuning-tags.ts:25`), NOT the UI-SPEC display label `"C# standard"` (RESEARCH Pitfall 3).

### 44px tap floor + safe-area
**Source:** `AppShell.tsx:25`, `BottomTabBar.tsx:25`.
**Apply to:** every tappable element (orbs, action-bar buttons, trail nodes, info dot).
`min-h-11 min-w-11` for the 44px hit floor; `style={{ paddingBottom/Top: "env(safe-area-inset-*)" }}` for edge insets. Orbs additionally clamp to `ORB_MIN_DIAMETER` (56px visual) from config.

### Config idiom (single-config-file ethos)
**Source:** `packages/app/src/config.ts:12-66` (`export const config = { … } as const` with JSDoc-per-key + nested `copy.*`); mirrored by `packages/core/src/config.ts:9`.
**Apply to:** all Show-Mode tunables.
Add a `show` block (`ORB_COUNT_MIN/MAX`, `ORB_DROP_SCORE`, `WEAK_FAN_THRESHOLD`, `ORB_MIN_DIAMETER`, `TRAIL_VISIBLE_RECENT`, `TRAIL_COMPRESS_AT` — defaults in 04-UI-SPEC §Config) and a `copy.show.*` block (mirroring `copy.placeholders`) holding every 04-UI-SPEC copy string. Search fuse.js tunables (`threshold`/`distance`) go in CORE config since `searchCatalog` lives in core.

### predict() consumption (frozen Phase 2 API — zero new scoring)
**Source:** `packages/core/src/model/predict.ts:482` + `domain/types.ts:183-201`.
**Apply to:** OrbitStage recenter cycle.
`predict(matrix, ctx)` returns `PredictionCandidate[]` (`{ songId, songName, score, factors, reason }`) already sorted desc. `score ∈ [0, 0.97]` absolute — display `round(score*100)%` directly, NEVER renormalize (D-09). `reason` renders verbatim as the "why" (SHOW-10). Assemble `ShowContext = { currentSongId, trail[], recentShowSongSets[][] }` per recenter; night-1 `recentShowSongSets = []` is correct. Call `predict()` only on a log event, not per render (RESEARCH Pitfall 6).

### Dexie additive migration (never rewrite v1)
**Source:** `db.ts:44-49` (the documented hook).
**Apply to:** the sole `db.ts` modification. Covered concretely above.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/app/src/show/useShowSession.ts` | hook | reactive read | `useLiveQuery` is unused anywhere in `packages/app/src` today — first use. Follow RESEARCH.md code example. |
| `packages/app/src/show/matrix.ts` | loader | file-I/O | First consumer of `data/normalized/transition-matrix.json` from the app — new Vite `resolve.alias` import path (RESEARCH Pitfall 4). No existing bundled-artifact import to copy. |
| `packages/app/src/show/OrbitStage.tsx` (radial canvas/absolute-positioned stage) | component | render | No existing absolutely-positioned/geometry-driven component; layout math is new (`layoutOrbs`). Chrome tokens still inherited. |
| `packages/app/src/wakeLock.ts` (Wake Lock specifics) | utility | browser API | `persist.ts` is a structural analog (silent browser-API wrapper) but the Wake Lock sentinel/visibilitychange/iOS-verify logic is new — follow RESEARCH Pitfall 1. |

## Metadata

**Analog search scope:** `packages/core/src`, `packages/core/test`, `packages/app/src`, `packages/app/test`.
**Files scanned:** ~15 read in full/part (db.ts, config.ts ×2, index.ts, tuning-tags.ts, AppShell, BottomTabBar, PlaceholderView, useHashRoute, App.tsx, vite.config.ts, db.test.ts, setup.ts, tuning-tags.test.ts, predict.ts §, types.ts §); full file inventory globbed.
**Pattern extraction date:** 2026-07-09
</content>
</invoke>
