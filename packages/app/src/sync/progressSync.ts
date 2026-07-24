/**
 * The Supabase sync fence for shared dex progress (Phase 19, PROG-02/03/05). This
 * is the ONLY module (alongside its engine/read-hook siblings under
 * `packages/app/src/sync/`) that touches the Supabase client for progress — it
 * imports the Phase-17 `supabase` singleton and NEVER calls `createClient`
 * (packages/core stays Supabase-free by construction; the purity test asserts it).
 *
 * Two halves live here:
 *
 *  1. STATELESS primitives — the identity-safe own-row upsert (D-15, Pitfall 4),
 *     the app-wide `postgres_changes` subscribe, and the validated full re-pull
 *     (D-19). These are pure functions of their args + the singleton; they hold no
 *     React state and could be called from a Node harness.
 *
 *  2. A module-level SHARED SYNC STORE — a `useOnlineStatus`-style external store
 *     (`subscribeSyncState`/`getSyncState`) the single app-wide engine
 *     (`useProgressSync`) writes and any number of read hooks
 *     (`useFriendsProgress`) consume reactively. This seam is what makes the
 *     engine a SINGLETON (one subscription, one debounce) while the Friends UI is
 *     a pure reader — no component opens a second channel or starts a second
 *     debounce (D-16).
 *
 * The RLS read-all / write-own policy and the `supabase_realtime` publication were
 * provisioned in Phase 17 — this module RELIES on them, never re-creates them
 * (zero migration this phase). The realtime-publication gotcha (its absence fails
 * SILENTLY) is a Phase-17 concern, already done.
 */
import type { DexStats } from "@guezzer/core";
import { deriveSharedProgress, parseSharedProgress } from "@guezzer/core";
import { supabase } from "../db/supabase.ts";
import { writeFriendCache, type FriendRowData } from "./friendCache.ts";

/** The Supabase table + its first-class columns (provisioned Phase 17). */
const PROGRESS_TABLE = "progress";
const SELECT_COLUMNS = "user_id, display_name, summary, updated_at";

// ── Stateless write primitives ──────────────────────────────────────────────

/**
 * The CONTENT write (PROG-02, D-15): upsert the signed-in user's FULL fresh
 * summary. Always includes `summary` (derived pure-core from the local dex) so it
 * is the source of truth for counts, plus the identity columns and a client-set
 * `updated_at` (RESEARCH Open-Q2 — `updated_at` is not read for correctness; the
 * offline "as of {time}" uses OUR local `fetchedAt`). Keyed by `user_id`
 * (`onConflict`) so re-writes are idempotent and RLS write-own holds structurally.
 */
export async function upsertOwnProgress(
  userId: string,
  displayName: string,
  dex: DexStats,
): Promise<void> {
  // supabase-js RESOLVES (never rejects) on RLS violations, constraint failures,
  // and 4xx responses — so the returned `{ error }` MUST be read, or a persistent
  // structural failure is completely silent and the caller's `.catch()` is
  // unreachable (WR-02). Log + throw so a real failure is diagnosable on show
  // night AND the caller's transient-retry `.catch` path can see it.
  const { error } = await supabase.from(PROGRESS_TABLE).upsert(
    {
      user_id: userId,
      display_name: displayName,
      summary: deriveSharedProgress(dex),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.warn("[progress] own-row upsert failed:", error.message);
    throw error;
  }
}

/**
 * The IDENTITY-ONLY write (D-15, Pitfall 4): touches `{user_id, display_name}`
 * ONLY — NEVER `summary` — so a name-only refresh can never clobber the caught
 * counts. Phase-17 kept `display_name` a first-class column precisely for this.
 * The content upsert above remains the sole source of truth for the summary.
 */
export async function upsertIdentity(
  userId: string,
  displayName: string,
): Promise<void> {
  // Same swallowed-error hazard as the content write (WR-02): read the returned
  // `{ error }` so an RLS/DB failure on the identity-only write surfaces instead
  // of resolving silently as if it succeeded.
  const { error } = await supabase
    .from(PROGRESS_TABLE)
    .upsert({ user_id: userId, display_name: displayName }, { onConflict: "user_id" });
  if (error) {
    console.warn("[progress] identity upsert failed:", error.message);
    throw error;
  }
}

// ── Stateless read primitive ────────────────────────────────────────────────

/**
 * The validated full re-pull (PROG-05, D-19). Selects every progress row, runs
 * each `summary` through core `parseSharedProgress` at the untrusted read
 * boundary — malformed / hostile rows return `null` and are SKIPPED (never crash
 * the pull) — and drops the caller's OWN row (`user_id === myUserId`). Survivors
 * are cached as the offline backstop (D-18) with OUR local `Date.now()` stamp and
 * returned. On a whole-select error returns `null` so the caller keeps the
 * last-known cache and surfaces the calm degraded-read copy (never a crash, never
 * a wipe). Full-table re-pull is correct at ~5 rows (D-16).
 */
export async function refreshAllFriends(
  myUserId: string,
): Promise<FriendRowData[] | null> {
  const { data, error } = await supabase.from(PROGRESS_TABLE).select(SELECT_COLUMNS);
  if (error) return null; // keep last-known cache; caller surfaces degraded-read copy
  const rows: FriendRowData[] = (data ?? [])
    .map((r): FriendRowData | null => validateFriendRow(r, myUserId))
    .filter((r): r is FriendRowData => r != null);
  await writeFriendCache(rows, Date.now()); // D-18 offline backstop
  return rows;
}

/**
 * Validate an untrusted progress row at the read boundary (D-19, CR-01). The
 * WHOLE row is checked, not just `summary`: RLS is write-own, so a friend fully
 * controls their OWN row's first-class columns and could set `display_name` to
 * null / a non-string via a direct REST write. Since `display_name` flows
 * unguarded into `.trim()` / `initialsOf(...)` on a surface with no error
 * boundary, a single hostile row would otherwise crash the entire Friends tab.
 * `user_id` and `display_name` must therefore be NON-EMPTY strings, `summary`
 * must pass core `parseSharedProgress`, and the caller's OWN row is dropped. Any
 * failure returns `null` → the row is SILENTLY SKIPPED (never thrown), honoring
 * the locked D-19 "malformed row skipped" contract for the columns too.
 */
function validateFriendRow(raw: unknown, myUserId: string): FriendRowData | null {
  if (raw == null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const { user_id: userId, display_name: displayName, summary, updated_at: updatedAt } = row;
  if (typeof userId !== "string" || userId.length === 0) return null; // uuid-ish, non-empty
  if (typeof displayName !== "string" || displayName.length === 0) return null;
  if (userId === myUserId) return null; // drop own row
  const parsed = parseSharedProgress(summary); // D-19: malformed → null → skipped
  if (parsed == null) return null;
  return {
    userId,
    displayName,
    summary: parsed,
    updatedAt: typeof updatedAt === "string" ? updatedAt : null,
  };
}

// ── App-wide subscription primitive ─────────────────────────────────────────

/**
 * The app-wide `postgres_changes` subscription (PROG-05, D-16). Subscribes to ALL
 * change events on the progress table and invokes `onChange` on each; returns the
 * channel so the OWNING engine can `removeChannel` it on teardown / sign-out /
 * reconnect. This fires only because Phase-17 ran
 * `alter publication supabase_realtime add table public.progress` (its absence
 * fails silently — do not remove it). Only the single shell-mounted engine calls
 * this — the singleton guarantee (D-16).
 */
export function subscribeProgress(onChange: () => void): RealtimeChannelHandle {
  const channel = supabase
    .channel("progress-feed")
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: PROGRESS_TABLE },
      () => onChange(),
    )
    .subscribe();
  return channel;
}

/** The channel handle `subscribeProgress` returns (kept loose to avoid a hard type import). */
export type RealtimeChannelHandle = ReturnType<typeof supabase.channel>;

/** Tear down a channel opened by `subscribeProgress` (engine teardown / reconnect). */
export async function removeChannel(channel: RealtimeChannelHandle): Promise<void> {
  await supabase.removeChannel(channel);
}

// ── Shared sync store (the single engine→read-hook seam) ─────────────────────

/**
 * The reactive shared sync state the app-wide engine PUBLISHES and every read hook
 * CONSUMES. `friends` are the validated, own-excluded rows from the last pull;
 * `offline` drives the dimmed cached view + marker; `asOf` is the "as of {time}"
 * clock (our fetch stamp); `error` is the calm degraded-read copy (null when
 * healthy). One store instance app-wide → the engine is a singleton.
 */
export interface SyncState {
  friends: FriendRowData[];
  offline: boolean;
  asOf: number | null;
  error: string | null;
}

const EMPTY_FRIENDS: readonly FriendRowData[] = [];

let syncState: SyncState = {
  friends: EMPTY_FRIENDS as FriendRowData[],
  offline: false,
  asOf: null,
  error: null,
};

const listeners = new Set<() => void>();

/** Subscribe to shared sync-state changes (external-store contract). Returns unsubscribe. */
export function subscribeSyncState(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * The current shared sync state. Returns a STABLE reference between writes (the
 * `useSyncExternalStore` getSnapshot contract) — `setSyncState` only ever
 * replaces the module object on a real change, so React never loops.
 */
export function getSyncState(): SyncState {
  return syncState;
}

/**
 * Merge a partial update into the shared sync state and notify subscribers. Only
 * the engine calls this. A fresh object is created each call (invoked only on real
 * sync events), keeping `getSyncState`'s reference stable in between.
 */
export function setSyncState(partial: Partial<SyncState>): void {
  syncState = { ...syncState, ...partial };
  for (const listener of listeners) listener();
}

/**
 * Reset the shared store to its pristine signed-out shape. Test/teardown seam —
 * keeps the module store from leaking state across specs.
 */
export function resetSyncState(): void {
  syncState = {
    friends: EMPTY_FRIENDS as FriendRowData[],
    offline: false,
    asOf: null,
    error: null,
  };
  for (const listener of listeners) listener();
}
