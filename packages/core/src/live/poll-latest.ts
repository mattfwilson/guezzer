/**
 * Tolerant live poller for the `latest` endpoint (SYNC-01 / D-06, Phase 5
 * plan 05-01 Task 2).
 *
 * This mirrors `fetchJson` (cli/fetch-corpus.ts) — same GET idiom, same
 * descriptive User-Agent, same `AbortSignal.timeout` — but INVERTS its
 * failure policy. `fetchJson` is the BUILD-TIME fetcher: a non-OK status or
 * an `error: true` envelope HARD-FAILS so the owner diagnoses and re-runs.
 * `pollLatest` is the LIVE path: the app hook (plan 05-04) calls it once per
 * ≤60s interval and simply retries next tick, so ANY soft failure must yield
 * `[]` and NEVER throw (D-06). A crash here would take down the show-tracker
 * mid-set — the exact failure mode this tool exists to avoid.
 *
 * Trust boundary (kglw.net → core):
 * - T-05-01: every row validated by `latestSetlistRow`; a bad row is skipped
 *   (single `console.debug` line, never thrown), not fatal.
 * - T-05-02: `artist_id === 1` filter (DATA-03) — the API silently ignores
 *   filters, so foreign-band rows (e.g. the Stu Mackenzie solo set `latest`
 *   can surface, SCHEMA §9) are discarded here, never surfaced downstream.
 * - T-05-04: tolerant catch swallows failures with no stack trace surfaced
 *   (ASVS V7); a single debug line at most.
 *
 * Cadence/etiquette (T-05-03): this performs EXACTLY ONE GET per call. The
 * ≤1/60s cadence + active-show gate is the app hook's job (plan 05-04).
 */
import { config } from "../config.ts";
import {
  detectNovelKeys,
  formatRowError,
  latestSetlistRow,
  type LatestSetlistRow,
} from "../ingest/latest-types.ts";

export interface PollDeps {
  fetch: typeof globalThis.fetch;
}

/**
 * The result of one poll (LIVE-03). `rows` is the artist-scoped, validated
 * array (identical content to the pre-11-02 array return). `schemaDrift` is
 * `true` when any row carried an additive API key the schema does not know
 * about; `novelKeys` lists those key NAMES (present only when drift occurred,
 * never editor values — T-11-02-03). The app tier (plan 11-04) consumes this
 * to surface a one-per-poll drift notice without the poller ever throwing.
 */
export interface PollResult {
  rows: LatestSetlistRow[];
  schemaDrift: boolean;
  novelKeys?: string[];
}

interface ApiEnvelope {
  error: boolean;
  error_message: string;
  data: unknown[];
}

const defaultDeps: PollDeps = { fetch: globalThis.fetch };

/**
 * GET the `latest` endpoint once and return a `PollResult` carrying the
 * validated, artist-scoped `rows` plus a once-per-poll `schemaDrift` signal.
 * Returns `{ rows: [], schemaDrift: false }` on ANY soft failure (non-OK
 * status, `error: true` envelope, network/timeout rejection, malformed body) —
 * never throws (V7). A valid empty result (`data: []`, a show with no rows yet
 * — SCHEMA §1) also returns the empty result and is treated as success.
 */
export async function pollLatest(deps: PollDeps = defaultDeps): Promise<PollResult> {
  try {
    const res = await deps.fetch(`${config.apiBase}${config.latestPath}`, {
      headers: { "User-Agent": config.userAgent },
      signal: AbortSignal.timeout(config.fetchTimeoutMs),
    });

    // INVERTED vs. fetchJson: a non-OK status is a soft failure the caller
    // retries next interval, never a hard throw (D-06).
    if (!res.ok) return { rows: [], schemaDrift: false };

    const body = (await res.json()) as ApiEnvelope;

    // INVERTED vs. fetchJson: an error envelope is a soft failure, not a throw.
    if (body.error) return { rows: [], schemaDrift: false };

    // data: [] is a VALID empty result (SCHEMA §1), not an error.
    const rawRows = Array.isArray(body.data) ? body.data : [];

    const validated: LatestSetlistRow[] = [];
    // LIVE-03: aggregate novel keys across the whole poll so drift is logged
    // ONCE after the loop, never once per row (RESEARCH Pitfall 2).
    const novel = new Set<string>();
    for (const raw of rawRows) {
      // Drift DETECTION runs on the raw row regardless of parse outcome — an
      // additive key no longer empties the row (it stays usable via catchall),
      // but we still want to surface the new field name.
      if (raw && typeof raw === "object") {
        for (const key of detectNovelKeys(raw as Record<string, unknown>)) novel.add(key);
      }

      const parsed = latestSetlistRow.safeParse(raw);
      if (!parsed.success) {
        // Per-row tolerance: skip a malformed row, never throw. A single debug
        // line with show context (T-05-04 — no stack trace surfaced).
        console.debug(`pollLatest: skipping malformed latest row — ${formatRowError(parsed.error, raw)}`);
        continue;
      }
      // T-05-02 / DATA-03 (LIVE-02): enforce KGLW scope tolerantly. The API
      // silently ignores filters, so a foreign-band row (SCHEMA §9) can appear.
      // This is the SOLE artist-scope point — no second filter downstream.
      if (parsed.data.artist_id !== 1) continue;
      validated.push(parsed.data);
    }

    // Single drift log for the whole poll — key NAMES only, never editor values
    // (T-11-02-03 / SCHEMA §12), no stack trace (V7).
    if (novel.size > 0) {
      console.debug(`pollLatest: schema drift — novel latest keys: ${[...novel].join(", ")}`);
    }

    return {
      rows: validated,
      schemaDrift: novel.size > 0,
      novelKeys: novel.size > 0 ? [...novel] : undefined,
    };
  } catch {
    // Network reject, timeout abort, JSON parse blowup — all soft failures.
    // The app hook retries next interval (D-06). No stack trace surfaced (V7).
    return { rows: [], schemaDrift: false };
  }
}
