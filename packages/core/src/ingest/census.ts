/**
 * D-10: full-corpus census — the evidence that resolves docs/SCHEMA.md §13's
 * open unknowns. Pure derivation over already-committed raw rows; performs
 * ZERO network requests (reads only what fetch-corpus.ts already wrote to
 * data/raw/).
 *
 * Census counts KGLW (artist_id === 1) rows only, EXCEPT the side-project
 * derived check, whose entire point is to surface the non-KGLW split
 * (docs/SCHEMA.md §9). Census intentionally does NOT apply the
 * settypeAllowlist exclusion (config.settypeAllowlist) — discovering the
 * full settype variant list is exactly what this module exists to do
 * (D-16's allowlist is informed BY this census, not applied by it).
 */
import { config } from "../config.ts";
import { rawSetlistRowCensus, type RawSetlistRow } from "./api-types.ts";
import { parseFootnotesGuarded } from "./normalize.ts";

export interface CensusExampleShow {
  showId: number;
  showdate: string;
}

export interface CensusFieldValue {
  value: string | number;
  rowCount: number;
  showCount: number;
  /** Up to 3 example shows carrying this value. */
  exampleShows: CensusExampleShow[];
}

export interface SegueFrequencyEntry {
  segueRows: number;
  totalRows: number;
  frequency: number;
}

export interface FootnoteParseFailure {
  showId: number;
  showdate: string;
  raw: string;
}

export interface ContiguityViolation {
  showId: number;
  showdate: string;
  expectedPosition: number;
  foundPosition: number;
}

export interface TeaseCandidate {
  showId: number;
  showdate: string;
  field: "footnote" | "shownotes";
  excerpt: string;
}

export interface CensusDerived {
  /** year -> transition_id of each show's LAST row -> number of shows (terminal reliability by era). */
  lastRowTransitionByYear: Record<number, Record<number, number>>;
  /** year -> { segueRows (transition_id 2 or 3), totalRows, frequency } — notation-drift evidence for Phase 2. */
  segueFrequencyByYear: Record<number, SegueFrequencyEntry>;
  /** Rows whose `footnotes` fails JSON.parse — guarded, collected, never thrown (Pitfall 5). */
  footnoteParseFailures: FootnoteParseFailure[];
  /** Non-contiguous position sequences per show — expected to be empty. */
  contiguityViolations: ContiguityViolation[];
  /** year -> count of side-project (artist_id !== 1) rows — visible but excluded from all other KGLW stats. */
  sideProjectRowsByYear: Record<number, number>;
  /** Distinct KGLW song_id count, excluding the Unknown sentinel. */
  distinctKglwSongCount: number;
  /** year -> distinct KGLW show count. */
  showsPerYear: Record<number, number>;
  /** Count of KGLW rows flagged as covers (isoriginal === 0), excluding the Unknown sentinel. */
  coversCount: number;
  /** footnote/shownotes rows matching /tease/i — the tease-notation hunt (docs/SCHEMA.md §13c). */
  teaseCandidates: TeaseCandidate[];
}

export interface CensusResult {
  fields: Record<string, CensusFieldValue[]>;
  derived: CensusDerived;
}

type BucketFn = (raw: unknown) => string | number;

/** Fields censused per RESEARCH's census-report shape. `undefined` bucket = report the raw value as-is. */
const CENSUS_FIELDS: Record<string, BucketFn | undefined> = {
  settype: undefined,
  setnumber: undefined,
  transition_id: undefined,
  isoriginal: undefined,
  isreprise: undefined,
  isjam: undefined,
  isjamchart: undefined,
  isverified: undefined,
  soundcheck: undefined,
  // "distinct presence" per the plan action text — the point is whether a
  // support act was recorded, not every literal opener name.
  opener: (raw) => (raw === "" ? "(none)" : "(populated)"),
  css_class: (raw) => (raw === null ? "(null)" : String(raw)),
  // tour_id sentinel usage per config.tourIdSentinel — not every real tour id.
  tour_id: (raw) =>
    raw === config.tourIdSentinel
      ? `${config.tourIdSentinel} (Not Part of a Tour sentinel)`
      : "(other tour)",
};

function censusField(rows: RawSetlistRow[], field: string, bucket: BucketFn | undefined): CensusFieldValue[] {
  const apply: BucketFn = bucket ?? ((raw) => raw as string | number);
  const byValue = new Map<string | number, { rowCount: number; shows: Map<number, string> }>();

  for (const row of rows) {
    const raw = (row as unknown as Record<string, unknown>)[field];
    const value = apply(raw);
    let entry = byValue.get(value);
    if (!entry) {
      entry = { rowCount: 0, shows: new Map() };
      byValue.set(value, entry);
    }
    entry.rowCount++;
    if (!entry.shows.has(row.show_id)) {
      entry.shows.set(row.show_id, row.showdate);
    }
  }

  const result: CensusFieldValue[] = [];
  for (const [value, entry] of byValue) {
    const exampleShows: CensusExampleShow[] = [...entry.shows.entries()]
      .slice(0, 3)
      .map(([showId, showdate]) => ({ showId, showdate }));
    result.push({ value, rowCount: entry.rowCount, showCount: entry.shows.size, exampleShows });
  }
  result.sort((a, b) => String(a.value).localeCompare(String(b.value)));
  return result;
}

/** Group rows by show_id (no settype filtering — census discovers settype variants, it does not exclude them). */
function groupByShow(rows: RawSetlistRow[]): Map<number, RawSetlistRow[]> {
  const byShow = new Map<number, RawSetlistRow[]>();
  for (const row of rows) {
    const existing = byShow.get(row.show_id);
    if (existing) existing.push(row);
    else byShow.set(row.show_id, [row]);
  }
  return byShow;
}

const TEASE_PATTERN = /tease/i;

export function runCensus(rowsByFile: Map<string, unknown[]>): CensusResult {
  const allRaw: unknown[] = [];
  for (const rows of rowsByFile.values()) {
    allRaw.push(...rows);
  }

  const validated: RawSetlistRow[] = allRaw.map((row) => rawSetlistRowCensus.parse(row));
  const kglwRows = validated.filter((row) => row.artist_id === 1);
  const nonKglwRows = validated.filter((row) => row.artist_id !== 1);

  // --- distinct-value field census (KGLW rows only) ---
  const fields: Record<string, CensusFieldValue[]> = {};
  for (const [field, bucket] of Object.entries(CENSUS_FIELDS)) {
    fields[field] = censusField(kglwRows, field, bucket);
  }

  const kglwByShow = groupByShow(kglwRows);

  // --- (a) last-row transition_id distribution per year ---
  const lastRowTransitionByYear: Record<number, Record<number, number>> = {};
  // --- (d) contiguity violations ---
  const contiguityViolations: ContiguityViolation[] = [];
  // --- (f) shows per year ---
  const showsPerYear: Record<number, number> = {};

  for (const showRows of kglwByShow.values()) {
    const sorted = [...showRows].sort((a, b) => a.position - b.position);
    const showId = sorted[0].show_id;
    const showdate = sorted[0].showdate;
    const year = sorted[0].showyear;

    showsPerYear[year] = (showsPerYear[year] ?? 0) + 1;

    for (let i = 0; i < sorted.length; i++) {
      const expectedPosition = i + 1;
      if (sorted[i].position !== expectedPosition) {
        contiguityViolations.push({
          showId,
          showdate,
          expectedPosition,
          foundPosition: sorted[i].position,
        });
        break; // one violation per show is enough evidence; census never throws
      }
    }

    const lastTransitionId = sorted[sorted.length - 1].transition_id;
    lastRowTransitionByYear[year] ??= {};
    lastRowTransitionByYear[year][lastTransitionId] =
      (lastRowTransitionByYear[year][lastTransitionId] ?? 0) + 1;
  }

  // --- (b) per-year segue frequency (transition_id 2 or 3) ---
  const segueFrequencyByYear: Record<number, SegueFrequencyEntry> = {};
  for (const row of kglwRows) {
    const year = row.showyear;
    segueFrequencyByYear[year] ??= { segueRows: 0, totalRows: 0, frequency: 0 };
    segueFrequencyByYear[year].totalRows++;
    if (row.transition_id === 2 || row.transition_id === 3) {
      segueFrequencyByYear[year].segueRows++;
    }
  }
  for (const entry of Object.values(segueFrequencyByYear)) {
    entry.frequency = entry.totalRows > 0 ? entry.segueRows / entry.totalRows : 0;
  }

  // --- (c) footnotes JSON.parse failures (guarded — never throws) ---
  const footnoteParseFailures: FootnoteParseFailure[] = [];
  for (const row of kglwRows) {
    if (row.footnotes === null) continue;
    const { footnotesParsed, footnotesRaw } = parseFootnotesGuarded(row.footnotes);
    if (footnotesParsed === null && footnotesRaw !== null) {
      footnoteParseFailures.push({ showId: row.show_id, showdate: row.showdate, raw: footnotesRaw });
    }
  }

  // --- (e) side-project row counts per year (visible, excluded from all other stats) ---
  const sideProjectRowsByYear: Record<number, number> = {};
  for (const row of nonKglwRows) {
    sideProjectRowsByYear[row.showyear] = (sideProjectRowsByYear[row.showyear] ?? 0) + 1;
  }

  // --- (f) distinct KGLW songs + covers count (excluding the Unknown sentinel) ---
  const sentinelIds = config.sentinelSongIds as readonly number[];
  const distinctSongIds = new Set<number>();
  let coversCount = 0;
  for (const row of kglwRows) {
    if (sentinelIds.includes(row.song_id)) continue;
    distinctSongIds.add(row.song_id);
    if (row.isoriginal === 0) coversCount++;
  }

  // --- (g) tease-notation hunt: footnote/shownotes matching /tease/i ---
  const teaseCandidates: TeaseCandidate[] = [];
  for (const row of kglwRows) {
    if (TEASE_PATTERN.test(row.footnote)) {
      teaseCandidates.push({
        showId: row.show_id,
        showdate: row.showdate,
        field: "footnote",
        excerpt: row.footnote.slice(0, 200),
      });
    }
    if (TEASE_PATTERN.test(row.shownotes)) {
      teaseCandidates.push({
        showId: row.show_id,
        showdate: row.showdate,
        field: "shownotes",
        excerpt: row.shownotes.slice(0, 200),
      });
    }
  }

  return {
    fields,
    derived: {
      lastRowTransitionByYear,
      segueFrequencyByYear,
      footnoteParseFailures,
      contiguityViolations,
      sideProjectRowsByYear,
      distinctKglwSongCount: distinctSongIds.size,
      showsPerYear,
      coversCount,
      teaseCandidates,
    },
  };
}
