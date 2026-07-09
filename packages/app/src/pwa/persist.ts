/**
 * Requests eviction-resistant storage early on first run and records the
 * outcome — silently (D-09). `navigator.storage.persist()` frequently
 * resolves `false` on iOS Safari even though data still survives normal
 * use; that is NOT a failure to surface as an error. The real eviction
 * backstop is Phase 5's prominent JSON export — this function only records
 * `persistStatus` in `meta` so a later phase can read it for an export
 * nudge. Never throws.
 */
import { setMeta } from "../db/db.ts";

/** Union type (not enum) per the repo's erasable-syntax-only convention. */
export type PersistStatus = "persisted" | "best-effort" | "unsupported";

/**
 * Idempotent, silent-on-denial. Safe to call multiple times (e.g. on mount
 * AND on first user interaction) — it short-circuits once persistence is
 * already granted, and never throws even if the underlying Storage API
 * calls reject.
 */
export async function requestPersistenceOnce(): Promise<void> {
  try {
    if (!navigator.storage?.persist) {
      await setMeta("persistStatus", "unsupported" satisfies PersistStatus);
      return;
    }

    if (await navigator.storage.persisted?.()) {
      await setMeta("persistStatus", "persisted" satisfies PersistStatus);
      return;
    }

    const granted = await navigator.storage.persist(); // may resolve false on iOS — NOT an error (D-09)
    await setMeta(
      "persistStatus",
      (granted ? "persisted" : "best-effort") satisfies PersistStatus,
    );
  } catch {
    // Never throw (D-09) — record a status even if a Storage API call rejects,
    // so a later phase's export-nudge read still gets a defined value. Guard
    // this recovery write too: a failing IndexedDB write must not surface
    // as an unhandled rejection from this "never throws" contract.
    try {
      await setMeta("persistStatus", "best-effort" satisfies PersistStatus);
    } catch {
      // Swallow — no scary UI on any part of this path (D-09).
    }
  }
}
