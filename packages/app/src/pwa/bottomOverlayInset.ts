import { useEffect, useRef, useSyncExternalStore } from "react";

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
 */

const heights = new Map<string, number>();
const listeners = new Set<() => void>();
let snapshot = 0;

function recompute(): number {
  let total = 0;
  for (const h of heights.values()) total += h;
  return total;
}

function notify(): void {
  snapshot = recompute();
  for (const listener of listeners) listener();
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
  listeners.clear();
}
