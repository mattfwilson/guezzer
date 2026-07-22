/**
 * GizzMap relay: one Worker route + one SQLite Durable Object per friend
 * group. Design (owner-approved exploration 2026-07-21):
 *
 * - The relay stores ONLY ciphertext envelopes ({iv, data} — AES-GCM,
 *   encrypted client-side with a key it never sees). It cannot read a single
 *   location. The 64-hex TOKEN in the URL is derived from the group secret by
 *   PBKDF2 alongside-but-independent-of the encryption key (core
 *   map/group-crypto.ts), so possessing the token (server logs, URLs) never
 *   yields plaintext.
 * - Beacons TTL out after 12h, pins after 48h — purged on every read, so NO
 *   location history ever accumulates. `receivedAt` is stamped server-side:
 *   it is the TTL clock AND the peers' honesty clock (device clocks drift).
 * - Capacity math: 5 members polling every 30s for 12h ≈ 7.2k req/day vs the
 *   100k/day free-plan cap. No rate limiting needed at this scale.
 *
 * CONTRACT (kept in sync BY HAND with core map/relay-client.ts — the relay is
 * deliberately standalone so wrangler never bundles @guezzer/core):
 *   PUT    /g/{token}/beacon        {memberId, iv, data}  → 204
 *   PUT    /g/{token}/pin           {pinId, iv, data}     → 204
 *   DELETE /g/{token}/pin/{pinId}                         → 204 (idempotent)
 *   GET    /g/{token}/state         → {beacons: [{memberId,iv,data,receivedAt}],
 *                                      pins:    [{pinId,iv,data,receivedAt}]}
 */

export interface Env {
  GROUPS: DurableObjectNamespace;
}

/** Mirrors core config.map.BEACON_TTL_MS — redeploy if that changes. */
const BEACON_TTL_MS = 12 * 3_600_000;
/** Mirrors core config.map.PIN_TTL_MS — redeploy if that changes. */
const PIN_TTL_MS = 48 * 3_600_000;

/** Hard caps — a 5-person group needs none of these; they bound abuse if a token leaks. */
const MAX_ENVELOPE_B64_LENGTH = 8_192;
const MAX_ID_LENGTH = 64;
const MAX_PINS = 50;
const MAX_MEMBERS = 16;

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TOKEN_PATH_RE = /^\/g\/([0-9a-f]{64})(\/.*)$/;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // token IS the capability; payloads are ciphertext
  "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    const match = TOKEN_PATH_RE.exec(url.pathname);
    if (!match) return withCors(new Response("not found", { status: 404 }));

    const [, token, subPath] = match;
    const stub = env.GROUPS.get(env.GROUPS.idFromName(token));
    const forwarded = new Request(new URL(subPath, url.origin), request);
    return withCors(await stub.fetch(forwarded));
  },
} satisfies ExportedHandler<Env>;

interface StoredEnvelope {
  iv: string;
  data: string;
  receivedAt: number;
}

/** Envelope body validation: exact string fields, length-capped (ASVS V5 at the trust boundary). */
function parseEnvelopeBody(
  body: unknown,
  idField: "memberId" | "pinId",
): { id: string; iv: string; data: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const id = record[idField];
  const iv = record.iv;
  const data = record.data;
  if (typeof id !== "string" || !ID_RE.test(id)) return null;
  if (typeof iv !== "string" || iv.length === 0 || iv.length > MAX_ID_LENGTH) return null;
  if (typeof data !== "string" || data.length === 0 || data.length > MAX_ENVELOPE_B64_LENGTH) {
    return null;
  }
  if (Object.keys(record).length !== 3) return null; // strict: no extra keys
  return { id, iv, data };
}

export class GroupDO {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;

    if (request.method === "PUT" && path === "/beacon") {
      return this.putEnvelope(request, "memberId", "b:", MAX_MEMBERS);
    }
    if (request.method === "PUT" && path === "/pin") {
      return this.putEnvelope(request, "pinId", "p:", MAX_PINS);
    }
    if (request.method === "DELETE" && path.startsWith("/pin/")) {
      const pinId = decodeURIComponent(path.slice("/pin/".length));
      if (!ID_RE.test(pinId)) return new Response("bad pin id", { status: 400 });
      await this.state.storage.delete(`p:${pinId}`);
      return new Response(null, { status: 204 }); // idempotent — deleting a gone pin is success
    }
    if (request.method === "GET" && path === "/state") {
      return this.readState();
    }
    return new Response("not found", { status: 404 });
  }

  private async putEnvelope(
    request: Request,
    idField: "memberId" | "pinId",
    prefix: "b:" | "p:",
    maxRows: number,
  ): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("bad json", { status: 400 });
    }
    const parsed = parseEnvelopeBody(body, idField);
    if (!parsed) return new Response("bad envelope", { status: 400 });

    const key = `${prefix}${parsed.id}`;
    const existing = await this.state.storage.get<StoredEnvelope>(key);
    if (existing === undefined) {
      const rows = await this.state.storage.list({ prefix });
      if (rows.size >= maxRows) return new Response("group full", { status: 409 });
    }
    const stored: StoredEnvelope = {
      iv: parsed.iv,
      data: parsed.data,
      receivedAt: Date.now(),
    };
    await this.state.storage.put(key, stored);
    return new Response(null, { status: 204 });
  }

  private async readState(): Promise<Response> {
    const now = Date.now();
    const beacons: Array<{ memberId: string } & StoredEnvelope> = [];
    const pins: Array<{ pinId: string } & StoredEnvelope> = [];
    const expired: string[] = [];

    for (const [key, value] of await this.state.storage.list<StoredEnvelope>()) {
      const isBeacon = key.startsWith("b:");
      const isPin = key.startsWith("p:");
      if (!isBeacon && !isPin) continue;
      const ttl = isBeacon ? BEACON_TTL_MS : PIN_TTL_MS;
      if (now - value.receivedAt > ttl) {
        expired.push(key); // purge-on-read: no history ever accumulates
        continue;
      }
      if (isBeacon) beacons.push({ memberId: key.slice(2), ...value });
      else pins.push({ pinId: key.slice(2), ...value });
    }
    if (expired.length > 0) await this.state.storage.delete(expired);

    return new Response(JSON.stringify({ beacons, pins }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
