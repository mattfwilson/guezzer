/**
 * GizzMap relay client — the pure, dependency-injected HTTP tier for the
 * self-owned Cloudflare Worker relay (packages/relay). Mirrors pollLatest's
 * failure policy EXACTLY: every function is a soft-failure tier that returns
 * a sentinel (false / null) and NEVER throws — a relay outage mid-festival
 * must degrade GizzMap to last-synced state, never crash it (the app remains
 * fully functional with the relay unreachable, owner constraint).
 *
 * Contract with packages/relay/src/worker.ts (kept in sync BY HAND — the
 * relay is deliberately standalone so wrangler never bundles core):
 *   PUT    {base}/g/{token}/beacon        body BeaconRecord (sans receivedAt)
 *   PUT    {base}/g/{token}/pin           body PinRecord    (sans receivedAt)
 *   DELETE {base}/g/{token}/pin/{pinId}
 *   GET    {base}/g/{token}/state         → GroupStateResponse
 *
 * The relay stores/relays ONLY EncryptedEnvelope payloads (group-crypto.ts);
 * plaintext beacon/pin shapes never appear on the wire. `receivedAt` is the
 * RELAY's receipt stamp (its TTL + honesty clock for peers whose device
 * clocks drift) — assigned server-side, echoed in state reads.
 */
import { z } from "zod";
import { config } from "../config.ts";

export interface RelayDeps {
  fetch: typeof globalThis.fetch;
  /** Relay origin, no trailing slash — e.g. "https://guezzer-relay.example.workers.dev". */
  baseUrl: string;
  /** The 64-hex capability token from deriveGroupKeys — NEVER the raw secret. */
  token: string;
}

/** One member's stored envelope, as the relay returns it. */
export const beaconRecordSchema = z.strictObject({
  memberId: z.string().min(1),
  iv: z.string().min(1),
  data: z.string().min(1),
  receivedAt: z.number().int().nonnegative(),
});
export type BeaconRecord = z.infer<typeof beaconRecordSchema>;

/** One stored pin envelope, as the relay returns it. */
export const pinRecordSchema = z.strictObject({
  pinId: z.string().min(1),
  iv: z.string().min(1),
  data: z.string().min(1),
  receivedAt: z.number().int().nonnegative(),
});
export type PinRecord = z.infer<typeof pinRecordSchema>;

export const groupStateSchema = z.strictObject({
  beacons: z.array(beaconRecordSchema),
  pins: z.array(pinRecordSchema),
});
export type GroupState = z.infer<typeof groupStateSchema>;

function groupUrl(deps: RelayDeps, path: string): string {
  return `${deps.baseUrl}/g/${deps.token}${path}`;
}

async function send(
  deps: RelayDeps,
  method: "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<boolean> {
  try {
    const res = await deps.fetch(groupUrl(deps, path), {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(config.fetchTimeoutMs),
    });
    return res.ok;
  } catch {
    return false; // offline/timeout — the sync loop retries next tick
  }
}

/** Upsert own beacon envelope. False on any soft failure (caller keeps its throttle state unconsumed). */
export async function publishBeacon(
  deps: RelayDeps,
  record: { memberId: string; iv: string; data: string },
): Promise<boolean> {
  return send(deps, "PUT", "/beacon", record);
}

/** Upsert a meeting-pin envelope. */
export async function publishPin(
  deps: RelayDeps,
  record: { pinId: string; iv: string; data: string },
): Promise<boolean> {
  return send(deps, "PUT", "/pin", record);
}

/** Delete a meeting pin by id (a 404 for an already-gone pin is success — idempotent). */
export async function deletePin(deps: RelayDeps, pinId: string): Promise<boolean> {
  return send(deps, "DELETE", `/pin/${encodeURIComponent(pinId)}`);
}

/**
 * GET the group's full state (5 members + a handful of pins — small enough
 * that incremental sync isn't worth its complexity). Null on ANY soft
 * failure so the app keeps rendering last-synced Dexie state.
 */
export async function fetchGroupState(deps: RelayDeps): Promise<GroupState | null> {
  try {
    const res = await deps.fetch(groupUrl(deps, "/state"), {
      signal: AbortSignal.timeout(config.fetchTimeoutMs),
    });
    if (!res.ok) return null;
    const parsed = groupStateSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.debug("fetchGroupState: malformed relay state — ignoring this poll");
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
