/**
 * Reactive app-owned identity record (Plan 18-03, AUTH-02 / D-05 / D-10). A
 * structural twin of `live/useOnlineStatus.ts`: a `useSyncExternalStore` over a
 * window event, swapping the `online`/`offline` pair for the app-owned
 * `gwf-identity-change` event (plus the native cross-tab `storage` event).
 *
 * The client snapshot is the SYNCHRONOUS `readIdentityRecord()` read (never a
 * Promise) so the boot gate paints with zero await (D-05) — this is what makes
 * the gate immune to the `getSession()`-returns-null-offline bug (RESEARCH
 * Pitfall 1). The server snapshot is `null` (signed-out at first paint). A write
 * re-renders subscribers to the new identity (sign-in); a clear re-renders them
 * to `null` (the D-10 sign-out teardown).
 */
import { useSyncExternalStore } from "react";
import {
  type AuthIdentity,
  IDENTITY_CHANGE_EVENT,
  IDENTITY_KEY,
  readIdentityRecord,
} from "./identityRecord.ts";

function subscribe(callback: () => void): () => void {
  window.addEventListener(IDENTITY_CHANGE_EVENT, callback);
  // The native `storage` event fires in OTHER tabs when localStorage changes,
  // keeping a second open tab's gate in sync on sign-in / sign-out.
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(IDENTITY_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// `useSyncExternalStore` requires getSnapshot to return a STABLE reference while
// the underlying value is unchanged — `readIdentityRecord()` builds a fresh
// object every call, which loops React ("Maximum update depth exceeded"). Cache
// the parsed record keyed on the raw stored string: same string → same object
// reference; a write/clear changes the string → recompute.
let cachedRaw: string | null = null;
let cachedRecord: AuthIdentity | null = null;
let cachePrimed = false;

function getSnapshot(): AuthIdentity | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(IDENTITY_KEY);
  } catch {
    raw = null;
  }
  if (cachePrimed && raw === cachedRaw) return cachedRecord;
  cachedRaw = raw;
  cachedRecord = readIdentityRecord();
  cachePrimed = true;
  return cachedRecord;
}

export function useAuthIdentity(): AuthIdentity | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
