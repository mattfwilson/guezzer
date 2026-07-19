/**
 * TEST HARNESS ONLY (quick task 260713-wjd) — a `?mockLatest=1` URL flag that
 * feeds the live-sync pipeline FIXTURE rows instead of hitting kglw.net.
 *
 * Why it exists: the SuggestionStrip (SYNC-02) only shows content while
 * kglw.net editors are live-logging a show, so manual/UAT testing outside a
 * real show required DevTools response overrides + 60s poll waits, and was
 * impossible on-device. With the flag, `useLatestPoll` swaps ONLY the fetch —
 * zod validation (latestSetlistRow), the artist_id gate, the dedupe diff, and
 * all strip/adopt/dismiss behavior still run the real code path.
 *
 * Fixture: four real catalog songs (ids from data/normalized/
 * transition-matrix.json) dated today (local), so adopting recenters the
 * orbit with a genuine prediction fan and the D-07 auto-bind can fire.
 *
 * Safety: inert unless `mockLatest=1` is EXPLICITLY in the query string —
 * normal loads return null and the poller uses the real network fetch. A
 * personal tool (no product users to confuse); the flag is documented here
 * and in the quick-task summary.
 */
import type { LatestSetlistRow } from "@guezzer/core";

/** Local YYYY-MM-DD (matches db.ts todayIso semantics — device-local date). */
function todayLocalIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fixtureRow(
  song_id: number,
  songname: string,
  position: number,
): LatestSetlistRow {
  return {
    // ── The 11 consumed fields ──
    show_id: 1999999999,
    showdate: todayLocalIso(),
    song_id,
    songname,
    artist_id: 1,
    position,
    setnumber: "1",
    settype: "Set",
    venue_id: 873,
    venuename: "Mock Venue",
    city: "Testville",
    // ── Present-but-unconsumed keys (schema enumerates them for strict
    //    drift detection; values ignored) — mirroring the real row shape ──
    uniqueid: String(90000 + position),
    showtitle: "",
    artist: "King Gizzard & The Lizard Wizard",
    permalink: "mock-show.html",
    transition_id: 1,
    transition: ", ",
    footnote: "",
    footnotes: null,
    isjamchart: 0,
    jamchart_notes: null,
    shownotes: "",
    showyear: 2026,
    showorder: 1,
    opener: "",
    tour_id: 1,
    tourname: "Mock Tour",
    soundcheck: "",
    isverified: 0,
    slug: songname.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    isoriginal: 1,
    original_artist: "",
    state: "VIC",
    country: "Australia",
    isreprise: 0,
    isjam: 0,
  };
}

/**
 * The additive key injected by the `?mockLatest=drift` path (LIVE-03, 11-04).
 * It is NOT in the schema's KNOWN_LATEST_KEYS, so `pollLatest`'s `detectNovelKeys`
 * surfaces it as `schemaDrift` while `.catchall` keeps the row usable — exactly
 * the additive-field scenario the amber SyncDot state exists to exercise. A key
 * NAME only (the value is inert filler; drift detail never renders values).
 */
export const MOCK_NOVEL_KEY = "mock_novel_field";

/**
 * Returns a fixture-serving fetch stub when `?mockLatest=1` (or `=drift`) is in
 * the URL, else null (normal network path). Read once per call — the flag can't
 * change without a reload, so callers may cache the result at module/mount scope.
 *
 * `?mockLatest=drift` injects `MOCK_NOVEL_KEY` into every fixture row so the
 * LIVE-03 amber drift path (pollLatest → useLatestPoll → SyncDot) can be driven
 * on-device without waiting for kglw.net to actually add a field.
 */
export function getMockLatestFetch(): typeof globalThis.fetch | null {
  if (typeof location === "undefined") return null;
  const flag = new URLSearchParams(location.search).get("mockLatest");
  if (flag !== "1" && flag !== "drift") return null;

  const injectDrift = flag === "drift";
  const rows: Record<string, unknown>[] = [
    fixtureRow(168, "Rattlesnake", 1),
    fixtureRow(172, "Robot Stop", 2),
    fixtureRow(81, "Gaia", 3),
    fixtureRow(133, "Mars for the Rich", 4),
  ].map((r) =>
    injectDrift ? { ...r, [MOCK_NOVEL_KEY]: "unexpected-additive-value" } : r,
  );

  const envelope = {
    error: false,
    error_message: "",
    data: rows,
  };
  return async () =>
    new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

/** First-tick delay while mocking — near-instant instead of the 60s floor. */
export const MOCK_FIRST_TICK_MS = 2000;
