/**
 * Phase-16 (BINGO-05, D-16/D-17/D-18) Gizz-Bingo celebration layer — the
 * three-tier payoff host, cloned from `BackupToast`'s module-emitter + App-level
 * host idiom (RESEARCH A5). It renders NOTHING until `showBingoCelebration(...)`
 * fires, then paints the tier the payload names:
 *
 *   1. `mark`      → the "✦ {song} lit {square}!" auto-mark toast (D-16).
 *   2. `badge`     → a medium "✨ …" badge toast for four-corners / X / a
 *                    subsequent line (D-18).
 *   3. `supernova` → the big first-line / blackout overlay (D-17): a
 *                    `pointer-events-none` full-screen bloom at
 *                    `config.ui.z.celebration` (18), STRICTLY below `sheetScrim`
 *                    (40), auto-fading inside the 2–3s budget. The live logging
 *                    loop keeps every tap THROUGH it — the loop is sacred (D-17).
 *
 * Why a module-level emitter + App-level host (not props/context): a celebration
 * must survive the `ShowView → RecapView` unmount and fire over ANY tab, exactly
 * like `BackupToast`. The driver (`useBingoCelebrations`) diffs win/mark
 * transitions and calls the emitter; this host is the only subscriber.
 *
 * Motion is gated on `useReducedMotion() ?? false` (OrbitStage idiom): the
 * reduced-motion supernova is a STATIC full-bloom headline crossfade — no
 * particles, scale, or translate (D-20) — and reduced toasts are opacity-only.
 * All song/square/headline strings are ordinary escaped React text (T-16-10 —
 * never `dangerouslySetInnerHTML`).
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { config } from "../config";
import { ExploreBackground } from "../explore/ExploreBackground.tsx";
import { useBottomOverlayHeightRegistration } from "../pwa/bottomOverlayInset";

const bingo = config.copy.games.bingo;
const {
  MARK_TOAST_MS,
  BADGE_TOAST_MS,
  SUPERNOVA_MS,
  SUPERNOVA_BLOOM_MS,
  SUPERNOVA_FADE_MS,
  SUPERNOVA_ORB_COUNT,
  SUPERNOVA_ORB_TRAVEL_PX,
} = config.ui.celebration;

/** Medium-badge kinds (D-18), keyed to the verbatim copy strings. */
export type BingoBadgeKind = "fourCorners" | "x" | "anotherLine";
/** Big-tier supernova kinds (D-17) — the ONLY two big moments per show. */
export type BingoSupernovaKind = "firstLine" | "blackout";

/**
 * The celebration payload, discriminated on `tier`. `mark` carries the already
 * kglw-derived song + square strings (resolved by the driver from
 * `songNameByPosition` + the square label); `badge`/`supernova` carry only the
 * closed kind vocabulary — this host owns the copy.
 */
export type BingoCelebrationPayload =
  | { tier: "mark"; song: string; square: string }
  | { tier: "badge"; kind: BingoBadgeKind }
  | { tier: "supernova"; kind: BingoSupernovaKind };

const badgeLabels: Record<BingoBadgeKind, string> = {
  fourCorners: bingo.badgeFourCorners,
  x: bingo.badgeX,
  anotherLine: bingo.badgeAnotherLine,
};

const supernovaHeadlines: Record<BingoSupernovaKind, string> = {
  firstLine: bingo.supernovaFirstLine,
  blackout: bingo.supernovaBlackout,
};

/** Single active listener — the mounted `<BingoCelebration/>` subscribes here. */
let listener: ((payload: BingoCelebrationPayload) => void) | null = null;

/**
 * Emit a celebration. Called by `useBingoCelebrations` on a 0→1 win/mark
 * transition. A no-op if no host is mounted (e.g. a unit test that renders the
 * driver reducer only).
 */
export function showBingoCelebration(payload: BingoCelebrationPayload): void {
  listener?.(payload);
}

/** Subscribe the mounted host to emits; returns an unsubscribe. */
export function subscribeBingoCelebration(
  fn: (payload: BingoCelebrationPayload) => void,
): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/** The bottom auto-mark / badge toast state (latest-wins, BackupToast-style). */
interface ToastState {
  /** Monotonic id so a repeat same-tier emit re-triggers the AnimatePresence enter. */
  id: number;
  text: string;
}

/** The supernova overlay state. */
interface SupernovaState {
  id: number;
  kind: BingoSupernovaKind;
}

/**
 * The orb-burst: `SUPERNOVA_ORB_COUNT` colored particles radiating from centre
 * (reuses the OrbitStage `motion.div` orb idiom, NOT a canvas draw). Rendered
 * ONLY on the non-reduced path — the reduced supernova is a static crossfade
 * with zero particles (D-20). Decorative + `aria-hidden`; the container is
 * already `pointer-events-none`, so it never blocks a tap.
 */
function SupernovaOrbBurst() {
  const hues = Object.values(config.dex.tierColors);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {Array.from({ length: SUPERNOVA_ORB_COUNT }, (_unused, i) => {
        const angle = (i / SUPERNOVA_ORB_COUNT) * Math.PI * 2;
        const x = Math.cos(angle) * SUPERNOVA_ORB_TRAVEL_PX;
        const y = Math.sin(angle) * SUPERNOVA_ORB_TRAVEL_PX;
        return (
          <motion.span
            // Deterministic static list — index key is stable and safe.
            key={i}
            className="absolute block h-3 w-3 rounded-full"
            style={{ background: hues[i % hues.length] }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{ x, y, scale: 1, opacity: 0 }}
            transition={{
              // Burst travels over ~80% of the on-screen budget, easing out.
              duration: (SUPERNOVA_MS / 1000) * 0.8,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
  );
}

export function BingoCelebration() {
  const reduce = useReducedMotion() ?? false;

  const [toast, setToast] = useState<ToastState | null>(null);
  const [supernova, setSupernova] = useState<SupernovaState | null>(null);

  // Registered so AppShell reserves the toast's real height — it never covers or
  // intercepts taps on the page underneath (the log/predict path stays clear).
  const toastRef = useBottomOverlayHeightRegistration(
    "bingoCelebration",
    toast != null,
  );

  const idRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const superTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeBingoCelebration((payload) => {
      const id = ++idRef.current;
      if (payload.tier === "supernova") {
        setSupernova({ id, kind: payload.kind });
        if (superTimer.current) clearTimeout(superTimer.current);
        // Trigger the exit fade FADE_MS before the budget end so bloom + hold +
        // fade all land within SUPERNOVA_MS total on-screen time (the documented
        // ≤2.7s D-17 budget) — dismissing at SUPERNOVA_MS would append the fade
        // AFTER the budget (~3.5s). Clamp to 0 for safety.
        superTimer.current = setTimeout(
          () => setSupernova(null),
          Math.max(0, SUPERNOVA_MS - SUPERNOVA_FADE_MS),
        );
        return;
      }
      const text =
        payload.tier === "mark"
          ? bingo.autoMarkToast(payload.song, payload.square)
          : badgeLabels[payload.kind];
      const ms = payload.tier === "mark" ? MARK_TOAST_MS : BADGE_TOAST_MS;
      setToast({ id, text });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), ms);
    });
    return () => {
      unsubscribe();
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (superTimer.current) clearTimeout(superTimer.current);
    };
  }, []);

  return (
    <>
      {/* Bottom mark/badge toast — `toast` tier (20), app-wide, non-blocking. */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            ref={toastRef}
            role="status"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed inset-x-0 bottom-16 flex items-center border-t border-hairline bg-elevated px-4 py-4"
            // No safe-area paddingBottom here: the toast sits at `bottom-16`, ABOVE
            // the BottomTabBar (which already reserves the home-indicator inset), so
            // overriding paddingBottom with env(safe-area-inset-bottom) only made the
            // bottom padding smaller than `py-4`'s top — the text read as cut off.
            // Plain `py-4` gives even top/bottom padding.
            style={{ zIndex: config.ui.z.toast }}
          >
            <p className="text-base font-semibold leading-normal tabular-nums text-text-primary">
              {toast.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Supernova — `celebration` tier (18), STRICTLY below sheetScrim (40),
          `pointer-events-none` so the live logging loop is never blocked (D-17).
          It auto-fades inside the 2–3s budget. */}
      <AnimatePresence>
        {supernova && (
          <motion.div
            key={supernova.id}
            className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden"
            style={{ zIndex: config.ui.z.celebration } as CSSProperties}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: SUPERNOVA_FADE_MS / 1000 }}
          >
            {/* Galaxy backdrop reused from Explore (D-17); already `aria-hidden`
                + `pointer-events-none` + static under reduced-motion. */}
            <ExploreBackground />

            {/* Orb-burst only on the motion path (D-20 reduced = no particles). */}
            {!reduce && <SupernovaOrbBurst />}

            {/* The headline announces to AT (role="status"); the reduced path is a
                pure opacity crossfade, the motion path a bloom scale-in. */}
            <motion.p
              role="status"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              transition={{ duration: SUPERNOVA_BLOOM_MS / 1000, ease: "easeOut" }}
              className="relative rounded-md bg-elevated/80 px-6 py-4 text-center text-[28px] font-semibold leading-tight tracking-tight text-text-primary"
            >
              {supernovaHeadlines[supernova.kind]}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
