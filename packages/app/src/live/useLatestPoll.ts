/**
 * The single, gated, tolerant `latest` poll loop (SYNC-01 / SYNC-03 / D-06,
 * Phase 5 plan 05-04 Task 1). The app tier owns ONLY the lifecycle/timing here;
 * the fetch + validation + tolerance live in core `pollLatest` (plan 05-01).
 *
 * Etiquette contract (T-05-11, SYNC-01 — ≤1 request / 60s): exactly ONE
 * self-scheduling `setTimeout` is ever pending (RESEARCH Pattern 1). Never
 * `setInterval` — an interval fires on a fixed clock regardless of whether the
 * previous poll finished, so a slow response could overlap requests and burst
 * past the 60s floor. A self-rescheduling timeout guarantees the next request
 * is only ever armed AFTER the previous one settles, one at a time (Pitfall 3).
 *
 * Gating (SYNC-01 + SYNC-03):
 *   - No `active` show → the effect returns early; no timer is ever scheduled,
 *     so a poll can NEVER happen without an active show.
 *   - Each tick gates on `navigator.onLine && document.visibilityState ===
 *     "visible"`; an ineligible tick performs NO fetch and simply reschedules,
 *     resuming silently on the next eligible tick (offline/backgrounded iOS,
 *     Pitfall 4 — no work, no error, no banner).
 *
 * Tolerance (D-06): a thrown `pollLatest` is swallowed and the loop still
 * schedules the next tick — a transient network blowup never stops tracking.
 *
 * Adaptive backoff (D-06, optional): after N consecutive empty polls the next
 * delay grows to `POLL_INTERVAL_MS * (1 + idleStreak)`, clamped to
 * `POLL_MAX_INTERVAL_MS` and never below `POLL_INTERVAL_MS` — politeness to the
 * volunteer-run host when nothing is changing, snapping back to the floor the
 * moment rows arrive.
 *
 * Leak-freedom (Pitfall 3): the pending timer lives in a ref; the effect always
 * clears it before scheduling and on cleanup, and a `cancelled` flag stops an
 * in-flight tick from scheduling after unmount — no post-unmount poll.
 */
import { useEffect, useRef } from "react";
import { pollLatest, type LatestSetlistRow } from "@guezzer/core";
import { config } from "../config.ts";
import { getMockLatestFetch, MOCK_FIRST_TICK_MS } from "./mockLatest.ts";
import { useOnlineStatus } from "./useOnlineStatus.ts";

/**
 * `navigator.onLine` is unreliable-but-cheap; `pollLatest` is tolerant of a
 * false-positive online. Wrapped so `this` binds correctly in browsers (an
 * unbound `globalThis.fetch` throws "Illegal invocation" when detached).
 */
const boundFetch: typeof globalThis.fetch = (input, init) =>
  globalThis.fetch(input, init);

/**
 * TEST HARNESS (260713-wjd): non-null ONLY when the URL carries
 * `?mockLatest=1` — the poller then serves fixture rows through the SAME
 * pipeline (validation, artist gate, diff) with a ~2s first tick instead of
 * the 60s floor. Read once at module load; the flag can't change without a
 * reload. Null on every normal load → behavior identical to before.
 */
const mockLatestFetch = getMockLatestFetch();

export function useLatestPoll(
  active: { sessionId: string } | undefined,
  onRows: (rows: LatestSetlistRow[]) => void,
): void {
  const online = useOnlineStatus();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleStreakRef = useRef(0);

  // Keep the latest `onRows` without re-arming the loop when the callback
  // identity changes (a fresh closure each ShowView render must not reset the
  // 60s cadence — that would let a busy render burst the poller).
  const onRowsRef = useRef(onRows);
  onRowsRef.current = onRows;

  useEffect(() => {
    // SYNC-01: no active show → no timer, ever. A poll cannot happen here.
    if (!active) return;

    let cancelled = false;

    const clearPending = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    // Always clear before scheduling (Pitfall 3) so exactly one timer is armed.
    const scheduleNext = (delay: number) => {
      clearPending();
      if (cancelled) return;
      timerRef.current = setTimeout(() => void tick(), delay);
    };

    const eligible = () =>
      navigator.onLine && document.visibilityState === "visible";

    const tick = async () => {
      if (cancelled) return;

      // SYNC-03: an ineligible tick does NO work and reschedules at the floor,
      // resuming silently when eligible again.
      if (!eligible()) {
        scheduleNext(config.live.POLL_INTERVAL_MS);
        return;
      }

      try {
        const rows = await pollLatest({ fetch: mockLatestFetch ?? boundFetch });
        if (cancelled) return;
        onRowsRef.current(rows);
        // Backoff bookkeeping: reset on any rows, grow on an empty poll.
        idleStreakRef.current = rows.length > 0 ? 0 : idleStreakRef.current + 1;
      } catch {
        // D-06: tolerant — a thrown poll never stops the loop; retry next tick.
      }

      if (cancelled) return;
      const delay = Math.min(
        config.live.POLL_INTERVAL_MS * (1 + idleStreakRef.current),
        config.live.POLL_MAX_INTERVAL_MS,
      );
      scheduleNext(delay);
    };

    // Arm the FIRST tick one interval out — never an immediate burst on mount.
    // (Mock harness: ~2s first tick so UAT doesn't wait out the 60s floor —
    // no real request is made on that tick, the fetch is the fixture stub.)
    scheduleNext(mockLatestFetch ? MOCK_FIRST_TICK_MS : config.live.POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearPending();
    };
    // `online` re-arms the loop on a connectivity flip so a return-to-online
    // starts a fresh eligible cadence; `active?.sessionId` re-arms per show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.sessionId, online]);
}
