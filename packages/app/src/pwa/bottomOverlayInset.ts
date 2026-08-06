import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { config } from "../config";

/**
 * Root-cause fix (debug session: start-show-not-clickable). AppShell's
 * `<main>` used to reserve a single static tab-bar height for the fixed
 * BottomTabBar only. Any OTHER fixed overlay stacked above it (InstallBanner,
 * UpdateToast) renders at its own real content height, which nothing
 * accounted for. InstallBanner's iOS multi-step instructions in particular
 * render well over a tab bar's height on a phone viewport, so the banner
 * silently covered — and intercepted taps on — page content underneath
 * (observed: PreShowLauncher's "Start Show" button was untappable).
 *
 * This is a tiny external store: overlay components pinned above the tab bar
 * measure their OWN real rendered height via
 * `useBottomOverlayHeightRegistration` and register it here; AppShell
 * subscribes via `useBottomOverlayInset` and the total reaches `<main>`
 * through `--gz-overlay-inset` on the FOUND-02 owner's ladder
 * (`src/layout/bottomSpace.ts`). Reserved space then always matches whatever
 * is actually on screen — no static estimate to fall out of sync with copy,
 * locale, or font-size changes again.
 *
 * Phase 21 (plan 21-10) correction — every registered overlay now composes
 * its offset from `var(--gz-chrome-reserve)`, which already carries the
 * safe-area bottom inset. The three toasts that used to set their own
 * `paddingBottom` from a raw safe-area bottom read no longer do, so the
 * `offsetHeight` measured below no longer includes a safe-area inset:
 * `--gz-overlay-inset` reserves the overlay's REAL rendered height rather
 * than one inset more than it. The reserve on scrolling routes therefore got
 * SMALLER by one inset while one of those toasts is visible — the correction,
 * re-checked on device (21-13 UAT test 2) to confirm nothing became covered.
 *
 * Phase 22 (folded todo CR-01) — ORDERING. Everything above measures heights but
 * this store had no ordering concept at all: every registered overlay pinned
 * itself to the same `bottom: var(--gz-chrome-reserve)`, so two simultaneously
 * visible overlays painted ON TOP OF each other while `--gz-content-reserve`
 * reserved the SUM of both boxes. The reserve was therefore safe (nothing got
 * covered) but wrong (it over-reserved by the height of the shorter overlay).
 *
 * The fix keeps the single-owner shape of `layout/bottomSpace.ts`: the DECLARED
 * ORDER lives in `config.ui.BOTTOM_OVERLAY_ORDER` (bottom-most first, with the
 * per-key rationale recorded beside it) and the ARITHMETIC lives here, in
 * `offsetBelow(id)` / `useBottomOverlayOffset(id)`. Each overlay renders at
 * `bottom: calc(var(--gz-chrome-reserve) + <offsetBelow(id)>px)`, so the boxes
 * genuinely stack and the sum `<main>` already reserves BECOMES the real
 * occupied height. `layout/bottomSpace.ts` needs no change at all.
 *
 * Three properties keep this safe — do not "improve" any of them away:
 *   1. NO FEEDBACK LOOP. Offset change -> re-render -> `ResizeObserver`
 *      re-measure -> same `offsetHeight` -> `setBottomOverlayHeight` early-returns
 *      on an unchanged value -> no notify. The early return below is load-bearing.
 *   2. `<main>` NEEDS NO CHANGE (see above).
 *   3. EVERY HOOK RETURNS A NUMBER, never an object. React 19 warns "The result
 *      of getSnapshot should be cached to avoid an infinite loop" for a freshly
 *      allocated snapshot; returning a primitive makes that failure unreachable.
 *      Do not widen these to `{ offset, total }`.
 */

const heights = new Map<string, number>();
const listeners = new Set<() => void>();
let snapshot = 0;

/**
 * Per-id cumulative-offset cache (CR-01). Populated lazily on first read and
 * recomputed wholesale inside `notify()`, so `getSnapshot` never computes — it
 * returns a value that is byte-stable between notifies, which is what
 * `useSyncExternalStore` requires.
 */
const offsets = new Map<string, number>();

function recompute(): number {
  let total = 0;
  for (const h of heights.values()) total += h;
  return total;
}

/**
 * Insertion-ordered ranks for ids that are NOT in the declared order (WR-07).
 * Seeded on first `rankOf` miss and cleared by the test-reset hatch.
 */
const unknownRanks = new Map<string, number>();

/**
 * Rank of `id` in the declared bottom-most-first order. An UNKNOWN id ranks
 * last (topmost) rather than throwing — an overlay that forgot to declare its
 * position must still render, above everything, rather than crash the app. The
 * omission is caught by the source guard in `test/bottomOverlayInset.test.tsx`,
 * which is where a missing declaration is supposed to hurt.
 *
 * 22-REVIEW WR-07 — undeclared ids get DISTINCT ranks, not one shared one.
 * Returning a flat `order.length` for every unknown id collapsed them all onto
 * the same rank, and `offsetBelow`'s sum uses a STRICT `<`: two simultaneously
 * visible undeclared overlays therefore got IDENTICAL offsets and painted on top
 * of each other while `--gz-content-reserve` reserved the sum of both boxes —
 * verbatim the pre-CR-01 defect this whole feature removes. Handing each unknown
 * id its own rank in first-seen order keeps the fallback deterministic and keeps
 * the boxes stacking. The source guard is still the real mitigation; this only
 * stops the fallback from re-introducing the bug when the guard is evaded (it
 * matches string literals at the call site, so an id passed through a variable or
 * built by template literal slips past it).
 */
function rankOf(id: string): number {
  const order = config.ui.BOTTOM_OVERLAY_ORDER as readonly string[];
  const index = order.indexOf(id);
  if (index !== -1) return index;
  const known = unknownRanks.get(id);
  if (known !== undefined) return known;
  const rank = order.length + unknownRanks.size;
  unknownRanks.set(id, rank);
  return rank;
}

/**
 * Summed height of every REGISTERED overlay that sits BELOW `id` in the declared
 * order — i.e. how far up from `--gz-chrome-reserve` this overlay must sit so it
 * does not overlap the ones beneath it. Returns 0 when nothing is below.
 */
export function offsetBelow(id: string): number {
  const rank = rankOf(id);
  let total = 0;
  for (const [otherId, h] of heights) {
    if (rankOf(otherId) < rank) total += h;
  }
  return total;
}

function notify(): void {
  snapshot = recompute();
  // Recompute every offset that has ever been read BEFORE fanning out, so each
  // subscriber's getSnapshot sees the new value in this same notify.
  for (const id of offsets.keys()) offsets.set(id, offsetBelow(id));
  for (const listener of listeners) listener();
}

/** Cached `offsetBelow`, seeded on first read. See `offsets` above. */
function getOffsetSnapshot(id: string): number {
  const cached = offsets.get(id);
  if (cached !== undefined) return cached;
  const value = offsetBelow(id);
  offsets.set(id, value);
  return value;
}

/** Registers (or clears, when `px <= 0`) the measured height of overlay `id`. */
export function setBottomOverlayHeight(id: string, px: number): void {
  const rounded = Math.max(0, Math.round(px));
  if (rounded <= 0) {
    if (!heights.has(id)) return;
    heights.delete(id);
    notify();
    return;
  }
  if (heights.get(id) === rounded) return;
  heights.set(id, rounded);
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return snapshot;
}

function getServerSnapshot(): number {
  return 0;
}

/**
 * Total registered extra height (px) that AppShell must add on top of its
 * base BottomTabBar reservation so no other fixed-bottom overlay ever covers
 * page content.
 */
export function useBottomOverlayInset(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * How far above `--gz-chrome-reserve` overlay `id` must render so it stacks on
 * top of the visible overlays declared BELOW it instead of overlapping them
 * (CR-01). The call site composes
 * ``bottom: `calc(var(--gz-chrome-reserve) + ${offset}px)` `` — the offset is
 * ADDITIVE to the chrome reserve, never a replacement for it, so every overlay
 * keeps following the plan-22-05 chrome collapse for free (D-15).
 *
 * Returns a NUMBER, deliberately. React 19 reports "The result of getSnapshot
 * should be cached to avoid an infinite loop" whenever `getSnapshot` allocates
 * a fresh object; a primitive compares by value under `Object.is`, so that
 * failure mode is unreachable here. Do not widen the return type.
 */
export function useBottomOverlayOffset(id: string): number {
  // Only the id varies, and the snapshot itself is cached module-side, so this
  // is stable per id — a new closure per render would still be correct (the
  // value is a primitive) but would make React re-read on every render.
  const getIdSnapshot = useCallback(() => getOffsetSnapshot(id), [id]);
  return useSyncExternalStore(subscribe, getIdSnapshot, getServerSnapshot);
}

/**
 * Measures an overlay's own rendered height (via `ResizeObserver`, so it
 * stays correct across copy/layout changes) and registers it in the shared
 * store while `visible` is true; always unregisters on hide/unmount. Attach
 * the returned ref to the overlay's fixed-position root element.
 */
export function useBottomOverlayHeightRegistration(
  id: string,
  visible: boolean,
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible) {
      setBottomOverlayHeight(id, 0);
      return;
    }
    const el = ref.current;
    if (!el) {
      setBottomOverlayHeight(id, 0);
      return;
    }

    const measure = () => setBottomOverlayHeight(id, el.offsetHeight);
    measure();

    // jsdom (unit tests) has no ResizeObserver — the initial measure() above
    // still runs; only the "re-measure on content resize" behavior is skipped.
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }

    return () => {
      observer?.disconnect();
      setBottomOverlayHeight(id, 0);
    };
  }, [id, visible]);

  return ref;
}

/** Test-only escape hatch to reset module state between test cases/files. */
export function __resetBottomOverlayInsetForTests(): void {
  heights.clear();
  snapshot = 0;
  offsets.clear();
  unknownRanks.clear();
  listeners.clear();
}
