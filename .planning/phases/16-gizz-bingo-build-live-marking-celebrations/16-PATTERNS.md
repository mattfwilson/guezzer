# Phase 16: Gizz Bingo — Build, Live Marking & Celebrations - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 15 (2 core, 13 app) — 8 new, 7 modified
**Analogs found:** 15 / 15 (every seam has a shipped analog with cited line numbers)

This phase is almost entirely UI/UX over a LOCKED engine (Phase 14) + persistence machinery (Phase 15), plus ONE new pure-core module (`estimate.ts`). Because the codebase already ships nearly identical surfaces (a read-only bingo board in RecapView, an app-wide toast emitter, a share-card canvas, an orb renderer with reduced-motion), almost every new file is a **near-clone of an existing analog**, not a from-scratch build. Copy the cited excerpts.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/bingo/estimate.ts` | core / model math | transform (pure) | `packages/core/src/bingo/wins.ts` (`expectedFill` + geometry) | role+flow exact |
| `packages/core/src/config.ts` §bingo additions | config | static constants | existing `config.bingo` block (`config.ts:363`) | exact (same block) |
| `packages/app/src/components/BingoBoard.tsx` | component | request-response (render) | `RecapView.tsx:344-381` inline 4×4 board | extract-in-place (exact) |
| `packages/app/src/games/GamesView.tsx` (modify) | component / view | CRUD (Dexie liveQuery) | itself (stub lines 42-56) + `RecapView` board | exact (same file) |
| `packages/app/src/games/DealScreen.tsx` | component | event-driven (deal action) | `PreShowLauncher.tsx` (single-action CTA) | role-match |
| `packages/app/src/games/SwapSheet.tsx` | component | request-response (search) | `SearchSheet.tsx` / `CatchUpSheet.tsx` (`<Sheet>` + fuse) | role+flow match |
| `packages/app/src/games/FillMeter.tsx` | component | transform (render estimate) | RecapView win-badge chips (`:322-339`) | partial (presentation) |
| `packages/app/src/games/bingoReplay.ts` (modify) | service / adapter | transform (derive) | itself (`replayCard`) | exact (add sibling) |
| `packages/app/src/components/BingoCelebration.tsx` | component / provider | event-driven (emitter) | `BackupToast.tsx` module-emitter | exact (clone pattern) |
| `packages/app/src/show/ShowView.tsx` (modify) | view | event-driven (logSong funnel) | itself (`logSong` :324/339/355, `CometTrail` slot :472) | exact (same file) |
| `packages/app/src/show/BingoPeekStrip.tsx` | component | request-response (liveQuery thumbnail) | `CometTrail` in-flow slot + `BingoBoard` | role-match |
| `packages/app/src/dex/RecapView.tsx` (modify) | view | request-response | itself (`bingo` memo :120-142, `ShareCardSheet` :29/56) | exact (same file) |
| `packages/app/src/dex/shareCard.ts` (modify) | utility | file-I/O (canvas paint) | itself (`drawShareCard` scope branch :99-217) | exact (add scope) |
| `packages/app/src/dex/ShareCardSheet.tsx` (modify) | component | request-response | itself | exact |
| Start-Show nudge (in `ShowView`/`PreShowLauncher`) | component | event-driven | `PreShowLauncher.startShow()` (:14/32) + `lockCard` (`db.ts:525`) | role-match |

## Pattern Assignments

### `packages/core/src/bingo/estimate.ts` (NEW — core, transform)

**Analog:** `packages/core/src/bingo/wins.ts` — model `estimateFill` + `nearMiss` right next to `detectWins`/`expectedFill`. Pure: reads only card + injected ctx/config; no I/O, no DOM, no wall-clock, no entropy (same discipline the file header states).

**Reuse the geometry constants** (`wins.ts:19-39`) — the one-away helper (D-13/14/15) needs exactly these. Research recommends **factoring `ROWS`/`COLS`/`DIAG_MAIN`/`DIAG_ANTI`/`CORNERS`/`X_INDICES` out of `wins.ts` and exporting them** so `estimate.ts` shares them rather than duplicating:
```typescript
// wins.ts:19-33 — the board geometry to export and reuse in estimate.ts
const ROWS = [[0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15]];
const COLS = [[0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15]];
const DIAG_MAIN = [0,5,10,15];
const DIAG_ANTI = [3,6,9,12];
const CORNERS  = [0,3,12,15];
```

**"Marked" test to copy** (`wins.ts:50-55`) — a square is marked iff `markedByPosition !== null` (free cell carries `FREE_SENTINEL`, so it counts automatically). The one-away helper looks for lines/cols/diags with **exactly one** unmarked square:
```typescript
// wins.ts:50-55 — how marks are resolved off the card (reuse this)
const markedIndices = new Set<number>();
for (const square of marked.squares) {
  if (square.markedByPosition !== null) markedIndices.add(square.index);
}
const isFull = (indices) => indices.every((i) => markedIndices.has(i));
```

**Contrast — what `expectedFill` is NOT** (`wins.ts:84-86`): today's function is trivially `markedCount / 16` over an already-*marked* card. The NEW `estimateFill` is its **pre-lock sibling** over an unlocked composition, summing per-square fire-rates under a consume-once discount (D-10). Signature per RESEARCH §D-10:
```typescript
export interface FillEstimate {
  expectedMarks: number;      // 1..16 incl. free cell
  fillFraction: number;       // expectedMarks / 16
  lineLikelihood: "likely" | "possible" | "unlikely";
  blackoutLikelihood: "likely" | "possible" | "unlikely";
}
export function estimateFill(card, ctx, caughtSnapshot, cfg = config): FillEstimate;
```

**Config-injection default pattern:** mirror `deriveMarks`/`deal` — `cfg: typeof config = config` as the last param (keeps the fold's discipline; no magic numbers). Constants (`fireRates`, `eraShowCount`, `fillMeter`) go in `config.bingo` (see next).

**Validation trust gate (D-10, non-optional):** add `packages/core/test/bingo/estimate.test.ts` as a sibling to `calibrate.test.ts`; reuse the `sim-${vibe}-${i}` seed idiom (`bingo-calibrate.ts:234`); assert heuristic `expectedMarks` ≈ Monte-Carlo means **7.89 / 7.26 / 6.25** and band ordering matches `pLine` **0.42 > 0.32 > 0.20**.

---

### `packages/core/src/config.ts` §bingo (MODIFY — config)

**Analog:** the existing `config.bingo` block (`config.ts:363-462+`). Every existing key carries a `[VERIFIED]` / `[ASSUMED]` provenance comment and groups by decision id — **match that comment style exactly** for the new keys. Example of the shape to follow:
```typescript
// config.ts:452-462 — provenance-commented constant block to mirror
albumSquarePool: [
  "/albums/infest-the-rats-nest",
  "/albums/omnium-gatherum",
  // …owner-approved 9-album set, keys are `/albums/<slug>`
] as string[],
```

**Add (per RESEARCH §Constants):**
```typescript
config.bingo.fireRates = { album: {…9 albumUrls}, event: { opener, microtonal, marathonJam, bustOut, neverCaught } }
config.bingo.eraShowCount = 241          // recent-era denominator (RECENT_ERA_MIN_YEAR=2022); FLAG A3
config.bingo.fillMeter = { consumeOnceDiscount, lineLikelyThreshold, linePossibleThreshold }
```
Numbers baked verbatim from committed `data/bingo-roster-candidates.md` + `data/bingo-calibration-report.md` (owner-reviewable, like the rosters). **No scattered magic numbers** (CLAUDE.md single-config rule).

New **copy** goes in `config.copy.games.bingo` (extend `config.copy.games`, `config.ts:998`) — deal headings, gamble hints, swap-sheet section labels, meter captions, one-away banners, celebration strings. See UI-SPEC Copywriting Contract for the exact strings.

---

### `packages/app/src/components/BingoBoard.tsx` (NEW — component; the highest-leverage refactor)

**Analog:** `RecapView.tsx:344-381` — the inline 4×4 board **is** the component to extract. RecapView, GamesView (live + draft), and BingoPeekStrip must all render identically → extract once, do NOT let them diverge (RESEARCH Anti-Pattern).

**Core pattern to lift verbatim** (`RecapView.tsx:344-381`):
```tsx
<div className="grid grid-cols-4 gap-2">
  {bingo.marked.squares.map((square) => {
    const isMarked = square.markedByPosition !== null;
    const isFree = square.def.kind === "free";
    const label = isFree ? copy.bingoFreeLabel : square.def.label;
    const litName = isMarked && !isFree
      ? bingo.songNameByPosition.get(square.markedByPosition as number) : null;
    return (
      <div key={square.index}
        className="flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-md p-2 text-center"
        style={isMarked
          ? { backgroundColor: "#22C55E", color: "#0C0C10" }              // caught-green marked
          : { backgroundColor: "#17171F", color: "#F5F5F7", border: "1px solid #2A2A34" }}>
        <span className="line-clamp-2 text-[12px] font-semibold leading-tight">{label}</span>
        {litName && (
          <span className="line-clamp-1 text-[10px] leading-tight" style={{ color: "#0C0C10", opacity: 0.72 }}>
            {copy.bingoLitBy(litName)}
          </span>
        )}
      </div>
    );
  })}
</div>
```

**Extend for this phase (per UI-SPEC / D-24):**
- Squares become **focusable toggle `<button>`s** with labels (D-24), NOT `<div>`s — but NO ARIA live-region announcements.
- Add props `onSquareTap` (D-16 tap-to-reveal which song lit it), and a one-away **glow ring** prop for the single closest near-miss square (accent `#f2c14e`, `orb-ripple` idiom).
- `min-h-11` per square floor (≥44px tap target, UI-SPEC Spacing).
- Colors are **data-semantic, not accent chrome**: marked `#22C55E`, unmarked `#17171F`/`#2A2A34` border — copy the exact hexes above.

---

### `packages/app/src/games/GamesView.tsx` (MODIFY — replace the stub)

**Analog:** itself. Replace the **disabled teaser block (lines 42-56)** with the Deal screen (3 vibe buttons = deal, D-01) + draft `<BingoBoard>` + `<FillMeter>` + swap sheet. **Keep** the `useLiveQuery` source (line 33), the replay list (lines 59-83), and the empty state (76-83) unchanged.

**liveQuery source pattern to keep** (`GamesView.tsx:32-34`):
```tsx
// Dexie is the single source of truth — a newly-locked card appears live.
const cards = useLiveQuery(() => db.bingoCards.toArray());
const hasCards = cards != null && cards.length > 0;
```

**Stub to delete** (lines 42-56) — the disabled `copy.teaserAffordance` button. The 3 vibe buttons replace it; never a blank grid (D-01).

Container/copy conventions to preserve: `mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-8 pb-16` (line 37 — plain `pt-8`, NO top safe-area inset here, per the doubled-inset note lines 15-18), all strings from `config.copy.games`.

---

### `packages/app/src/games/DealScreen.tsx` (NEW — 3 vibe buttons ARE the deal, D-01)

**Analog:** `PreShowLauncher.tsx` — the single-action CTA idiom. Each vibe button is a big one-thumb action that immediately deals (like Start Show immediately starts).

**CTA button pattern to mirror** (`PreShowLauncher.tsx:32-37`):
```tsx
<button onClick={() => void startShow()}
  className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-[20px] font-semibold text-surface">
  <Play size={22} />{copy.startCta}
</button>
```

**Adapt:** three buttons ("Deal Chill" / "Deal Balanced" / "Deal Glory-hunter"), each with a `text-[14px] text-text-muted` gamble hint below (UI-SPEC Typography Label role). On tap → `deal(seed, vibe, ctx, dex, corpusVer)` (core, shipped) then `saveDraftCard(row)` (`db.ts:485`). NOTE: accent gold fill is a **sanctioned use** (PreShowLauncher comment lines 9-10) but UI-SPEC reserves accent tightly — use `bg-elevated` cards for the buttons, accent only for optional title emphasis.

**Draft persist call** (`db.ts:485-499`) — `saveDraftCard` overwrites the same `cardId==sessionId` row in place (reshuffle = new seed, same row), and THROWS if finalized/locked (reshuffle-rejected, D-10). Do not mint ids in core.

---

### `packages/app/src/games/SwapSheet.tsx` (NEW — sectioned bottom sheet, D-02)

**Analog:** `packages/app/src/show/SearchSheet.tsx` + `packages/app/src/games/CatchUpSheet.tsx` — both reuse the app `<Sheet>` pattern + the fuse.js catalog search wrapper. The swap-sheet Search section reuses the **same** `searchCatalog` wrapper.

**Fuzzy search reuse:** `packages/core/src/search/search-catalog.ts` (`searchCatalog`, exported via `@guezzer/core`) — same wrapper CatchUpSheet's manual search uses (D-04 precedent). Do NOT build a new search.

**Cover-art reuse (D-02 — RESOLVED, already bundled, do NOT build):**
- Album chips → `coverUrlFor(slug)` (`packages/app/src/dex/covers.ts`) — `slug` = last path segment of `albumUrl`.
- Model-bucketed Song chips → `coverUrlForSong(songId)` (`packages/app/src/dex/song-cover.ts`) — **degrade to a text chip only when it returns `null`** (bucket/Covers songs with no card album).
- Event chips → emoji/text (no cover).

**Sections (fixed order, D-02):** Events → Albums → Songs (grouped "Likely"/"A stretch") → Search. Candidates show **only** their fire-rate % (D-05), bust-out prefixed 🌟. Items already on the card are **greyed/deduped** (D-04) so no dead duplicate square. Vibe label flips to "Custom" on deviation (D-04).

---

### `packages/app/src/games/FillMeter.tsx` (NEW — bar + ~marks + caption, D-11/D-12)

**Analog:** RecapView win-badge chips (`RecapView.tsx:322-339`) for the presentation idiom (semantic-colored inline pills, escaped text). Fed by the NEW `estimateFill` (D-10).

**Presentation:** `bg-elevated` track (`#17171F`), bar `#22C55E` → turns **amber `#F59E0B`** (soft-warning, NEVER red) when `expectedMarks` drops below `lineLikelyThreshold` (D-12). Caption `{line} · blackout: {blackout}` (both odds always shown, D-11). Expected-marks figure "~11/15" uses `tabular-nums` (UI-SPEC Typography). Persistent above the board; guides never blocks (D-12).

---

### `packages/app/src/games/bingoReplay.ts` (MODIFY — add live sibling, do NOT fork)

**Analog:** itself — `replayCard` (`bingoReplay.ts:51-79`). Add a `deriveLiveBoard(card, liveEntries, ctx, liveCaughtSnapshot)` sibling that reuses the SAME reindex, but takes the **LIVE (unlocked, growing) trail + LIVE dex snapshot** (not the frozen `row.caughtSnapshot`). This preserves `live == replay == catch-up`.

**Reindex + fold to reuse verbatim** (`bingoReplay.ts:59-76`) — the two load-bearing correctness points:
```typescript
// (1) 0-based CONTIGUOUS reindex — opener = index 0 (mark.ts hard-codes this)
const sorted = [...entries].sort((a, b) => a.position - b.position);
const trail = sorted.map((e, index) => ({ songId: e.songId, position: index, isPlaceholder: e.isPlaceholder }));
const songNameByPosition = new Map(sorted.map((e, index) => [index, e.songName]));

const ctx = buildBingoContext(matrix, archive, rarity, albums);   // memoize this
// (2) caught-set: FROZEN for replay — but PARAMETERIZE it so the live board can pass the LIVE dex
const caughtSnapshot = new Set(row.caughtSnapshot);
const marked = deriveMarks(row.card, trail, ctx, caughtSnapshot);
const wins = detectWins(marked);
```
**Pitfall (RESEARCH §1):** do NOT freeze the live board's snapshot or thaw replay's — parameterize the snapshot explicitly per call site. **Pitfall (§2):** reuse this exact reindex or the opener mis-marks. **Memoize `buildBingoContext`** (module cache, like `rarityIndex`) — do not rebuild per render.

---

### `packages/app/src/components/BingoCelebration.tsx` (NEW — app-wide emitter, D-16/D-18/D-21)

**Analog:** `packages/app/src/components/BackupToast.tsx` — clone the module-level emitter + App-level host pattern **exactly**. This is why celebrations fire over any tab and survive the ShowView→RecapView unmount.

**Emitter pattern to replicate** (`BackupToast.tsx:24-41`):
```typescript
let listener: (() => void) | null = null;               // single active listener
export function showBingoCelebration(payload): void { listener?.(payload); }
export function subscribeBingoCelebration(fn): () => void {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}
```

**Host pattern to replicate** (`BackupToast.tsx:46-82`):
```tsx
export function BingoCelebration() {
  const [visible, setVisible] = useState(false);
  const ref = useBottomOverlayHeightRegistration("bingoToast", visible);   // never intercepts taps
  useEffect(() => {
    const unsub = subscribeBingoCelebration(() => { setVisible(true); /* auto-dismiss timer */ });
    return unsub;
  }, []);
  if (!visible) return null;
  return <div ref={ref} role="status" style={{ zIndex: config.ui.z.toast, … }}>…</div>;
}
```
Host `<BingoCelebration/>` at **App level** (sibling of `<BackupToast/>`/`<UpdateToast/>`), NOT dialog-owned.

**Three tiers (D-18):** mark-toast + badge-toast use `config.ui.z.toast` (20). **Supernova** = a new `celebration` z-tier (add to `config.ui.z`; A5 recommends `18` — above page 15, below toast 20, strictly below `sheetScrim` 40), `pointer-events-none`, auto-fades ~2-3s (D-17 — NEVER blocks logging).

**Fire on TRANSITION, not presence (RESEARCH Pitfall 3):** diff previous vs. current derived wins/near-miss in a `useRef`; fire only on the 0→1 edge. Enforce ≤2 big moments/show (first line + blackout only) with a per-session guard.

**Reduced-motion (D-20):** reuse `useReducedMotion` from `motion/react` (see below) — supernova becomes a static full-bloom badge crossfade, stamps become opacity-only.

---

### `packages/app/src/show/ShowView.tsx` (MODIFY — peek strip + Start-Show nudge/lock)

**Analog:** itself. Three funnels already exist and re-derive on every log via liveQuery.

**logSong funnel** (`ShowView.tsx:324/339/355`) — the trail-grow that feeds `deriveMarks`. The live board/peek strip re-derive off this; **no new call needed**, just add a liveQuery on `bingoCards`:
```tsx
void logSong(sessionId, { … });   // grows trackedEntries → useLiveQuery re-derives (marks NEVER stored)
```

**Peek-strip slot (D-21):** add an **in-flow** slot near `CometTrail` (`ShowView.tsx:472`) — NOT fixed, sits in the show column, never over the FAB/orbit:
```tsx
<CometTrail entries={session.entries} onNodeTap={setTrailNode} />   // line 472 — add <BingoPeekStrip/> adjacent
```
Render only when a locked card exists for the session. Tap → route to `#/games` via `useHashRoute` (simplest default, A6).

**Reduced-motion already imported** (`ShowView.tsx:29`, `:87`): `import { useReducedMotion } from "motion/react"` → `const reduce = useReducedMotion() ?? false`. Reuse for all D-20 fallbacks.

**Start-Show lock + nudge (D-07/D-08):** the trigger is `startShow()` in `PreShowLauncher.tsx:32`. On Start Show:
- if a draft `bingoCards` row exists → `lockCard(sessionId, caughtSongIds)` (`db.ts:525`), passing the frozen `deriveDex(...).perSong.keys()`.
- if none → fire the dismissible "Deal a bingo card for tonight?" nudge (D-08); `[Deal]` routes to `#/games`, `[Not now]` dismisses for this show (D-09, no permanent suppression).

**`lockCard` contract to drive** (`db.ts:525-538`) — idempotent, no-op if no card, first freeze wins:
```typescript
export async function lockCard(sessionId, caughtSongIds): Promise<void> {
  const card = await db.bingoCards.where("sessionId").equals(sessionId).first();
  if (!card) return;                    // card-less Start Show — safe no-op (D-09)
  if (card.lockedAt != null) return;    // idempotent — first freeze wins (D-10)
  await db.bingoCards.update(card.cardId, { lockedAt: Date.now(), caughtSnapshot: caughtSongIds });
}
```

---

### `packages/app/src/show/BingoPeekStrip.tsx` (NEW — in-flow thumbnail, D-21)

**Analog:** `CometTrail` in-flow slot (in-column, not fixed) + `<BingoBoard>` (thumbnail render). Appears only when a card is locked/active. Hosts the D-14 one-away banner + the D-16 mark-toasts. Tap → expand (route `#/games`). Use `bg-elevated` (`#17171F`) card, `min-h-11` tap zone.

---

### `packages/app/src/dex/RecapView.tsx` (MODIFY — use `<BingoBoard>` + share trigger, D-23)

**Analog:** itself. Two changes:
1. Replace the inline board (`RecapView.tsx:344-381`) with `<BingoBoard marked={bingo.marked} wins={bingo.wins} songNameByPosition={bingo.songNameByPosition} />` (read-only, no tap).
2. Add the bingo **share trigger** inside the existing bingo section — auto-offer at the win, open `ShareCardSheet` with bingo-scoped data.

**Share wiring already present to reuse** (`RecapView.tsx:29/56/107-114`):
```tsx
import { ShareCardSheet } from "./ShareCardSheet.tsx";     // line 29
const [shareOpen, setShareOpen] = useState(false);          // line 56
const shareData = useMemo(() => { … buildRecapShareStats(…) }, […]);  // lines 107-114 — add a bingo shareData memo alongside
```

**`bingo` memo to reuse as-is** (`RecapView.tsx:120-142`) — already re-derives the frozen board via `replayCard`; the share `ShareCardData` assembles from `bingo.marked` + `bingo.wins` + show date/venue (D-22, trophy not spreadsheet).

---

### `packages/app/src/dex/shareCard.ts` + `ShareCardSheet.tsx` (MODIFY — add "bingo" scope, D-22)

**Analog:** itself — `drawShareCard` already branches on `data.scope` (`shareCard.ts:99`, branch at `:117`). `ShareCardData` is a discriminated union (`packages/core/src/dex/share-stats.ts:63/78/86`: `scope: "collection" | "show"`). **Add a third `scope: "bingo"` member** to that core union + a branch (or sibling `drawBingoShareCard`) in `drawShareCard`.

**Scope-branch pattern to extend** (`shareCard.ts:99-119`):
```typescript
export function drawShareCard(ctx, data, { width, height }): void {
  ctx.fillStyle = COLOR.bg; ctx.fillRect(0, 0, width, height);                 // galaxy full-bleed
  centerText(ctx, cardCopy.wordmark, cx, height * 0.10, 68, config.share.wordmarkGold);  // wordmark
  if (data.scope === "collection") { … }
  // ADD: if (data.scope === "bingo") { paint 4×4 board + win badges + date + venue }
}
```
Reuse `centerText`/`leftText`/`rightText` helpers (`:45-91`), `COLOR`/`FONT_STACK` (`:24-32`), the same galaxy aesthetic + wordmark. Content = visual trophy ONLY (stamped squares + free center + win badges + date + venue) — NOT the per-square "lit by" detail (that stays the in-app replay payoff). Assemble the bingo `ShareCardData` in a **pure core helper** (song/venue names escaped; canvas `fillText` is inert re XSS, T-06-21).

---

## Shared Patterns

### Marks DERIVED, never stored (Phase-14 D-23) — the load-bearing invariant
**Source:** `mark.ts` header + `bingoReplay.ts:1-18`
**Apply to:** BingoBoard, GamesView live board, BingoPeekStrip, celebration diffing, RecapView
Never write a mark or win to Dexie. The board is a pure function of `(card, trail, ctx, caughtSnapshot)`; every `useLiveQuery` re-render re-derives via the ONE shared `bingoReplay` adapter. Detect celebration transitions by diffing previous vs. current in a `useRef` — that diff fires a celebration exactly once. Breaking this breaks `live == replay == catch-up`.

### Config injection with a default (core purity)
**Source:** `deriveMarks`/`deal` signature discipline; `estimate.ts` follows it
**Apply to:** `estimateFill`, `nearMiss`
`cfg: typeof config = config` as the last param. No DOM, no DB, no wall-clock, no entropy in `packages/core`.

### App-wide non-blocking toast (module emitter + App-level host)
**Source:** `BackupToast.tsx:24-82`
**Apply to:** mark-toast, badge-toast, supernova (BingoCelebration)
```typescript
let listener = null;
export function showX() { listener?.(); }
export function subscribeX(fn) { listener = fn; return () => { if (listener === fn) listener = null; }; }
// host at App level, role="status", config.ui.z.*, useBottomOverlayHeightRegistration so it never intercepts taps
```

### Reduced-motion (D-20)
**Source:** `OrbitStage.tsx:22/119`, `ShowView.tsx:29/87`
**Apply to:** every stamp/toast/supernova/one-away-glow
`import { useReducedMotion } from "motion/react"` → `const reduce = useReducedMotion() ?? false`. There is NO custom hook file. Reduced path = static full-bloom badge crossfade + opacity-only stamps (first-class equivalent, not a degraded burst).

### Semantic colors are data, never accent chrome (the app's B3 principle)
**Source:** `RecapView.tsx:37-40` (`RING_COLOR`), `:359/362` board hexes
**Apply to:** BingoBoard, FillMeter, stamps, win badges
Marked/caught `#22C55E`; soft-warning amber `#F59E0B` (never red); accent `#f2c14e` reserved for focus rings + the single one-away glow + blackout crown + optional title only. Word/glyph always renders (WCAG 1.4.1) — color never sole carrier.

### Escaped React text for all kglw-derived strings (T-06-21)
**Source:** every analog header (GamesView :14-15, RecapView :16, shareCard branch)
**Apply to:** board labels, toasts, share card, peek strip
Render song/venue names as React text; canvas `fillText` is inert; NEVER `dangerouslySetInnerHTML`.

### Config single-source (CLAUDE.md)
**Source:** `config.bingo` (`config.ts:363`), `config.copy.games` (`:998`), `config.ui.z`
**Apply to:** all new constants/copy/z-tiers
No inline literals — `config.bingo.fireRates/eraShowCount/fillMeter`, `config.copy.games.bingo.*`, `config.ui.z.celebration`.

## No Analog Found

None. Every new file has a shipped analog. The only genuinely NEW logic is the D-10 heuristic **formula** inside `estimate.ts` (consume-once discount + likelihood bands) — that is new *math*, not a new *pattern*; the file structure, purity discipline, geometry constants, and validation-test harness all clone `wins.ts` / `calibrate.test.ts`. It is MEDIUM confidence until the `estimate.test.ts` vs-Monte-Carlo assertion is green (the phase's trust gate).

## Metadata

**Analog search scope:** `packages/core/src/bingo/`, `packages/core/src/config.ts`, `packages/core/src/dex/share-stats.ts`, `packages/core/src/search/`, `packages/app/src/games/`, `packages/app/src/show/`, `packages/app/src/dex/`, `packages/app/src/components/`
**Files scanned:** ~18 read/grepped (wins, bingoReplay, BackupToast, GamesView, RecapView, shareCard, config §bingo, OrbitStage, PreShowLauncher, db.ts, ShowView grep, share-stats/searchCatalog/covers locations)
**Pattern extraction date:** 2026-07-21
