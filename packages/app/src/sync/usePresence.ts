/**
 * The app-wide presence + reactions ENGINE (Phase 20, PRES-01/02/03/04). A
 * carbon copy of the Phase-19 `useProgressSync` singleton precedent: mounted ONCE
 * at the app shell (App.tsx, beside `useProgressSync()`), it renders nothing,
 * gates internally, and drives from live sources. It is the SOLE owner of the
 * `gizz-room` channel — the one writer that `.track()`s our coarse activity,
 * publishes friends' presence to the shared store, and routes validated inbound
 * waves to the toast host — while the `usePresenceReaders` hooks stay pure
 * readers over the store this engine publishes (the D-19 singleton guarantee).
 *
 * Gating (all internal, so App.tsx mounts it unconditionally):
 *  - No signed-in identity OR offline → a calm no-op: the channel is never opened
 *    (or is torn down), the wave sender is cleared, and the presence store is
 *    reset to pristine so a departed/borrowed identity stops broadcasting and its
 *    dots clear (D-16/D-17/D-20, T-20-10).
 *  - Signed in + online → opens `gizz-room` ONCE, `.track({tab, atShow})` with the
 *    current activity, and registers a bound `sendWave` that stamps `from: userId`.
 *
 * The subscription and the activity re-track live in SEPARATE effects (mirroring
 * useProgressSync's subscription/upsert split): the lifecycle effect keyed
 * `[userId, online]` owns open/track/teardown, while a second effect keyed on the
 * derived activity re-`.track()`s WITHOUT re-opening — so moving between tabs or
 * backgrounding never churns the subscription (Pitfall 6 teardown safety intact).
 *
 * PRES-03: this engine touches ONLY the Realtime channel + the in-memory presence
 * store — zero Postgres/Dexie/localStorage writes on the presence path (the
 * primitive-layer sync tests enforce the no-persist invariant).
 */
import { useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuthIdentity } from "../auth/useAuthIdentity.ts";
import { db } from "../db/db.ts";
import { useOnlineStatus } from "../live/useOnlineStatus.ts";
import { useHashRoute } from "../routing/useHashRoute.ts";
import { showWaveToast } from "../components/WaveToast.tsx";
import { deriveActivity } from "./presenceActivity.ts";
import {
  openPresenceChannel,
  readPresence,
  type RealtimeChannelHandle,
  removeChannel,
  resetPresenceState,
  setPresenceState,
  setWaveSender,
  validateWave,
} from "./presenceSync.ts";
import { useVisibilityHidden } from "./useVisibilityHidden.ts";

export function usePresence(): void {
  const identity = useAuthIdentity();
  const userId = identity?.userId ?? null;
  const online = useOnlineStatus();

  // The activity trio → the coarse `{ tab, atShow? }` payload we broadcast. Memoized
  // on the PRIMITIVE signals (never the raw liveQuery object) so `activity` keeps a
  // stable reference across renders — the re-track effect only fires on a real change.
  const route = useHashRoute();
  const hidden = useVisibilityHidden();
  const active = useLiveQuery(() =>
    db.trackedShows.where("status").equals("active").first(),
  );
  const atShowActive = active != null;
  const activity = useMemo(
    () => deriveActivity(route, hidden, atShowActive),
    [route, hidden, atShowActive],
  );

  // Mirror the latest activity into a ref so the lifecycle effect can seed its
  // initial `.track()` with the CURRENT payload without listing `activity` in its
  // dep array (which would tear the channel down on every tab change).
  const activityRef = useRef(activity);
  activityRef.current = activity;

  // The live channel handle + a subscribed flag shared with the re-track effect.
  const channelRef = useRef<RealtimeChannelHandle | null>(null);
  const subscribedRef = useRef(false);

  // ── Lifecycle effect (open / track / teardown), keyed on identity + connectivity.
  // Signed-out or offline → reset the store to pristine and open nothing. Otherwise
  // open the SOLE gizz-room channel once, track the current activity, and register
  // the bound wave sender. Cleanup clears the sender, drops the channel, and (via the
  // next run's guard) resets on sign-out/offline (D-16/17/20, Pitfall 6). ──
  useEffect(() => {
    if (!userId || !online) {
      resetPresenceState(); // pristine dots on sign-out/offline (D-16/17/20)
      return;
    }

    // Per-run cancellation guard (Pitfall 6): a fast online↔offline / identity flip
    // re-runs this effect; a late presence:sync from a superseded run must not write.
    let cancelled = false;

    const channel = openPresenceChannel(
      userId,
      (state) => {
        if (!cancelled) setPresenceState(readPresence(state));
      },
      (raw) => {
        if (cancelled) return;
        const wave = validateWave(raw, userId);
        if (wave) {
          showWaveToast({
            from: wave.from,
            emoji: wave.emoji,
            targeted: wave.to != null,
          });
        }
      },
    );
    channelRef.current = channel;
    subscribedRef.current = true;

    // Initial track with the CURRENT activity (buffers until the channel joins).
    void channel.track(activityRef.current);

    // The bound sender stamps `from: userId` — UI callers of `sendWave` hold no channel.
    setWaveSender((emoji, to) =>
      channel.send({
        type: "broadcast",
        event: "wave",
        payload: { from: userId, to, emoji },
      }),
    );

    return () => {
      cancelled = true;
      subscribedRef.current = false;
      channelRef.current = null;
      setWaveSender(null);
      void removeChannel(channel);
    };
  }, [userId, online]);

  // ── Re-track effect, keyed on the derived activity only. Re-`.track()`s the new
  // payload on a tab / visibility / active-show change WITHOUT re-opening the channel
  // (the subscription/upsert split). No-op until the lifecycle effect has subscribed. ──
  useEffect(() => {
    if (!subscribedRef.current || !channelRef.current) return;
    void channelRef.current.track(activity);
  }, [activity]);
}
