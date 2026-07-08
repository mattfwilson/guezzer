/**
 * Paced sequential fetcher (D-07/P11/D-05/D-06/D-12) — the only code in this
 * project that touches kglw.net's bulk endpoints. Never runs in CI, never
 * runs in a test (tests inject a mocked `{ fetch, sleep }` pair — see
 * fetch.test.ts). This is the one-time / occasional live-API code path
 * documented in plan 01-03 Task 2.
 *
 * Per docs/SCHEMA.md §9 and D-12: every filtered fetch is followed by
 * assertFilterApplied. Per docs/SCHEMA.md §1: `data: []` is a valid empty
 * result, never an error. Per Pitfall 3: a year response larger than
 * config.maxRowsPerYearSanity is treated as evidence of silent filter-ignore
 * and hard-fails rather than being silently committed.
 *
 * D-07 is absolute: strictly sequential (never Promise.all/concurrent),
 * a courtesy delay between every pair of requests, a descriptive
 * User-Agent naming the project + owner contact, and no automatic
 * re-request of any kind on failure — a hard failure names the endpoint
 * and the exact reason so the owner can diagnose and re-run just the
 * affected year via `--year N`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.ts";
import { rawSetlistRowCensus, type RawSetlistRow } from "../ingest/api-types.ts";
import { assertFilterApplied } from "../ingest/validate.ts";

export interface FetchDeps {
  fetch: typeof globalThis.fetch;
  sleep: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const defaultDeps: FetchDeps = {
  fetch: globalThis.fetch,
  sleep: defaultSleep,
};

interface ApiEnvelope {
  error: boolean;
  error_message: string;
  data: unknown[];
}

/**
 * GET `config.apiBase + path`, per D-07: descriptive User-Agent, an
 * AbortSignal timeout, and NO automatic re-request on any failure — a
 * non-OK HTTP status or an `error: true` envelope both hard-fail
 * immediately, naming the path so the owner can diagnose and re-run.
 */
export async function fetchJson(path: string, deps: FetchDeps = defaultDeps): Promise<unknown[]> {
  const res = await deps.fetch(`${config.apiBase}${path}`, {
    headers: { "User-Agent": config.userAgent },
    signal: AbortSignal.timeout(config.fetchTimeoutMs),
  });

  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} from ${path} — hard failure, D-07 forbids automatic re-requests. ` +
        `Diagnose the cause, then re-run just this endpoint.`,
    );
  }

  const body = (await res.json()) as ApiEnvelope;
  if (body.error) {
    throw new Error(`API error from ${path}: ${body.error_message}`);
  }
  // NOTE: data: [] is a VALID empty result, not an error (docs/SCHEMA.md §1).
  return body.data;
}

export interface FetchCorpusOptions {
  /** Years to fetch per-year setlists for, e.g. config.corpusYearStart..currentYear. */
  years: number[];
  /** Also fetch shows.json/songs.json/albums.json/jamcharts.json after the per-year setlists. */
  includeTables?: boolean;
  /** Defaults to config.dataRawDir; overridable for tests (writes to a temp dir). */
  outputDir?: string;
}

export interface FetchMetaEntry {
  fetchedAt: string;
  rowCount: number;
}

export interface FetchCorpusResult {
  filesWritten: string[];
  meta: Record<string, FetchMetaEntry>;
}

const SIBLING_TABLES = ["shows", "songs", "albums", "jamcharts"] as const;

async function writeRawFile(outputDir: string, fileName: string, rows: unknown[]): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, fileName), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

/** Merge new fetch-meta entries into the existing committed file, so a partial (per-year) refresh only updates the touched entries (D-05). */
async function mergeFetchMeta(
  outputDir: string,
  newEntries: Record<string, FetchMetaEntry>,
): Promise<void> {
  const metaPath = join(outputDir, "fetch-meta.json");
  let existing: Record<string, FetchMetaEntry> = {};
  try {
    existing = JSON.parse(await readFile(metaPath, "utf8"));
  } catch {
    // No existing fetch-meta.json yet (first run) — start fresh.
  }

  const merged: Record<string, FetchMetaEntry> = { ...existing, ...newEntries };
  const sorted: Record<string, FetchMetaEntry> = {};
  for (const key of Object.keys(merged).sort()) {
    sorted[key] = merged[key];
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(metaPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

/**
 * Fetch the requested years' per-year setlists (and optionally the sibling
 * tables) strictly sequentially, with a courtesy delay between EVERY pair of
 * consecutive requests. After each per-year fetch: structural zod
 * validation (census-mode), the D-12 filter assertion on `showyear`, and
 * the Pitfall-3 row-count sanity check. Raw files keep ALL artists' rows —
 * artist filtering happens client-side downstream at census/normalize time,
 * never here (raw = untouched source of truth, D-06).
 */
export async function fetchCorpus(
  options: FetchCorpusOptions,
  deps: FetchDeps = defaultDeps,
): Promise<FetchCorpusResult> {
  const outputDir = options.outputDir ?? config.dataRawDir;
  const meta: Record<string, FetchMetaEntry> = {};
  const filesWritten: string[] = [];

  let hasMadeARequest = false;
  const paceNextRequest = async (): Promise<void> => {
    if (hasMadeARequest) {
      await deps.sleep(config.fetchDelayMs);
    }
    hasMadeARequest = true;
  };

  for (const year of options.years) {
    await paceNextRequest();

    const endpoint = `setlists/showyear/${year}`;
    const rawRows = await fetchJson(`/${endpoint}.json`, deps);
    const validated: RawSetlistRow[] = rawRows.map((row) => rawSetlistRowCensus.parse(row));

    if (validated.length > 0) {
      assertFilterApplied(validated, endpoint, { field: "showyear", expected: year });
    }

    if (validated.length > config.maxRowsPerYearSanity) {
      throw new Error(
        `Row-count sanity check failed for ${endpoint}: got ${validated.length} rows, ` +
          `expected at most config.maxRowsPerYearSanity (${config.maxRowsPerYearSanity}). ` +
          `This is almost certainly a silent-filter-ignore poisoning (Pitfall 3) — check the URL path.`,
      );
    }

    const fileName = `setlists-${year}.json`;
    await writeRawFile(outputDir, fileName, validated);
    filesWritten.push(fileName);
    meta[fileName] = { fetchedAt: new Date().toISOString(), rowCount: validated.length };
  }

  if (options.includeTables) {
    for (const table of SIBLING_TABLES) {
      await paceNextRequest();

      const rows = await fetchJson(`/${table}.json`, deps);

      if (table === "albums") {
        const kglwCount = rows.filter((row) => (row as Record<string, unknown>).artist_id === 1).length;
        console.log(
          `albums.json: ${kglwCount} KGLW rows, ${rows.length - kglwCount} non-KGLW rows ` +
            `(raw file keeps all rows — artist filtering is client-side downstream, D-06)`,
        );
      }

      const fileName = `${table}.json`;
      await writeRawFile(outputDir, fileName, rows);
      filesWritten.push(fileName);
      meta[fileName] = { fetchedAt: new Date().toISOString(), rowCount: rows.length };
    }
  }

  await mergeFetchMeta(outputDir, meta);

  return { filesWritten, meta };
}
