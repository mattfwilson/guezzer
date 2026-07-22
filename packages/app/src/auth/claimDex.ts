/**
 * First-login legacy-dex claim (AUTH-05 / D-08, RESEARCH Pattern 3).
 *
 * The existing `"guezzer"` Dexie DB holds the owner's real v1 catch history in
 * UNTAGGED rows (no `userId`). On the first sign-in this stamps every untagged
 * row across the five domain tables with the first signer's `userId`, EXACTLY
 * ONCE — gated by a `dexClaimedBy` meta flag so a second friend logging in on a
 * shared/borrowed phone never re-claims or re-stamps the owner's dex (their own
 * dex stays empty until Phase 19, D-09).
 *
 * Pitfall 2: this CANNOT live in the Dexie `version(7).upgrade()` hook — the
 * userId is unknown when the DB opens (before sign-in). It is an app-side,
 * idempotent, meta-gated operation run at first login only.
 */
import { type Table } from "dexie";
import { db, getMeta, setMeta } from "../db/db.ts";

/**
 * Stamp all untagged (userId === undefined) legacy rows with `userId`, exactly
 * once. Idempotent: if the `dexClaimedBy` gate is already set, returns
 * immediately without touching any row (a second login with a different userId
 * is a no-op — the first signer keeps the rows, AUTH-05).
 *
 * The whole claim — the five per-table stamps plus setting the gate — runs in a
 * SINGLE rw transaction, so a mid-claim failure rolls back every partial stamp
 * and the gate stays unset (the claim can be safely retried on the next login).
 * Rows already carrying a `userId` are left untouched (the `modify` only fills
 * `undefined`), so a future signed-in user's rows are never re-owned.
 */
export async function claimLegacyDexOnce(userId: string): Promise<void> {
  const already = await getMeta<string>("dexClaimedBy");
  if (already) return; // exactly once (AUTH-05) — the gate short-circuits re-runs

  // The six stores exceed Dexie's positional `transaction(mode, ...t5, cb)`
  // overload (max 5 stores), so pass the stores as an array — same single atomic
  // rw transaction (mirrors `importSnapshot` in db.ts).
  await db.transaction(
    "rw",
    [
      db.attendedShows,
      db.trackedShows,
      db.trackedEntries,
      db.archiveShows,
      db.bingoCards,
      db.meta,
    ],
    async () => {
      // The five domain tables have distinct row types; view each through the
      // shared `{ userId?: string }` shape so one loop can stamp them all (the
      // `modify` only fills undefined userIds — pre-tagged rows are untouched).
      const domainTables = [
        db.attendedShows,
        db.trackedShows,
        db.trackedEntries,
        db.archiveShows,
        db.bingoCards,
      ] as unknown as Table<{ userId?: string }>[];
      for (const table of domainTables) {
        await table.toCollection().modify((r) => {
          if (r.userId === undefined) r.userId = userId;
        });
      }
      await setMeta("dexClaimedBy", userId);
    },
  );
}
