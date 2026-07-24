# Phase 21: Layout & Layering Foundations - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 6 new + 20 modified
**Analogs found:** 25 / 26 (1 partial gap — see §No Analog Found)

This is a **conventions map**, not a decision map. It answers: *what does the existing code look like,
and which shipped file should each new/changed artifact copy its shape from?* Decisions live in
`21-CONTEXT.md`; call-site inventory lives in `21-RESEARCH.md`.

---

## File Classification

### New files

| New file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `packages/app/test/bottomSpace.test.ts` | test (source-scan guard + jsdom render) | file-I/O + transform | `packages/app/test/rebrand.test.ts` (source scan), `packages/app/test/coversManifest.test.ts` (dir walk) | exact |
| `packages/app/test/layerOrder.test.tsx` | test (jsdom DOM walk) | transform | `packages/app/test/sheet.a11y.test.tsx` | exact |
| `packages/app/test/formatDate.test.ts` | test (pure unit) | transform | `packages/app/test/sync/presenceActivity.test.ts` (pure-fn shape); `test/songRow.test.tsx` (rendered `formatMonYear` output) | role-match |
| `packages/app/test/presenceLabels.test.ts` | test (pure map) | transform | `packages/app/test/sync/presenceActivity.test.ts` | exact |
| `packages/app/src/layout/bottomSpace.ts` | module (DOM side-effect writer) | transform → DOM | `packages/app/src/show/fabLayout.ts` (config→CSS-string composer); `pwa/bottomOverlayInset.ts` (store) | role-match |
| `packages/app/src/dev/…` `?layerRepro=1` harness | dev harness (URL flag) | request-response (URL) | `packages/app/src/live/mockLatest.ts` | exact |
| `.planning/phases/21-…/21-HUMAN-UAT.md` | device-test doc | doc | `.planning/phases/10-…/10-HUMAN-UAT.md` | exact |

### Modified files

| Modified file | Role | Data flow | Convention to preserve |
|---|---|---|---|
| `src/styles.css` | config/stylesheet | — | `@theme` block at top; `html,body,#root{height:100%}` chain; long block comments citing the decision ID that created each rule |
| `src/components/AppShell.tsx` | component (shell) | request-response | Inline `style={{ paddingBottom: … }}` with a comment block naming the bug it fixes |
| `src/config.ts` (`ui.bottomSpace`, `ui.z`) | config | — | Nested namespaces under `ui`; every constant carries a JSDoc naming phase + decision ID + the regression it guards |
| `src/components/BottomTabBar.tsx` | component | — | Local `TABS` array of `{route,label,Icon}`; inline style for height/padding |
| `src/show/fabLayout.ts` | utility | transform | Returns a **CSS `calc()` string**, single source for FAB + weak-fan hint |
| `src/show/FabMenu.tsx`, `src/explore/ExploreFilterFab.tsx` | component (fixed overlay) | — | `style={{ bottom: showBottomFabOffset(...), zIndex: config.ui.z.X }}` |
| `src/show/SearchSheet.tsx`, `src/explore/NodeSheet.tsx`, `dex/{AlbumDetail,ArchiveBrowser,SetlistView}.tsx` | component (hand-rolled dialog) | — | `role="dialog"` + `aria-modal` + `className="fixed inset-0 …"` + `style={{ zIndex: config.ui.z.sheet }}`, **no portal today** |
| `src/dex/RecapView.tsx` | component (page) | — | `z.page` tier, own bottom padding (page footer, not sheet) |
| `components/{InstallBanner,UpdateToast,BackupToast,BingoCelebration,WaveToast}.tsx` | component (toast overlay) | event-driven | Tailwind `bottom-16` + `style={{ zIndex: config.ui.z.toast\|celebration }}`; three also set `paddingBottom: env(...)` |
| `src/dex/shareCard.ts` | renderer (canvas) | transform | Module-private draw helpers (`centerText`, `truncateToWidth`, `wrapLabel`); pure over the passed `ctx` |
| `src/dex/formatMonYear.ts` → `formatDate.ts` | utility (formatter) | transform | Module-level frozen `Intl.DateTimeFormat`; never-throw |
| `src/sync/presenceActivity.ts` | pure module | transform | Zero React/DOM/Supabase imports; type-only router import |
| `src/dex/FriendRow.tsx` (`PresenceActivitySlot`) | component | — | Exported sub-component shared by `FriendRow` + `SelfRow` |

---

## Pattern Assignments

### `packages/app/test/bottomSpace.test.ts` (test, source-scan)

**Analog:** `packages/app/test/rebrand.test.ts` — the repo's canonical source-scan guard. It is
*already* the NAV-02 guard file, so the D-12 bottom-space guard should copy its shape exactly.

**Path resolution + read idiom** (`rebrand.test.ts:1-21`):
```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";

const testDir = dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = join(testDir, "..", "index.html");
```
> Note the `.ts` extension on the source import — repo-wide convention in app tests.

**Doc-comment idiom** (`rebrand.test.ts:7-15`): a block comment naming the requirement/decision IDs,
*what* is asserted, and **why the regression is unmergeable**. Copy that voice; the D-12 guard's
comment must state the comment-stripping discipline (RESEARCH Hazard 3) or it fails confusingly.

**Directory-walk + on-disk-artifact assertion** (`coversManifest.test.ts:13-40`) — use when scanning
all of `packages/app/src` rather than two named files:
```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
const testDir = dirname(fileURLToPath(import.meta.url));
const coversDir = join(testDir, "..", "src", "assets", "covers");
```
Its header also records the precedent: *"the committed artifacts ARE the fixture … fs/path access is
available in the vitest node runtime under jsdom."* That sentence is the licence for a source scan
under the jsdom project.

**Guard scope reminder:** both analogs resolve paths *relative to the test file*. Scope the walk to
`join(testDir, "..", "src")` — never `dist/` (RESEARCH §Runtime State Inventory: a stale committed
bundle is on disk).

**Config-drift assertion idiom** (`configMirror.test.ts:15-27`) — for "the CSS ladder matches
`config.ui.bottomSpace`":
```ts
describe("app/core config mirror", () => {
  it("explore + dex mirrored keys stay equal", () => {
    expect(app.explore.BARS_TOP_N).toBe(core.explore.BARS_TOP_N);
```

---

### `packages/app/test/layerOrder.test.tsx` (test, jsdom ancestor walk)

**Analog:** `packages/app/test/sheet.a11y.test.tsx` — the only test that renders sheets and inspects
raw DOM/portal state.

**Deferred import + fixture-root idiom** (`sheet.a11y.test.tsx:1-33`):
```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { Sheet } = await import("../src/components/Sheet.tsx");   // top-level await import

/** A fresh #app-content inert target + a trigger to restore focus to, per test. */
function mountAppContent(): HTMLButtonElement {
  const root = document.createElement("div");
  root.id = "app-content";
  document.body.appendChild(root);
  return trigger;
}

afterEach(() => {
  cleanup();
  document.getElementById("app-content")?.remove();
});
```

**Raw-DOM query idiom** (`:44`, `:125`, `:192-194`) — the file already reaches past Testing Library
when it needs structure, which is exactly what the ancestor walk does:
```tsx
expect(screen.queryByRole("dialog")).toBeNull();
expect(document.querySelector(".bg-black\\/50")).toBeNull();
const dialog = screen.getByRole("dialog");
expect(dialog.getAttribute("aria-modal")).toBe("true");
expect(dialog.className).toContain("inset-0");
```
`dialog.getAttribute("aria-modal")` is the shipped way to read modality — use it to drive the
modal/non-modal split (D-26) instead of a hand-kept list.

**jsdom-limits disclaimer** (`sheet.a11y.test.tsx:8-14`): the file documents what jsdom *cannot* do
and where the real check lives. `layerOrder.test.tsx` needs the mirror disclaimer (inline-style-only
detection is complete *only while* production has zero `z-*` classes).

**What the walk detects** — the two shipped idioms it must handle, from `ShowView`/`Sheet`:
```tsx
// position from a Tailwind class, zIndex from inline style — the mixed idiom
<div className="relative flex h-full min-h-0 flex-1 flex-col"
     style={{ zIndex: config.ui.z.content }}>
```
```tsx
// Sheet.tsx:96 — the portaled, correct shape
style={{ zIndex: backdrop ? config.ui.z.sheetScrim : config.ui.z.sheet }}
```

**Numeric-guard idiom for WR-01/CR-01:** the invariants are currently prose in `config.ts:265-267`
and `:284-286` (*"WR-01 regression guard: page < sheetScrim"*, *"CR-01 regression guard: fabScrim <
fab"*). Copy those comment sentences verbatim above each new `expect`.

---

### `packages/app/test/formatDate.test.ts` (test, pure unit)

**Analog (shape):** `packages/app/test/sync/presenceActivity.test.ts` — the repo's model pure-function
test: a doc comment naming the decision IDs, then one `describe` per exported function.
```ts
import { describe, expect, it } from "vitest";
import { deriveActivity, reduceActivity, ROUTE_TO_TAB } from "../../src/sync/presenceActivity.ts";

describe("deriveActivity", () => {
  it("hidden wins over everything, including atShow (D-02)", () => { … });
});
```

**Analog (subject):** `formatMonYear`'s current coverage is **indirect only** — asserted through
rendered output in `test/songRow.test.tsx:68`:
```tsx
expect(screen.getByText("Seen 3× · last Jan 2025 · 2 of your shows ago")).toBeInTheDocument();
```
There is **no direct unit test of `formatMonYear`**. So `formatDate.test.ts` is the first direct test
of this module; `songRow.test.tsx` remains the after-the-rename regression net (it must still pass).

**Timezone convention — see §No Analog Found.** No test in the repo sets `TZ`, and `test/setup.ts`
does not either.

---

### `packages/app/test/presenceLabels.test.ts` (test, pure map)

**Analog:** `packages/app/test/sync/presenceActivity.test.ts` (same directory family, `test/sync/`).

**Whole-map equality idiom** (`presenceActivity.test.ts:18-29`) — copy for the token→label maps:
```ts
describe("ROUTE_TO_TAB", () => {
  it("maps every Route to its brand-name tab (settings → idle)", () => {
    expect(ROUTE_TO_TAB).toEqual({
      show: "LiveGizz", explore: "GizzVerse", map: "GizzMap",
      dex: "GizzDex", games: "GizzGames", settings: "idle",
    });
  });
});
```

**Hostile-input idiom** (`:80-99`) — the existing precedent for the D-41 unknown-token case:
```ts
it("all entries malformed → null (never throws, Pitfall 2)", () => {
  expect(reduceActivity([{}, { tab: "nonsense" }])).toBeNull();
});
it("skips malformed entries but keeps valid ones", () => {
  expect(reduceActivity([{ tab: "nonsense" }, null, { tab: "GizzMap" }])).toEqual({ tab: "GizzMap" });
});
```
Note the existing tests **pin `null` as today's unknown-token result** (`:81`). Whichever NAV-03
fallback placement the plan picks, these assertions are the ones that change or stay — name them.

**Where the file goes:** `test/sync/` is the presence family, but the label maps live in
`config.copy`, not `sync/`. RESEARCH's Wave-0 list names `packages/app/test/presenceLabels.test.ts`
(top level). Either is consistent; the render-side assertion (`PresenceActivitySlot`) belongs
wherever `FriendRow`'s existing coverage lives.

---

### `packages/app/src/dex/formatDate.ts` (utility, formatter) — the FOUND-04 owner

**Analog:** `packages/app/src/dex/formatMonYear.ts` — the module being renamed. Its entire content is
the template; `formatFullDate` is a sibling in the same file.

**Full module** (`formatMonYear.ts:1-16`):
```ts
/**
 * Format an ISO date ("2025-01-15") as "Mon YYYY" ("Jan 2025") for the dex song
 * sublines and the WhyDetail corpus line (06-06, STAT-01/03). Parsed in UTC so a
 * "2025-01-01" never slips to "Dec 2024" in a negative-offset timezone. Shared by
 * SongRow + WhyDetail so the phrasing stays identical.
 */
const MON_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatMonYear(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : MON_YEAR.format(date);
}
```

Structure conventions this establishes, all of which `formatFullDate` must copy:
- **Module-scope `const` formatter in SCREAMING_SNAKE**, constructed once at import.
- **`timeZone: "UTC"` with the hazard spelled out in the doc comment**, naming the concrete
  boundary example.
- **Never-throw: `Number.isNaN(date.getTime()) ? iso : FMT.format(date)`** — returns the *raw input*,
  never `"Invalid Date"`. This also makes `""` → `""`, which `RecapView.tsx:219`'s `?? ""` path
  depends on.
- **Named function export** (no default export), one function per format.
- Doc comment names the phase/plan ID, the requirement ID, and every consumer by component name —
  copy that when adding the second formatter and when updating the header for two formatters.
- **Importers to update on rename:** `dex/SongRow.tsx`, `show/WhyDetail.tsx`.

---

### `packages/app/src/layout/bottomSpace.ts` (NEW module, config → CSS custom properties)

**Analog (composition shape):** `packages/app/src/show/fabLayout.ts` — the shipped example of a
module whose job is *one* composed CSS string from `config`:
```ts
import { config } from "../config.ts";

/**
 * Shared bottom offset (CSS `calc` string) for the Show-Mode FAB speed-dial AND
 * the centered "Low confidence" weak-fan hint that aligns vertically with it.
 * Resting: 16px above the app BottomTabBar (h-16 = 64px) atop the safe-area inset;
 * … Single source so the two never drift apart.
 */
export function showBottomFabOffset(stripHasContent: boolean): string {
  return stripHasContent
    ? `calc(env(safe-area-inset-bottom) + 64px + ${config.ui.SUGGESTION_STRIP_HEIGHT}px + 16px)`
    : "calc(env(safe-area-inset-bottom) + 64px + 16px)";
}
```
Conventions: relative `../config.ts` import **with extension**; a doc comment stating *why the module
exists* ("single source so the two never drift apart"); interpolate config values, keep literals out.

**Analog (the CSS-var half):** no exact analog exists for `documentElement.style.setProperty` of a
`--gz-*` ladder — see §No Analog Found. The nearest shipped domain-scoped custom properties
(`--show-bg-*`, `--explore-bg-*`, `--float-*`, `--ripple-*`) are authored in `styles.css`.

**Static-declaration side (`styles.css` `:root`)** — the existing `@theme` block at
`styles.css:5-13` is the file's convention for declared-once tokens:
```css
@theme {
  --color-surface: #0c0c10; /* dominant 60% — app bg */
  --color-elevated: #17171f; /* secondary 30% — tab bar, sheets, banners, toasts */
}
```
(`--gz-safe-bottom` goes in a plain `:root`, not `@theme` — `@theme` generates Tailwind utilities,
which is not wanted here.)

---

### `src/styles.css` (modified — body padding + `--gz-*` ladder)

**The line to remove and the comment that already documents its mirror** (`styles.css:205-223`):
```css
body {
  margin: 0;
  background-color: var(--color-surface);
  …
  /* Safe-area awareness for notches / home indicators (venue reality: fat-thumb, edge-to-edge).
     NOTE: no `padding-top` here by design (UX-01 / D-01). Each top-anchored surface applies its
     own `calc(env(safe-area-inset-top) + Npx)`; a body-level top inset would double it. */
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```
**Comment convention to copy:** when the bottom line is removed, extend that same `NOTE:` sentence to
cover both axes and cite the phase-21 decision — the file's established style is a decision-cited
rationale comment sitting immediately above the rule.

**The `height:100%` chain that must not change** (`:15-19`) and **the class-scoped gesture
suppression the portal work must re-apply** (`:21-37`):
```css
html, body, #root { height: 100%; }

.orbit-stage, .action-bar, .fab-menu {
  touch-action: manipulation; /* kills 300ms double-tap-zoom + double-tap gesture */
  overscroll-behavior: none;  /* no pull-to-refresh, no scroll chaining */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none; /* iOS: suppress the long-press callout menu */
}
```
These are **class selectors**, so a portaled root re-acquires them simply by carrying the class name
(D-23) — no CSS change needed.

---

### `AppShell` `<main>` (modified — content vs chrome reserve)

**Current shape** (`AppShell.tsx:62-81`), the exact divergence D-02 names:
```tsx
<main
  className={scroll ? "flex-1 overflow-y-auto" : "flex min-h-0 flex-1 flex-col overflow-hidden"}
  style={{
    // Scrolling routes RESERVE space for the transient fixed-bottom overlays
    // (InstallBanner/UpdateToast) so their content is never covered/untappable.
    // Non-scrolling routes (the orbit stage, the constellation) instead let
    // those overlays FLOAT over the bottom edge — reserving the inset here would
    // permanently squish a `flex-1` full-height stage every time a transient
    // banner appears. Only the static tab-bar height is reserved for them.
    paddingBottom: scroll
      ? `calc(4rem + env(safe-area-inset-bottom) + ${overlayInset}px)`
      : `calc(4rem + env(safe-area-inset-bottom))`,
  }}
>
```
Conventions to preserve: the ternary on `scroll` stays (only the two strings become
`var(--gz-content-reserve)` / `var(--gz-chrome-reserve)`); the multi-line rationale comment stays and
gains the D-02 naming; the `h-full`-never-`min-h-screen` comment block at `:29-37` is load-bearing
history — **do not delete it while editing this file**.

Prop-doc convention (`:14-20`): props carry a JSDoc naming the RESEARCH pitfall / requirement they
serve.

---

### `config.ui.bottomSpace` / `config.ui.z` (modified — the single-owner constants)

**Structure** (`config.ts:220-299`): a top-level `ui:` namespace of flat SCREAMING_SNAKE constants
plus one nested `z:` object. Every entry has a JSDoc naming *phase + decision ID + the regression it
prevents*:
```ts
/** Phase-5 UI geometry (05-UI-SPEC §Config surface). */
ui: {
  /**
   * Fixed SuggestionStrip slot height in px so the orbit never re-lays-out
   * (SHOW-02 preservation). MUST hold `live.SUGGESTION_COUNT` rows without
   * clipping: … the old 56px (sized for 1 row) clipped the 2nd suggestion
   * against the tab bar (VALID-02 device dry-run, D-09). 112px = 2 rows …
   */
  SUGGESTION_STRIP_HEIGHT: 112,
  /** Phase-6 D-20: collapsed Show-Mode FAB diameter in px (≥44px hit floor cleared). */
  FAB_DIAMETER: 56,
```
**The `z` ladder + its INVARIANT comment** — the text the layer test's assertions must quote
(`config.ts:240-297`):
```ts
  /**
   * Phase-8 D-04: named z-index stacking tiers — the single source of truth
   * for every layered `fixed` overlay (CLAUDE.md single-config-file rule; no
   * scattered `z-NN` literals). Applied via inline `style={{ zIndex:
   * config.ui.z.X }}` on each overlay, NOT a Tailwind `z-[…]` class (Tailwind
   * v4 resolves arbitrary values at author-time from static strings, so a
   * JS-config value must go through inline style to keep config.ts the one
   * source). INVARIANT: every FAB tier sits STRICTLY below `sheet`; `focusedFab`
   * is the ONE deliberate exception (D-03 …).
   */
  z: {
    content: 10,
    …
    /** … (WR-01 regression guard: page < sheetScrim). */
    page: 15,
    …
    /** … otherwise the scrim paints on top of the speed-dial actions and eats
     *  every tap (CR-01 regression guard: fabScrim < fab). */
    fabScrim: 25,
```
Naming convention for the new group: `ui.bottomSpace.{TAB_BAR_HEIGHT_REM, FAB_CLEARANCE_PX,
SHEET_PAD_BOTTOM_PX}` — units in the identifier suffix, matching `FAB_SHEET_GAP_PX` (`:299`) and
`SUGGESTION_STRIP_HEIGHT` (px implied).

---

### `BottomTabBar` (modified — labels from `config.copy`, height from the var)

**Current shape** (`BottomTabBar.tsx:1-28`):
```tsx
const TABS: { route: Route; label: string; Icon: typeof Music }[] = [
  { route: "show", label: "LiveGizz", Icon: Music },
  …
];

<nav
  className="fixed bottom-0 left-0 right-0 flex items-stretch justify-around border-t border-hairline bg-elevated"
  // Fixed 4rem button-area height (matches AppShell's <main> bottom reservation
  // so body content sits flush with the top of the tabs — no dead gap), with the
  // iOS home-indicator safe-area gutter ADDED below it (border-box).
  style={{
    height: "calc(4rem + env(safe-area-inset-bottom))",
    paddingBottom: "env(safe-area-inset-bottom)",
  }}
>
```
Preserve: the `TABS` array **shape and order**, `Icon: typeof Music` typing, the D-01 icon-choice
comment at `:9-12`, `flex-1 min-h-11 min-w-11`, `aria-current={isActive ? "page" : undefined}`,
`text-accent`/`text-text-muted` split, and the label span
`className="text-[14px] font-semibold leading-tight"`. Only the `label` values move to `config.copy`
and the two style strings become vars. The `4rem`/no-dead-gap comment is now *wrong* about the
mechanism — rewrite it (it also trips the D-12 guard unless comments are stripped).

---

### Hand-rolled dialogs → portaled (`SearchSheet`, `AlbumDetail`, `ArchiveBrowser`, `SetlistView`, `NodeSheet`)

**Current shape** (`SearchSheet.tsx:94-101`) — the exact pattern all five share:
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-label={copy.searchPlaceholder}
  className="fixed inset-0 flex flex-col bg-surface"
  style={{ zIndex: config.ui.z.sheet }}
>
```

**Target pattern — the only shipped portal** (`Sheet.tsx:64-113`):
```tsx
if (!open) return null;
if (typeof document === "undefined") return null;   // SSR/jsdom guard, keep it

const dialogProps = {
  ref: contentRef,
  role: "dialog" as const,
  "aria-modal": modal,
  "aria-label": ariaLabel,
  tabIndex: -1,
};

return createPortal(
  <div
    className={"fixed inset-0 flex flex-col justify-end " + (backdrop ? "bg-black/50" : "pointer-events-none")}
    style={{ zIndex: backdrop ? config.ui.z.sheetScrim : config.ui.z.sheet }}
    onClick={backdrop ? onClose : undefined}
  >
    <div
      {...dialogProps}
      className="pointer-events-auto rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"
      style={{ zIndex: config.ui.z.sheet, paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  </div>,
  document.body,
);
```
Copy: the two early-return guards, `createPortal(…, document.body)` as the **return** (not a wrapper),
`tabIndex: -1` on the dialog root, scrim `onClick={onClose}` + content
`onClick={stopPropagation}`, and the `calc(env(...) + 32px)` line that becomes
`var(--gz-sheet-pad-bottom)`. Do **not** adopt `Sheet`'s focus-trap hooks — D-22 keeps the five
hand-rolled.

---

### Toast/banner overlays (`InstallBanner`, `UpdateToast`, `BackupToast`, `BingoCelebration`, `WaveToast`)

All five share: `fixed … bottom-16` Tailwind class + inline `zIndex` from `config.ui.z`. Three
(`InstallBanner:93`, `UpdateToast:36`, `BackupToast:74`) additionally set
`paddingBottom: "env(safe-area-inset-bottom)"`; two (`BingoCelebration:206`, `WaveToast:168`) do not.
The conversion is `bottom-16` → `style={{ bottom: "var(--gz-chrome-reserve)" }}` **and**, for the
three, deleting the `paddingBottom` in the same edit (RESEARCH Pitfall 2). `BingoCelebration.tsx:207-211`
carries a now-wrong rationale comment — the file convention is to rewrite the comment with the new
mechanism rather than delete it.

---

### `src/dex/shareCard.ts` (modified — footer width constraint)

**Current draw** (`shareCard.ts:184-196`):
```ts
  // Footer: honest muted date · venue — the latest attended night (collection)
  // or the show this recap card is for (show).
  const footer = data.scope === "collection" ? … : { label: cardCopy.showLabel, date: data.show.date, venue: data.show.venue };
  if (footer != null) {
    const line = footer.venue ? `${footer.date} · ${footer.venue}` : footer.date;
    centerText(ctx, footer.label, cx, height * 0.955, 38, COLOR.muted);
    centerText(ctx, line, cx, height * 0.99, 44, COLOR.primary);
  }
```

**The ellipsize helper already shipping** (`shareCard.ts:250-258`) — reuse, do not rewrite:
```ts
/** Ellipsize `text` so it fits `maxWidth` at the CURRENT `ctx.font` (used for a
 *  single long word or an over-long final wrapped line). */
function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 0 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}
```
Conventions: module-private `function` (not exported), takes `ctx` first, **pure over the passed
context's `measureText`** (the `wrapLabel` doc comment at `:260` states this explicitly — it is what
makes the mock-ctx test possible), doc comment states the units and the current-font precondition.
`shareCard.ts:417`'s `width * 0.9` is the existing max-width convention to reuse.

---

### `sync/presenceActivity.ts` + render-side consumer (modified)

**Wire-token module conventions** (`presenceActivity.ts:1-31, 48-65`) — preserve all of them:
```ts
/**
 * Pure presence-activity derivation (Phase 20, PRES-04). This module is
 * DELIBERATELY pure — no Supabase, no React, no DOM — it imports only the
 * `Route` TYPE from the router. …
 */
import type { Route } from "../routing/useHashRoute.ts";

/**
 * The presence tab tokens. These ARE the display labels (the brand names shown
 * on a friend's presence dot), so no separate label map is needed — only the
 * `atShow`/`offline` strings live in `config.copy.presence`.
 */
export type Tab = "LiveGizz" | "GizzVerse" | … | "idle";

export const ROUTE_TO_TAB: Record<Route, Tab> = { show: "LiveGizz", … };

/** The valid Tab set — the allow-list `reduceActivity` validates untrusted peer entries against. */
const TABS: ReadonlySet<Tab> = new Set<Tab>([ … ]);
```
The second doc comment is the **stale one D-39 corrects**. Note the module has *no* `config` import
today — keep it that way (label maps go in `config.copy`, this file stays pure).

**Render-side consumer** (`dex/FriendRow.tsx`, `PresenceActivitySlot`):
```tsx
/**
 * Fill the reserved `presence-activity` slot with the coarse activity label:
 * `null` → nothing; `atShow` → `At a show 🎸` in `text-text-primary` … else the
 * `activity.tab` brand token (muted). The dot NEVER conveys state by color alone …
 * Shared by FriendRow + SelfRow. `offline` is passed as an explicit `label`/`emphasized` override.
 */
export function PresenceActivitySlot({ activity, label, emphasized = false }: { … }) {
  // An explicit label override (the self-row `offline` case) wins.
  const text = label ?? (activity == null ? null : activity.atShow ? config.copy.presence.atShow : activity.tab);
  const strong = label != null ? emphasized : activity?.atShow === true;
  return (
    <span data-slot="presence-activity" className="shrink-0">
      {text != null && (
        <span className={`text-[13px] leading-tight ${strong ? "text-text-primary" : "text-text-muted"}`}>
          {text}
        </span>
      )}
    </span>
  );
}
```
This one expression (`… : activity.tab`) is the D-39 raw-token render. Preserve: the exported-shared
sub-component (used by `SelfRow` too), the `label` override precedence, `data-slot`/`shrink-0`
wrapper, the 13px muted/primary split, and the WCAG-1.4.1 sentence in the doc comment.

**`config.copy` convention for the new maps** (`config.ts:1432-1455`): a nested `presence:` object
under `copy`, doc comment citing the UI-SPEC section "verbatim", each entry a `/** … */`-documented
string or arrow function, peer-supplied text noted as escaped React text. Existing keys `atShow`,
`offline` live here — the token→label maps join them.

---

### `?layerRepro=1` dev harness — the URL-flag convention

**Analog:** `packages/app/src/live/mockLatest.ts` (quick task `260713-wjd`). Copy both halves.

**Header comment** (`mockLatest.ts:1-20`) — states TEST HARNESS ONLY, the quick-task/decision ID, why
it exists, what it does *not* bypass, and an explicit `Safety:` paragraph:
```ts
/**
 * TEST HARNESS ONLY (quick task 260713-wjd) — a `?mockLatest=1` URL flag that
 * feeds the live-sync pipeline FIXTURE rows instead of hitting kglw.net.
 * …
 * Safety: inert unless `mockLatest=1` is EXPLICITLY in the query string —
 * normal loads return null and the poller uses the real network fetch. A
 * personal tool (no product users to confuse); the flag is documented here
 * and in the quick-task summary.
 */
```

**The gate itself** (`mockLatest.ts:97-101`) — exactly three lines, in this order:
```ts
export function getMockLatestFetch(): typeof globalThis.fetch | null {
  if (typeof location === "undefined") return null;
  const flag = new URLSearchParams(location.search).get("mockLatest");
  if (flag !== "1" && flag !== "drift") return null;
```
Conventions: `typeof location === "undefined"` guard first (jsdom/SSR safety), `URLSearchParams` (never
regex on `location.search`), **exact-value equality** against a literal (never truthiness — the
V12 requirement that the flag only toggles a boolean and never renders query content), returns
`null`/inert on the normal path. The doc comment also records "read once per call — the flag can't
change without a reload, so callers may cache the result at module/mount scope" — mirror that
caching note. There is also a shipped test for it: `packages/app/test/mockLatest.test.ts`.

**Dev-route precedent:** `packages/app/src/dev/OrbFitHarness.tsx` — the `src/dev/` location, and the
repo's single Tailwind `z-10` class (dev-only), which the layer test must exclude by name.

---

### `21-HUMAN-UAT.md` — device-test document format

**Analog:** `.planning/phases/10-pre-show-validation-device-dry-run/10-HUMAN-UAT.md`.

**Structure, verbatim:**
```markdown
---
status: resolved
phase: 10-pre-show-validation-device-dry-run
source: [10-VERIFICATION.md]
started: 2026-07-19T00:08:48Z
updated: 2026-07-18T22:40:00Z
---

## Current Test

None — VALID-01 and VALID-02 both fully closed on-device. …

## Tests

### 1. Tuning-family spot-check + anomaly sweep (VALID-01)
expected: |
  <multi-line instructions, tables of pre-run values, explicit CONFIRMATION BRANCH /
  FIX BRANCH instructions naming exact commands>
result: |
  PASS (D-03 FIX branch). <what the owner did, tables of before/after numbers,
  which decision it closes, which prior phase's UAT it re-confirms>

## Harness (D-07)

<build + serve + tunnel commands, with the MEMORY reference>
```

Key conventions:
- YAML frontmatter: `status`, `phase` (full slug), `source: [<PHASE>-VERIFICATION.md]`, `started`,
  `updated`.
- A `## Current Test` section at the top that is kept live (names the open gap, or "None — …").
- `### N. Title (REQ-ID)` per test, then **bare `expected: |` / `result: |` YAML-style block scalars**
  inside markdown (not code fences).
- `expected` states the branch structure up front (confirm vs fix) and the exact commands.
- `result` records PASS/FAIL, the numbers, and cross-references the requirement it closes.
- A `## Harness` section with the reproducible serve/tunnel steps and the MEMORY pointer:
  *"see MEMORY `device-uat-hosting`"* — the `--http-host-header localhost` flag is called out as
  **mandatory** (vite preview 403s without it).

Phase 21 needs six numbered tests (`21-UI-SPEC.md` §Device Verification), and D-18 additionally
requires **device model + OS version + orientation** recorded in each `result`.

---

## Shared Patterns

### Z-index application
**Source:** `config.ts:240-297` + `Sheet.tsx:81/96/103`
**Apply to:** every layered surface touched this phase
```tsx
style={{ zIndex: config.ui.z.sheet }}
```
Never a Tailwind `z-*` class. Verified repo-wide: the only `z-*` utility is `dev/OrbFitHarness.tsx:147`.

### Bottom-anchored offsets
**Source:** `AppShell.tsx:75-77`, `BottomTabBar.tsx:24-27`, `Sheet.tsx:104`, `fabLayout.ts:11-13`
**Apply to:** all 16 call sites in RESEARCH §Bottom-Space Call-Site Inventory
Current idiom is an inline-style `calc(...)` **string** (not a Tailwind class) for anything involving
`env()`; only the five toasts use the `bottom-16` class. After this phase the string becomes
`var(--gz-*)` but stays an inline style.

### Never-throw display helpers
**Source:** `formatMonYear.ts:13-16`; same discipline in `wakeLock.ts` / `persist.ts`
**Apply to:** `formatFullDate`, the presence label resolver
```ts
return Number.isNaN(date.getTime()) ? iso : FMT.format(date);
```

### Decision-cited comments
**Source:** everywhere — `config.ts:222-232`, `AppShell.tsx:22-37`, `styles.css:217-219`,
`presenceActivity.ts:11-17`, `mockLatest.ts:1-20`
**Apply to:** every edit in this phase. Every non-obvious constant, style string and guard carries a
comment naming the **phase + decision/requirement ID + the concrete regression it prevents**. Several
of these comments are now factually wrong (`AppShell.tsx:22`, `BottomTabBar.tsx:21-23`,
`BingoCelebration.tsx:207-211`, `presenceActivity.ts:20-23`) — the convention is to **rewrite with the
new mechanism**, not delete.

### Test file conventions
**Source:** `rebrand.test.ts`, `sheet.a11y.test.tsx`, `presenceActivity.test.ts`
- Location `packages/app/test/**` (never co-located); `.test.ts` for pure, `.test.tsx` for render.
- Source imports carry the `.ts`/`.tsx` extension: `from "../src/config.ts"`.
- Deferred `const { X } = await import("../src/…")` when a `vi.mock`/hoisted stub must land first.
- `afterEach(cleanup)` (plus manual DOM-fixture teardown when the test appends to `document.body`).
- A file-level doc comment naming the plan/requirement/decision IDs and *why the regression matters*.
- Run: `npx vitest run --project @guezzer/app <file>`; full suite `npm test`.

---

## No Analog Found

| File / concern | Role | Data flow | Reason |
|---|---|---|---|
| Timezone-sensitive test setup in `test/formatDate.test.ts` | test | transform | **No test in the repo sets `TZ`**, and `packages/app/test/setup.ts` (env stubs, `fake-indexeddb`, `matchMedia`) does not either — verified by grep for `TZ`/`timeZone` across `packages/app/test`. There is no precedent to copy for forcing `America/New_York`. Options for the planner: (a) `process.env.TZ = "America/New_York"` at the top of the file before importing the module — brittle, the `Intl.DateTimeFormat` is constructed at import; (b) set `test.env.TZ` per-project in the root `vitest.config.ts`; (c) assert the UTC property directly (`formatFullDate("2026-01-01") === "Jan 1, 2026"` is TZ-independent *because* the helper pins `timeZone: "UTC"`) and add a separate assertion that the module's formatter options include `timeZone: "UTC"`. The plan must name which it uses. |
| `document.documentElement.style.setProperty("--gz-*", …)` from JS | module | transform → DOM | No shipped module writes CSS custom properties from JS. All existing custom properties (`--show-bg-*`, `--explore-bg-*`, `--float-*`, `--ripple-*`, the `@theme` palette) are **authored in `styles.css`**. This is why RESEARCH recommends declaring `--gz-safe-bottom` statically in `:root` — it is the only form with in-repo precedent. Use `fabLayout.ts` for the *composition* shape and `styles.css` `@theme` for the *declaration* shape; the write mechanism itself is new. |

---

## Metadata

**Analog search scope:** `packages/app/src/{components,show,dex,explore,map,sync,pwa,live,dev,layout,routing}`,
`packages/app/test/**`, `packages/app/src/{config.ts,styles.css}`, `.planning/phases/10-*/`
**Files read this pass:** 20
**Pattern extraction date:** 2026-07-24
