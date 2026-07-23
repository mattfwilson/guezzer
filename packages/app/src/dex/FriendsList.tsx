/**
 * FriendsList (Phase 19, PROG-04 · D-02/D-03/D-05/D-16/D-18) — the Friends segment
 * body: a pinned live "You" `SelfRow` above the friends, ordered by the pure
 * `buildFriendRows`. It READS the pure `useFriendsProgress()` hook over the SHARED
 * sync state — the app-wide `useProgressSync()` engine (mounted once in App.tsx,
 * 19-02) is the sole subscription owner. This component opens NO `postgres_changes`
 * channel and starts NO debounce of its own, so leaving the Friends tab does NOT
 * stop live sync (D-16). It imports NO `progressSync` primitives and never mounts
 * the engine.
 *
 * States (D-18): the `SelfRow` is ALWAYS live (local `useDexStats`) and never dimmed.
 * When `offline`, an `Offline · as of {time}` muted chip reuses the `SyncDot`
 * hollow-ring connection vocabulary and the friend rows render dimmed (last-known
 * cache) — never blank, never a spinner. An online whole-pull failure shows the calm
 * `degradedRead` copy (a malformed single row is silently skipped upstream, D-19).
 * With no friend rows, the `No friends yet` empty state renders BELOW the SelfRow.
 * DexView owns the overlays via `onOpenFriend` / `onOpenSelf`.
 */
import { config } from "../config.ts";
import { useAuthIdentity } from "../auth/useAuthIdentity.ts";
import { SyncDot } from "../live/SyncDot.tsx";
import { FriendRow } from "./FriendRow.tsx";
import { SelfRow } from "./SelfRow.tsx";
import { buildFriendRows, useFriendsProgress } from "../sync/useFriendsProgress.ts";
import type { FriendRowData } from "../sync/friendCache.ts";

interface FriendsListProps {
  /** Open a friend's live head-to-head overlay (FriendDetail). */
  onOpenFriend: (friend: FriendRowData) => void;
  /** Open the own trophy case (rarest showcase only, no compare — D-06). */
  onOpenSelf: () => void;
}

/** Format the offline "as of" clock (our local fetch stamp) as a short wall time. */
function formatAsOf(asOf: number | null): string {
  if (asOf == null) return "";
  return new Date(asOf).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function FriendsList({ onOpenFriend, onOpenSelf }: FriendsListProps) {
  const copy = config.copy.friends;
  const myUserId = useAuthIdentity()?.userId ?? "";
  const { friends, offline, asOf, error } = useFriendsProgress();

  const rows = buildFriendRows(friends, myUserId);

  return (
    <div className="flex flex-col">
      {/* Pinned live "You" row — sourced from local dex, never dimmed (D-02). */}
      <SelfRow onClick={onOpenSelf} />

      {/* Offline marker (D-18) — reuse the SyncDot hollow-ring vocabulary, never a
          spinner. The SelfRow above stays live; only the friend rows below dim. */}
      {offline && (
        <div className="flex items-center gap-2 px-4 py-2 text-[13px] leading-tight text-text-muted">
          <SyncDot online={false} />
          <span className="tabular-nums">{copy.offlineMarker(formatAsOf(asOf))}</span>
        </div>
      )}

      {/* Degraded read (online, whole-pull failed) — calm, connection-language copy. */}
      {error != null && (
        <p className="px-4 py-2 text-base leading-normal text-text-muted">{copy.degradedRead}</p>
      )}

      {rows.length === 0 ? (
        // Empty state BELOW the SelfRow (echoes ShowsList's empty shape). During the
        // first pull this is also the calm frame — no spinner, no NaN.
        <div className="flex flex-col items-center gap-2 px-4 pt-16 pb-16 text-center">
          <p className="text-[20px] font-semibold leading-tight text-text-primary">
            {copy.emptyHeading}
          </p>
          <p className="text-base leading-normal text-text-muted">{copy.emptyBody}</p>
        </div>
      ) : (
        rows.map((friend) => (
          <FriendRow
            key={friend.userId}
            userId={friend.userId}
            displayName={friend.displayName}
            pct={friend.summary.completion.pct}
            caught={friend.summary.completion.caught}
            rarest={friend.summary.rarest?.tier ?? null}
            dimmed={offline}
            onClick={() => onOpenFriend(friend)}
          />
        ))
      )}
    </div>
  );
}
