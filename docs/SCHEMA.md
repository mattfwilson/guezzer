# kglw.net API Schema — Empirical Reference

**Status:** v1 — written from real API samples, BEFORE any extraction code (`normalize.ts`, `cli/*`) exists in this repo. This is the D-09 "why" document; `packages/core/src/ingest/api-types.ts` is its executable "what" pair (zod schemas). Every claim below traces to a real sample file or a documented prior live fetch — see the evidence tag on each claim.

**Evidence sources:**
- `data/samples/rr1010.json` — Red Rocks 2022-10-10 "Marathon Night 1" (27 rows, `show_id: 1678309429`)
- `data/samples/showyear2013.json` — full year 2013 (149 rows, 26 distinct shows)
- "prior live fetch" — `.planning/research/ARCHITECTURE.md` Part 1, 11 live requests against `https://kglw.net/api/v2` on 2026-07-08

---

## 1. Envelope

Every response from the kglw.net API v2 has the shape:

```json
{ "error": false, "error_message": "", "data": [ /* array of rows */ ] }
```

- `error` is a boolean in practice (docs describe 0/1). [source: prior live fetch]
- **`data: []` with `error: false` is a VALID empty result, never an error.** Verified: `/setlists/showdate/2025-11-21.json` (no show that day) returned `{"error":false,"error_message":"","data":[]}`. [source: prior live fetch] Ingestion code must never treat an empty array as a failure — future years, off-nights, and years before the band existed all legitimately return `data: []`.
- The two committed samples are both non-empty envelopes: rr1010.json wraps 27 rows, showyear2013.json wraps 149 rows. [source: rr1010.json, showyear2013.json — spot-verified: `data.length` === 27 and 149 respectively]

## 2. Setlist row: all 41 fields

Both samples share an identical 41-key row shape — the `setlists` schema has been stable from 2013 through 2022 in the samples examined. [source: rr1010.json data[0], showyear2013.json — key-set diff is empty]

### Real row excerpt (rr1010.json, `data[0]`)

```json
{
  "uniqueid": "766",
  "show_id": 1678309429,
  "showdate": "2022-10-10",
  "showtime": null,
  "showtitle": "Marathon Night 1",
  "artist": "King Gizzard & the Lizard Wizard",
  "song_id": 133,
  "songname": "Mars For the Rich",
  "artist_id": 1,
  "permalink": "king-gizzard-the-lizard-wizard-october-10-2022-red-rocks-amphitheatre-morrison-co-usa.html",
  "settype": "Set",
  "setnumber": "1",
  "position": 1,
  "tracktime": "4:22",
  "transition_id": 2,
  "transition": " > ",
  "footnote": "",
  "footnotes": null,
  "isjamchart": 0,
  "jamchart_notes": null,
  "venue_id": 447,
  "shownotes": "…long prose; contains raw HTML anchors and \\r\\n — untrusted content, carry verbatim, never render…",
  "showyear": 2022,
  "showorder": 1,
  "opener": "Leah Senior",
  "tour_id": 49,
  "tourname": "2022 World Tour Fall",
  "soundcheck": "",
  "isverified": 1,
  "slug": "mars-for-the-rich",
  "isoriginal": 1,
  "original_artist": "",
  "venuename": "Red Rocks Amphitheatre",
  "city": "Morrison",
  "state": "CO",
  "country": "USA",
  "timezone": null,
  "isreprise": 0,
  "isjam": 0,
  "css_class": null,
  "isrecommended": 0
}
```

### Field-type census table

| Field | Type(s) | Notes |
|-------|---------|-------|
| `uniqueid` | string | numeric string, e.g. `"766"` |
| `show_id` | number | 10-digit integer, permanent per-show identifier |
| `song_id` | number | catalog song identifier; `1` is a reserved sentinel (§6) |
| `venue_id` | number | |
| `tour_id` | number | `1` is a reserved "Not Part of a Tour" sentinel (§11) |
| `showdate` | string | `YYYY-MM-DD` |
| `showtime` | null | never populated in either sample — treat as permissive nullable (`z.unknown().nullable()` or `z.null()`), never rely on a value |
| `showtitle` | string | often empty string |
| `artist` | string | e.g. `"King Gizzard & the Lizard Wizard"` |
| `permalink` | string | |
| `settype` | string | enum-ish; census-pending allowlist — see §10 |
| `transition` | string | display string — **whitespace-significant garbage, never parse** (§4) |
| `footnote` | string | plain string, same content as `footnotes[0]` when present, else `""` |
| `shownotes` | string | untrusted raw HTML/prose — see §12 |
| `opener` | string | often names a support act |
| `tourname` | string | |
| `soundcheck` | string | always `""` in both samples |
| `slug` | string | song slug; `_custom_` is the Unknown-sentinel slug (§6) |
| `original_artist` | string | populated only on cover rows (`isoriginal: 0`) |
| `venuename`, `city`, `state`, `country` | string | |
| `artist_id` | number | `1` = King Gizzard & the Lizard Wizard (§9) |
| `position` | number | global, contiguous 1..N across the whole show including encore (§3) |
| `transition_id` | number | int; enum-ish, census-pending (§4) |
| `showyear` | number | **NUMBER, not string** — verified on both samples; a D-12 filter assertion comparing against a string would always fail |
| `showorder` | number | disambiguates same-date shows (§11) |
| `isjamchart` | number | 0/1 flag, NOT a boolean |
| `isverified` | number | 0/1 flag, NOT a boolean |
| `isoriginal` | number | 0/1 flag, NOT a boolean — 0 marks a cover (§6) |
| `isreprise` | number | 0/1 flag, NOT a boolean — **unreliable, do not trust** (§5) |
| `isjam` | number | 0/1 flag, NOT a boolean |
| `isrecommended` | number \| null | |
| `setnumber` | string | `"1"`, `"2"`, `"e"` observed; `"3"` unconfirmed pending full-corpus census (§3) |
| `tracktime` | string \| null | e.g. `"4:22"`; empty string also observed |
| `jamchart_notes` | string \| null | |
| `css_class` | string \| null | |
| `footnotes` | string \| null | **double-encoded JSON string** or `null` (§8) |
| `timezone` | null | never populated in either sample |

That is 41 distinct keys, matching between both samples exactly.

## 3. Song ordering & set structure

- `position` is **global and contiguous 1..N across the entire show, including the encore.** [source: rr1010.json — 27 rows, positions 1–27 contiguous across `setnumber` "1" and "2"; prior live fetch confirmed the same pattern with an encore, CAVS 2026-05-22: set 1 positions 1–8, encore position 9]
- **Set membership comes ONLY from `setnumber` grouping — never from `position` alone and never from `transition_id`.** Sort within a `setnumber` group by `position`.
- Observed `setnumber` vocabulary so far: `"1"`, `"2"` (rr1010.json), `"e"` (encore, prior live fetch + showyear2013.json). `"3"` (a third regular set) has not been observed in either committed sample — **Open Unknown, resolved by full-corpus census** (§13a).
- `settype` is **useless for structure detection**: on rr1010.json it is `"Set"` on every row including set 2 — it does not distinguish sets, and it does not flag the encore either. [source: rr1010.json]

## 4. `transition_id` vocabulary

**CRITICAL RULE — bold and non-negotiable: never infer set or show boundaries from `transition_id`.** Group by `setnumber` first, sort by `position` within each group; set boundary always wins over whatever `transition_id` says. This is not a style preference — showyear2013.json empirically falsifies boundary-by-transition-id: **14 of the 26 shows in 2013 end their final row with `transition_id: 1`** ("normal break"), not a terminal id. [source: showyear2013.json — per-show last-row `transition_id` distribution: id 1 × 14 shows, id 5 × 9 shows, id 6 × 3 shows]

Observed vocabulary and working interpretation:

| `transition_id` | display string | Meaning | Evidence |
|---|---|---|---|
| 1 | `", "` | Normal break (pause between songs) | Dominant value: 132 of 149 rows in showyear2013.json; also the most common (and unreliable) show-terminal value |
| 2 | `" > "` | Notated segue | 3 occurrences in showyear2013.json; also seen in rr1010.json (`data[0]`, into "Mars For the Rich") |
| 3 | `" ->"` | Seamless/deeper segue (phish.net-style convention) | 1 occurrence in showyear2013.json (2013-02-23, "Crookedile" into "I Wanna Be Your Dog") |
| 4 | `"  "` (two spaces) | **Set-break terminal variant** — observed once: rr1010.json position 13, "Magma", the LAST song of set 1 (display string identical to id 6) | [source: rr1010.json — spot-verified `data.find(r => r.position === 13)`] |
| 5 | `""` (empty) | Terminal/boundary marker — observed both as end-of-set-before-encore (showyear2013.json 2013-02-23, position 8, last row of set "1" immediately before the `"e"` encore group begins) and as a full-show terminal (9 of 26 2013 shows) | [source: showyear2013.json] |
| 6 | `"  "` (two spaces) | Terminal/boundary marker — same display string as id 4; observed as show-terminal (3 of 26 2013 shows) and as rr1010.json's true final row (position 27, last song of set 2, no encore) | [source: rr1010.json, showyear2013.json] |

**Ids 4, 5, and 6 are interchangeable terminal/boundary markers used inconsistently by editors** — none of them reliably means "end of set" vs. "end of show" vs. "before an encore." Never branch structural logic on their presence. Ids 2 and 3 are the only ones that carry real predictive signal (Signal 3, notated hard segue).

## 5. Set/encore delimiting

- The encore is its own `setnumber` value: `"e"`. [source: prior live fetch — CAVS 2026-05-22; and showyear2013.json 2013-02-23, positions 9–10]
- Example set→encore boundary: showyear2013.json, 2013-02-23 — position 8 ("Jam", last row of `setnumber: "1"`) carries `transition_id: 5`; position 9 ("Unknown", first row of `setnumber: "e"`) begins the encore. [source: showyear2013.json — spot-verified]
- `settype` does **not** flag the encore row differently from regular set rows — confirmed on both the 2022 sample (`settype: "Set"` throughout) and prior live fetch. Only `setnumber === "e"` identifies an encore.

## 6. Covers & the Unknown sentinel

- **Covers** are marked by `isoriginal: 0` with `original_artist` populated. showyear2013.json has 9 rows with `isoriginal: 0` (including the Unknown sentinel, see below); excluding the sentinel, 5 are genuine covers: "I Gotta Rock 'n' Roll" (The Reatards, 3 occurrences), "Open My Eyes" (Nazz), "I Wanna Be Your Dog" (The Stooges). [source: showyear2013.json — spot-verified] Per D-13, covers are included as normal catalog songs with an `isCover` flag; transitions through them stay intact.
- **The "Unknown" sentinel song**: `song_id: 1`, `songname: "Unknown"`, `slug: "_custom_"`, `isoriginal: 0` — 4 occurrences in showyear2013.json (all in shows the site staff noted as "likely incomplete" setlists). [source: showyear2013.json — spot-verified] This is a placeholder occupying a position slot when the actual song played is unknown/unconfirmed, **not** a real catalog song. The normalizer must: keep it as a positional entry (it occupies a slot in the show), but exclude it from the song catalog and from transition-edge emission (it would otherwise create a garbage "Unknown" node in the constellation and a nonsense prediction candidate). `config.ts` carries an explicit `sentinelSongIds: [1]` list for this purpose (Pitfall 7).

## 7. Multi-set representation

- **RESOLVED**: rr1010.json (Red Rocks 2022-10-10, a marathon show) uses `setnumber: "1"` and `setnumber: "2"` — plain string numerals, not integers, not zero-padded. 27 rows, positions 1–27 contiguous across both sets, no encore in this particular show. [source: rr1010.json]
- A three-set show (`setnumber: "3"`) has not appeared in either committed sample — flagged as an Open Unknown (§13a), to be resolved once the full corpus is fetched.

## 8. Footnotes/teases

- `footnotes` (plural) is either `null` or a **string containing double-encoded JSON** — e.g. `"[\"first confirmed performance\"]"` is itself a JSON-array-of-one-string, serialized as a string value inside the outer JSON envelope. [source: showyear2013.json — 23 of 149 rows carry a non-null `footnotes` value, all of the form `["<single string>"]`]
- `footnote` (singular) carries the same content as a plain display string (no JSON wrapping) — e.g. `footnotes: "[\"first confirmed performance\"]"` pairs with `footnote: "first confirmed performance"` on the same row. [source: showyear2013.json — spot-verified across all 23 rows]
- A guarded `JSON.parse` is required when consuming `footnotes`: **parse failure must keep the raw string and never throw** — teases/footnotes are carried verbatim regardless of parse success (D-15), so a malformed value anywhere in 15 years of editor-entered data costs nothing structurally.
- **Zero explicit tease rows/fields exist in the schema.** The only place teases have been observed in either sample is inside free-text `shownotes` prose: rr1010.json position 13 ("Magma")'s `shownotes` field reads in part "*An I In Heaven? was teased prior to Magenta Mountain... Rattlesnake contained teases and quotes from O.N.E., Automation, Honey, and Minimum Brain Size, and teases of Sleep Drifter...*" — teases are narrated in prose, not structured data. [source: rr1010.json — spot-verified] `footnote`/`shownotes` remain the only candidate locations (§13c, Open Unknown).

## 9. Multi-artist database & silent filter-ignore

- The kglw.net database covers KGLW **and side projects** sharing every table. Observed `artist_id` values include `1` = King Gizzard & the Lizard Wizard, `4` = Stu Mackenzie, `23` = CAVS, `34` = The Lexies, `17` = Sambrose Automobile. [source: prior live fetch] `latest.json` has returned a Stu Mackenzie solo set as the most recent show — side-project rows can appear anywhere, including endpoints one might assume are KGLW-only.
- **CRITICAL GOTCHA — invalid filter paths are silently ignored, not empty-set or error:** `/songs/isoriginal/0.json` returned the entire unfiltered table (including `isoriginal: 1` rows), not a filtered subset. [source: prior live fetch] A typo'd filter path (e.g. `/setlists/showyr/2013.json`) returns the ENTIRE multi-artist table, silently. **The only defense is the post-fetch `assertFilterApplied` (D-12)** — every filtered fetch must be followed by an assertion that every returned row actually matches the requested filter, or the fetch hard-fails naming the endpoint, field, expected/actual values, and an example row.
- `showyear2013.json` itself demonstrates the filter working correctly when used properly: all 149 rows have `showyear === 2013` (a number). [source: showyear2013.json — spot-verified] All 149 rows also happen to have `artist_id === 1`, but this is coincidence (no documented side-project shows in 2013) — it does **not** prove the showyear endpoint filters by artist. Client-side `artist_id === 1` filtering remains mandatory on every ingested row regardless of which endpoint/filter was used to fetch it.
- **`songs.json` has NO `artist_id` field** — the KGLW song catalog can never be derived from `songs.json` alone (side-project songs are indistinguishable there). The catalog must be derived from the distinct `song_id`s observed in `artist_id === 1` setlist rows, using `songs.json` only as supplementary metadata (name, slug, isoriginal, original_artist). [source: prior live fetch]

## 10. `settype` variants & corpus scope

Observed `settype` values (by distinct show, showyear2013.json — 26 shows total):

| `settype` | Show count | Notes |
|---|---|---|
| `"Set"` | 13 shows | Standard live set |
| `"One Set"` | 11 shows | Also a standard live set — presumably a single-set show, not a soundcheck/exclusion case |
| `"Live Session"` | 2 shows | Both at "PBS Studios" (a Melbourne radio station) — a radio session, not a public concert. [source: showyear2013.json — spot-verified: 2013-02-08, songs "Head On/Pill" and "Elbow" among others, 18 total rows] |

`"Live Session"` is exactly the D-16 exclusion case: a radio session's song choices would pollute rotation and transition signals if treated as a normal show. **Working allowlist: `{"Set", "One Set"}`** (encoded in `config.ts` as `settypeAllowlist`, marked PROVISIONAL) — this excludes `"Live Session"` from the corpus scope. **Final list pending full-corpus census** — watch for additional variants ("Soundcheck", festival-specific labels, etc.) that may appear outside the two committed samples (§13d, Open Unknown).

## 11. Sibling endpoints

- **`shows.json`** — one row per show: `show_id, showdate, showtime, permalink, artist_id, artist, showtitle, venue_id, venuename, location, city, state, country, timezone, tour_id, tourname, showorder, show_year, show_day, show_dayname, show_month, show_monthname, updated_at, created_at, show_tags: [{tag, tag_slug}]`. `show_id` is a 10-digit integer, effectively a permanent identifier — suitable as the Pokédex attendance key. **Future shows are included** (scheduled 2026 tour dates already present) — ingestion must tolerate shows with zero setlist rows. [source: prior live fetch]
- **`songs.json`** — `{ id, name, slug, isoriginal, original_artist, created_at, updated_at }`. No `artist_id`, no album/tuning data (§9). [source: prior live fetch]
- **`albums.json`** — one row per track, **no `song_id`** — join to songs via slug extracted from `song_url` (e.g. `"/song/ah-ah-ah"`) or by name. `releasedate` is a dirty string (observed `"2006-10-24 (1)"` with a disambiguator suffix) — parse defensively, never trust as a clean date. `album_notes` is raw HTML — untrusted, never render or parse. [source: prior live fetch]
- **`jamcharts.json`** — field-name drift versus every other endpoint: `showid` (not `show_id`), `song_slug` (not `slug`). Normalize these at the ingest boundary; do not let the drift leak past `ingest/`. [source: prior live fetch]
- **`latest.json`** — smaller key subset than `setlists` rows (missing `css_class`, `isrecommended`, `tracktime`, `timezone`, `showtime`) — a Phase 5 concern (live polling), noted here for completeness. [source: prior live fetch]
- **`tour_id: 1`** is a sentinel meaning "Not Part of a Tour" — one-off shows. Era/recency logic must special-case this value rather than treating it as one giant tour. [source: prior live fetch]
- **Natural show key**: `(showdate, showorder, artist_id)` — two shows share the date 2013-09-11 in showyear2013.json (`show_id` 1703538770 and 1678642445), so `showorder` disambiguation is real and necessary, not theoretical. [source: showyear2013.json — spot-verified]

## 12. Security note

`shownotes`, `album_notes`, and `footnote(s)` are **untrusted editor-entered content** — `shownotes` on rr1010.json position 13 contains raw HTML anchor tags (`<a href="..." target="_blank" rel="noreferrer">`) and literal `\r\n` sequences embedded in the string. [source: rr1010.json — spot-verified] These fields must be carried verbatim through ingestion and normalization, and **never interpreted as HTML or rendered without escaping** in any future UI phase (React's default JSX escaping is sufficient; never use `dangerouslySetInnerHTML` on these fields).

## 13. Open Unknowns — RESOLVED by the full-corpus census (plan 01-03 Task 3)

These were deferred to the full-corpus census per D-10. `data/census-report.md` and `data/census.json` (generated from all 17 committed `data/raw/setlists-*.json` files, 2010–2026, 10,210 KGLW+side-project rows, zero network requests) now resolve every one of them.

**(a) Does `setnumber: "3"` exist (three-set shows)?**
What we know: `"1"`, `"2"`, `"e"` are all confirmed in the committed samples (§3, §7).
What's unclear: whether any show in the full 2010–present corpus has a third regular set.
Resolution: **No.** The full-corpus census found exactly three `setnumber` values across all 10,210 rows: `"1"` (9,545 rows / 757 shows), `"2"` (286 rows / 22 shows), `"e"` (27 rows / 18 shows). No `"3"` (or any other value) exists anywhere in 2010–2026. The domain type's `setNumber: string` can safely narrow to a locked `"1" | "2" | "e"` union in plan 01-04.

**(b) Full-corpus `transition_id` 4/5/6 distribution and reliability across eras**
What we know: in the two samples, id 4 appears once (rr1010.json), id 5 appears 10 times and id 6 appears 3 times (showyear2013.json, all 149 rows); terminal-row reliability is poor even within 2013 alone (§4).
What's unclear: whether id 4 is common in later eras, or specific to how editors notated the 2022 Red Rocks marathon.
Resolution: Full corpus: id 1 = 6,404 rows, id 2 = 2,467, id 3 = 377, id 4 = 29 (29 distinct shows, first seen 2016-03-04), id 5 = 292 (292 shows), id 6 = 289 (289 shows). **Terminal unreliability is confirmed across every era, not just 2013**: the census's per-year last-row distribution shows id 1 ("normal break") ending shows in every single year from 2010 through 2026 — e.g. 2014 alone has 53 shows ending in id 1 vs. 17 in id 5 and 9 in id 6. The Anti-Pattern-1 rule (never infer structure from `transition_id`) is validated at full-corpus scale, not just in the two planning samples.

**(c) Tease notation string conventions**
What we know: no tease row type or dedicated field exists in the schema; the only tease evidence observed is free-text prose inside `shownotes` (§8, §12).
What's unclear: whether teases follow any consistent string convention across editors/eras that could be pattern-matched, or whether they are pure unstructured prose forever.
Resolution: **No exploitable convention exists.** A full-corpus `/tease/i` scan over `footnote`/`shownotes` returns 6,059 candidate rows, but the overwhelming majority are a single recurring KGLW.net staff disclaimer sentence — "...any additional setlist notations that require audio confirmation (segues, quotes or **teases**) may be incomplete." — not an actual tease call-out. There is no dedicated field, no consistent per-editor phrasing, and no way to mechanically separate genuine tease mentions from this boilerplate without manual review. D-15's decision (carry footnotes/shownotes verbatim, never structurally parse them, never feed them into a v1 signal) is the correct call; a v2 tease-awareness feature would need human-curated examples, not a regex.

**(d) Full `settype` variant list across 15 years (2010–present)**
What we know: `{"Set", "One Set", "Live Session"}` observed across 26 shows in 2013 alone (§10).
What's unclear: whether "Soundcheck", festival-specific labels, or other non-standard-show variants appear in years/eras not covered by the committed samples.
Resolution: **Confirmed closed set — no new variants anywhere in 2010–2026.** Full corpus: `"Set"` (9,562 rows / 696 shows), `"One Set"` (210 rows / 42 shows), `"Live Session"` (86 rows / 19 shows). No "Soundcheck", festival, or other label ever appears. `config.settypeAllowlist = ["Set", "One Set"]` is confirmed final, not provisional — D-16's exclusion of `"Live Session"` (19 shows total, not just the 2 in the 2013 sample) is the only exclusion needed.

**(e) Footnotes rows that fail `JSON.parse`**
What we know: all 23 non-null `footnotes` values observed in showyear2013.json parse cleanly as single-element JSON string arrays (§8).
What's unclear: whether any row across the full corpus has malformed/non-JSON `footnotes` content that would trip a naive `JSON.parse`.
Resolution: **Zero parse failures across the entire 2010–2026 corpus.** The guarded `parseFootnotesGuarded` (Pitfall 5) never had to fall back to its raw-string branch on real data — every non-null `footnotes` value in all 10,210 rows parses cleanly. The guard remains in place as defense-in-depth for future refreshes, but no historical malformed data exists.

---

*Written 2026-07-08, before any file under `packages/core/src/ingest/normalize.ts` or `packages/core/src/cli/*` exists in this repository — satisfies phase success criterion 1 (schema documentation precedes extraction code). Zod schemas encoding this document executably live in `packages/core/src/ingest/api-types.ts`.*
