/**
 * The Supabase presence + reactions fence (Phase 20, PRES-01/03/04/05). A
 * line-for-line structural mirror of the shipped `progressSync.ts`: two halves —
 * STATELESS channel primitives + a module-level external store — importing the
 * Phase-17 `supabase` singleton and NEVER calling `createClient` (packages/core
 * stays Supabase-free; the purity test asserts it).
 *
 * Decision provenance baked into this module:
 *  - D-18: presence runs on ONE dedicated `gizz-room` channel keyed by `userId`,
 *    separate from the Phase-19 `progress-feed` channel. Presence sync + wave
 *    broadcast share this one channel.
 *  - D-14: the online signal is binary present-now — `onlineIds` is a Set of the
 *    userIds currently in `presenceState()`; there is no last-seen timestamp.
 *  - D-03 / SOCL-V2-01: activity is coarse (`{ tab, atShow? }`) — reduced by the
 *    pure `reduceActivity` (presenceActivity.ts), never a song/setlist position.
 *  - D-21: missed waves are gone — no queue, badge, or replay lives here. A wave
 *    is a fire-and-forget broadcast; the toast host (a later plan) displays it.
 *  - PRES-03: this module touches ONLY the Realtime channel + an in-memory store.
 *    Zero Postgres/Dexie/localStorage writes — presence and waves are ephemeral.
 *    The presenceSync.test.ts persistence assertion enforces it (`.from()` is
 *    never called on the presence path).
 *
 * The `validateWave` read-boundary discipline mirrors `validateFriendRow`
 * exactly ("malformed → null → skipped, never crash"): every inbound wave arrives
 * from another friend's device over `gizz-room` broadcast and is fully untrusted.
 */
import { config } from "../config.ts";
import { supabase } from "../db/supabase.ts";
import { type Activity, reduceActivity } from "./presenceActivity.ts";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * An inbound/outbound reaction. `to: null` = broadcast to everyone; `to: <id>` =
 * targeted at that user (validated to be ME on the read boundary, PRES-05). The
 * `from` is the sender's userId — the toast host resolves the display name from
 * the friends store, never trusting a name in the payload.
 */
export interface WavePayload {
  from: string;
  to: string | null;
  emoji: string;
}

/**
 * The reactive presence state the engine PUBLISHES and read hooks CONSUME.
 * `onlineIds` is binary present-now (D-14); `activityByUser` is the coarse
 * per-user reduced Activity (absent for an online user whose entries all reduce
 * to null — present-now still holds).
 */
export interface PresenceState {
  onlineIds: ReadonlySet<string>;
  activityByUser: ReadonlyMap<string, Activity>;
}

/** The raw shape Supabase presence hands back — each user keyed to an ARRAY of entries (Pitfall 2). */
type RawPresenceState = Record<string, ReadonlyArray<unknown>>;

// ── Stateless channel primitives ─────────────────────────────────────────────

/**
 * Open THE dedicated presence channel (D-18): `gizz-room`, keyed by `userId` with
 * `enabled: true` (Pitfall-1 insurance — an `.on("presence")` listener
 * auto-enables receipt, but we set it explicitly). Wires the presence-`sync`
 * listener (handing the caller the raw `presenceState()`) and the broadcast-`wave`
 * listener (handing the caller the untrusted payload to validate), then
 * subscribes. Returns the channel handle so the OWNING engine can `.track()` its
 * activity, reach the send path, and `removeChannel` on teardown/sign-out/offline.
 * The initial `.track({tab, atShow})` belongs in the engine (so it carries the
 * current activity) — never here.
 */
export function openPresenceChannel(
  userId: string,
  onPresenceSync: (state: RawPresenceState) => void,
  onWave: (raw: unknown) => void,
): RealtimeChannelHandle {
  const channel = supabase
    .channel("gizz-room", { config: { presence: { key: userId, enabled: true } } })
    .on("presence", { event: "sync" }, () =>
      onPresenceSync(channel.presenceState() as unknown as RawPresenceState),
    )
    .on(
      "broadcast",
      { event: "wave" },
      ({ payload }: { payload: unknown }) => onWave(payload),
    )
    .subscribe();
  return channel;
}

/** The channel handle `openPresenceChannel` returns (kept loose to avoid a hard type import). */
export type RealtimeChannelHandle = ReturnType<typeof supabase.channel>;

/** Tear down a channel opened by `openPresenceChannel` (engine teardown / sign-out / offline, Pitfall 6). */
export async function removeChannel(channel: RealtimeChannelHandle): Promise<void> {
  await supabase.removeChannel(channel);
}

/**
 * Derive the presence store shape from the raw `presenceState()` (PRES-01). Online
 * ids are simply the keys (binary present-now, D-14). Each user's entry ARRAY is
 * run through the pure `reduceActivity` (Pitfall 2 — the value is `Presence<T>[]`),
 * and only users with a non-null reduce get an `activityByUser` entry — an online
 * user whose entries are all malformed still counts as online, just without a
 * displayed activity. Returns a freshly-built `PresenceState`; the caller stores
 * it ONCE (never rebuilds on read — the stable-ref contract).
 */
export function readPresence(state: RawPresenceState): PresenceState {
  const onlineIds = new Set(Object.keys(state));
  const activityByUser = new Map<string, Activity>();
  for (const [userId, entries] of Object.entries(state)) {
    const activity = reduceActivity(entries);
    if (activity) activityByUser.set(userId, activity);
  }
  return { onlineIds, activityByUser };
}

/** The fixed reaction palette — the SINGLE allow-list validateWave (and the downstream palette) consumes. */
const ALLOWED_EMOJI: ReadonlySet<string> = new Set(config.presence.EMOJIS);

/**
 * Validate an untrusted inbound wave at the read boundary (T-20-01/05/07, PRES-05)
 * — mirrors `validateFriendRow` exactly ("malformed → null → skipped, never
 * crash"). Rejects: a non-object; an empty / non-string `from`; a reflected
 * self-wave (`from === myUserId`, Pitfall 3 / T-20-07 — a self broadcast can never
 * self-toast); a `to` that is neither `null` nor a string; a wave targeted at
 * someone else (`to != null && to !== myUserId`, T-20-05 / PRES-05); and any
 * emoji outside the fixed 4-set. Returns a normalized `WavePayload` or `null` —
 * never throws.
 */
export function validateWave(raw: unknown, myUserId: string): WavePayload | null {
  if (raw == null || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  if (typeof w.from !== "string" || w.from.length === 0) return null;
  if (w.from === myUserId) return null; // reflected self-wave (Pitfall 3 / T-20-07)
  if (!(w.to === null || typeof w.to === "string")) return null;
  if (w.to != null && w.to !== myUserId) return null; // targeted elsewhere (T-20-05 / PRES-05)
  if (typeof w.emoji !== "string" || !ALLOWED_EMOJI.has(w.emoji)) return null;
  return { from: w.from, to: w.to as string | null, emoji: w.emoji };
}

// ── Module-level external store (the single engine→read-hook seam) ────────────

const EMPTY_ONLINE: ReadonlySet<string> = new Set();
const EMPTY_ACTIVITY: ReadonlyMap<string, Activity> = new Map();

function pristineState(): PresenceState {
  return { onlineIds: EMPTY_ONLINE, activityByUser: EMPTY_ACTIVITY };
}

let presenceState: PresenceState = pristineState();

const listeners = new Set<() => void>();

/** Subscribe to presence-state changes (external-store contract). Returns unsubscribe. */
export function subscribePresenceState(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * The current presence state. Returns a STABLE reference between writes (the
 * `useSyncExternalStore` getSnapshot contract, Pitfall 4) — `setPresenceState`
 * only ever replaces the module object on a real change, so React never loops.
 */
export function getPresenceState(): PresenceState {
  return presenceState;
}

/**
 * Replace the presence state with a freshly-derived one and notify subscribers.
 * Only the engine calls this (with `readPresence(...)`); the new object keeps
 * `getPresenceState`'s reference stable in between writes.
 */
export function setPresenceState(next: PresenceState): void {
  presenceState = next;
  for (const listener of listeners) listener();
}

/**
 * Reset the store to its pristine signed-out / offline shape (empty onlineIds +
 * activity) and notify. The test/teardown seam AND the D-16/D-20 signed-out/offline
 * clear the engine invokes when there is no identity or no connectivity.
 */
export function resetPresenceState(): void {
  presenceState = pristineState();
  for (const listener of listeners) listener();
}

// ── Wave-send seam (RESEARCH Open Question 1) ────────────────────────────────

let waveSender: ((emoji: string, to: string | null) => void) | null = null;

/**
 * Register (or clear, with `null`) the bound wave sender. The engine registers a
 * sender that stamps `from: userId` and calls
 * `ch.send({ type: "broadcast", event: "wave", payload: { from, to, emoji } })`
 * on the live channel; it clears it on teardown/sign-out/offline. This indirection
 * keeps UI components (ReactionPalette, FriendDetail) pure callers of the
 * module-level `sendWave` — they never hold the channel.
 */
export function setWaveSender(fn: ((emoji: string, to: string | null) => void) | null): void {
  waveSender = fn;
}

/**
 * Send a reaction. Delegates to the registered sender, or is a null-safe NO-OP
 * when none is registered (signed-out / offline) — never throws. `to: null` =
 * everyone; `to: <userId>` = targeted (PRES-05).
 */
export function sendWave(emoji: string, to: string | null): void {
  waveSender?.(emoji, to);
}
