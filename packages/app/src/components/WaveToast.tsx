/**
 * Phase-20 (PRES-02/06, D-09/D-10/D-11/D-12) received-wave/reaction toast host —
 * cloned from `BingoCelebration`'s module-emitter + App-level host idiom
 * (RESEARCH A5). It renders NOTHING until `showWaveToast(...)` fires, then pops
 * an app-wide, `pointer-events-none` toast at `config.ui.z.toast` (20) naming the
 * sender and their emoji. Mounted ONCE in `App.tsx` (D-11) so a wave fires over
 * ANY tab, exactly like `BackupToast`/`BingoCelebration`.
 *
 * THE ONE DEPARTURE from BingoCelebration (D-10): where the celebration host is
 * latest-wins, this host buffers into a bounded FIFO ref and drains it
 * one-at-a-time — each item shown for `config.presence.TOAST_MS`, with
 * `config.presence.DRAIN_GAP_MS` between pops — so a flurry of waves reads as
 * distinct pings (`Matt 🔥`, `Sam 🦎`) rather than a clobber. Over-cap emits
 * (buffer already holds `config.presence.QUEUE_CAP`) are DROPPED — this bounds
 * on-screen flooding regardless of send rate (T-20-04; D-08 sets no send limit).
 *
 * Trust boundary (V5 / T-20-02): the sender NAME is re-resolved from the trusted
 * `getSyncState().friends` store by the payload's `from` userId — NEVER read off
 * the payload. An unknown `from` renders a neutral escaped fallback, never a
 * crash. Every sender/emoji string is ordinary escaped React text (T-20-06 —
 * never `dangerouslySetInnerHTML`).
 *
 * Motion mirrors BingoCelebration: `useReducedMotion()`-gated, the reduced path
 * opacity-only (no translate); `AnimatePresence` keyed on a monotonic id so a
 * repeat emit re-triggers the enter; height registered via
 * `useBottomOverlayHeightRegistration` so the toast never covers or intercepts
 * taps on the live logging loop (the sacred D-17 rule).
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { config } from "../config.ts";
import { IdentityGlyph } from "../dex/FriendRow.tsx";
import { useBottomOverlayHeightRegistration } from "../pwa/bottomOverlayInset";
import { getSyncState } from "../sync/progressSync.ts";

const presence = config.copy.presence;
const { QUEUE_CAP, TOAST_MS, DRAIN_GAP_MS } = config.presence;

/**
 * Neutral escaped fallback for a wave whose `from` is not (yet) in the trusted
 * friends store — a valid transient case (a friend who joined presence before
 * the next progress pull). Kept local: it is a host-internal safety label, not a
 * user-tunable copy string, and never carries untrusted input.
 */
const UNKNOWN_SENDER = "Someone";

/**
 * An inbound wave to display. `from` is the sender's userId (the name is resolved
 * from the trusted store, never trusted off this payload); `targeted` drives the
 * personal `waved at you` + `to you` emphasis (PRES-05).
 */
export interface WaveToastPayload {
  from: string;
  emoji: string;
  targeted: boolean;
}

/** Single active listener — the mounted `<WaveToast/>` subscribes here. */
let listener: ((payload: WaveToastPayload) => void) | null = null;

/**
 * Emit a received wave. Called by the presence engine's wave listener. A no-op if
 * no host is mounted (e.g. a unit test that renders no host).
 */
export function showWaveToast(payload: WaveToastPayload): void {
  listener?.(payload);
}

/** Subscribe the mounted host to emits; returns an unsubscribe. */
export function subscribeWaveToast(
  fn: (payload: WaveToastPayload) => void,
): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/** The currently-shown toast (monotonic id re-triggers the AnimatePresence enter). */
interface ShownToast {
  id: number;
  payload: WaveToastPayload;
}

/** Resolve the sender display name from the TRUSTED store — never from the payload (V5). */
function resolveSenderName(from: string): string {
  return (
    getSyncState().friends.find((f) => f.userId === from)?.displayName ??
    UNKNOWN_SENDER
  );
}

export function WaveToast() {
  const reduce = useReducedMotion() ?? false;

  const [shown, setShown] = useState<ShownToast | null>(null);

  // Registered so AppShell reserves the toast's real height — it never covers or
  // intercepts taps on the live logging loop underneath (the sacred D-17 rule).
  const toastRef = useBottomOverlayHeightRegistration("waveToast", shown != null);

  // Bounded FIFO buffer (D-10): peek-don't-shift while showing, so the buffer's
  // length (incl. the item on screen) is the true cap for the over-cap DROP.
  const queue = useRef<WaveToastPayload[]>([]);
  const draining = useRef(false);
  const idRef = useRef(0);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Drain the head of the buffer: show it for TOAST_MS, then after DRAIN_GAP_MS
    // shift it off and recurse — one-at-a-time, distinct pops.
    function showNext(): void {
      const next = queue.current[0];
      if (!next) {
        draining.current = false;
        setShown(null);
        return;
      }
      const id = ++idRef.current;
      setShown({ id, payload: next });
      showTimer.current = setTimeout(() => {
        setShown(null);
        gapTimer.current = setTimeout(() => {
          queue.current.shift();
          showNext();
        }, DRAIN_GAP_MS);
      }, TOAST_MS);
    }

    const unsubscribe = subscribeWaveToast((payload) => {
      // Over-cap DROP: the buffer already holds QUEUE_CAP items (T-20-04).
      if (queue.current.length >= QUEUE_CAP) return;
      queue.current.push(payload);
      if (!draining.current) {
        draining.current = true;
        showNext();
      }
    });

    return () => {
      unsubscribe();
      if (showTimer.current) clearTimeout(showTimer.current);
      if (gapTimer.current) clearTimeout(gapTimer.current);
      queue.current = [];
      draining.current = false;
    };
  }, []);

  const name = shown ? resolveSenderName(shown.payload.from) : "";
  const line = shown
    ? shown.payload.targeted
      ? presence.targeted(name, shown.payload.emoji)
      : presence.broadcast(name, shown.payload.emoji)
    : "";

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown.id}
          ref={toastRef}
          role="status"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed inset-x-0 bottom-16 flex items-center gap-2 border-t border-hairline bg-elevated px-4 py-4"
          style={{ zIndex: config.ui.z.toast }}
        >
          {/* Sender glyph — deterministic identity color + escaped initials (D-09). */}
          <IdentityGlyph userId={shown.payload.from} displayName={name} />

          {/* All sender/emoji text is escaped React text — never dangerouslySetInnerHTML. */}
          <p className="min-w-0 flex-1 truncate text-base font-semibold leading-normal text-text-primary">
            {line}
          </p>

          {/* Personal `to you` emphasis for a targeted wave (PRES-05). */}
          {shown.payload.targeted && (
            <span className="shrink-0 text-[13px] font-semibold leading-none text-text-muted">
              {presence.toYou}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
