# Phase 1: Corpus Ingestion & Schema Foundation - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Build-time data pipeline, entirely in `core/` + Node CLI — no UI. Delivers: (1) empirical schema documentation from real endpoint samples, written before extraction code; (2) a one-command corpus refresh script producing a versioned static JSON artifact; (3) a KGLW-only normalizer with `artist_id === 1` filtering and filter-response validation everywhere; (4) the tuning-family tagging file with album-derived defaults; (5) era-spanning fixture tests (2012/2017/2022/2025-style shows) proving set structure, segues, and sandwiches parse correctly. Also scaffolds the pnpm two-package workspace (`core` + `app`) since this is the first code phase.

Transition-matrix construction and set-boundary edge exclusion (DATA-05) belong to Phase 2 — this phase stops at clean normalized domain data.

</domain>

<decisions>
## Implementation Decisions

### Tuning-family tagging file (DATA-04)
- **D-01:** Format is JSON — one object per song with name, album-derived default family, and a confirm/review field. Zod-validated on load like everything else at the ingestion boundary.
- **D-02:** Every song gets a best-guess default plus a `needsReview` flag when the album mapping is ambiguous (multi-album, live-only, mixed album). The owner hand-checks only the flagged subset, not all ~250 songs.
- **D-03:** Vocabulary is exactly four values: `standard`, `cs-standard`, `microtonal`, `other`. `other` is an honest bucket for songs that don't fit; the Phase 2 backoff treats it as its own family. Not extensible.
- **D-04:** Regeneration is an append-only merge: existing entries are preserved verbatim, only newly-seen songs are appended (with defaults + review flag), and a summary prints what was added. Hand-edits are never overwritten.

### Refresh script & corpus storage (DATA-02)
- **D-05:** Fetching is incremental by year: raw corpus stored per-year; refresh refetches only the current year plus any year explicitly named. The frozen 2010–2024 history is not re-pulled on routine refreshes.
- **D-06:** Both raw per-year API responses AND the normalized artifact are committed to the repo. Raw is the offline source of truth (normalizer can be rewritten and re-run with zero API traffic); normalized is what Phase 2 and the app consume.
- **D-07:** Fetch pacing: strictly sequential, ~2-second courtesy delay between requests, descriptive User-Agent (project name + owner contact), no automatic retries on error.
- **D-08:** The normalized artifact carries an embedded header: `schemaVersion` (bumped on breaking shape changes, checked by consumers), `generatedAt`, latest-show-date, and show/song counts. The UI can later display "data through YYYY-MM-DD".

### Schema documentation & unknowns (DATA-01)
- **D-09:** Schema knowledge lives as a pair: a standalone `SCHEMA.md` (field meanings, `transition_id` vocabulary, gotchas, real response excerpts — the "why") plus zod schemas in `core/ingest` encoding it executably (the "what"). Zod validates every ingest run, so doc/code drift is caught mechanically.
- **D-10:** Open unknowns (multi-set `setnumber` values, `transition_id: 4`, tease notation location, `settype` variants) are resolved via a census report: the full-corpus ingest emits every distinct value of enum-ish fields with counts and example show IDs. SCHEMA.md unknowns get resolved with evidence BEFORE the normalizer is finalized.
- **D-11:** After the census locks the vocabulary, zod uses strict enums that hard-fail on future refreshes: a novel value fails with a clear message naming the field, value, and an example show. Schema drift on the volunteer API must fail loudly, never silently corrupt.
- **D-12:** DATA-03 filter validation is a post-fetch assertion: after every filtered fetch, every returned row is asserted to match the requested filter (all `artist_id === 1`, all `showyear === requested`, etc.). Mismatch = hard fail naming the endpoint and filter.

### Covers & special-song policy (normalizer semantics)
- **D-13:** Covers are included as normal catalog songs with an `isCover` flag. Transitions through them stay intact (excluding them would fabricate false adjacencies). Phase 2 decides weighting; the dex can badge them.
- **D-14:** Sandwiches/reprises are plain positional occurrences: each appearance is its own setlist entry in position order; transitions read off adjacent positions with no inference. No reprise detection/linking — the API's `isreprise` is unreliable. Repeats are detectable downstream as duplicate song IDs within a show (what MODL-10 needs).
- **D-15:** Teases/footnotes are carried through verbatim on setlist entries but never emit transitions. v2 tease-awareness (MODL-V2-03) gets its raw material without a re-ingest.
- **D-16:** Corpus scope is proper live shows only: standard live concerts included; soundchecks, radio sessions, and other non-show `settype` variants excluded via an explicit allowlist informed by the census. A radio session's song choices would pollute rotation and transition signals.

### Claude's Discretion
- Exact file locations within the workspace (where `SCHEMA.md`, `data/` raw files, the tagging file, and the normalized artifact live), workspace scaffolding details, census report output format, and fixture-test structure — all Claude's call, consistent with the locked stack (pnpm workspace, Node ≥24.12 native TS, `erasableSyntaxOnly`, zod at the boundary).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API schema & architecture (load-bearing for this phase)
- `.planning/research/ARCHITECTURE.md` — Part 1 is the authoritative empirically-verified kglw.net API reference (11 live fetches): envelope shape, multi-artist gotcha, global `position` across sets, `setnumber === "e"` encores, `transition_id` semantics (2/3 = hard segue, 5/6 = terminal; never string-parse), silent filter-ignore, sandwich behavior. Extraction code follows this, not assumptions.
- `.planning/research/PITFALLS.md` — P6 (matrix poisoning — schema doc gates the extractor) and P11 (volunteer-API etiquette) are the two pitfalls this phase exists to prevent.

### Stack & conventions
- `.planning/research/STACK.md` — verified versions and workspace layout (core purity enforced by tsconfig/package.json, Node-native TS execution for CLI scripts).
- `.planning/research/SUMMARY.md` — resolved stack conflict (bundle artifact as JSON-module import), phase-1 delivery list, open research gaps to instrument during full ingest.
- `CLAUDE.md` — project constraints: core/UI separation, single config file for constants, API etiquette, TS 6.0.3 (not 7).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repo (only `CLAUDE.md` and `.planning/` exist). This phase creates the workspace.

### Established Patterns
- All patterns come from research docs, not code: anti-corruption layer in `core/ingest` (the only module that knows raw API field names), zod validation at the ingestion boundary, pure functions runnable from Node CLI.

### Integration Points
- The normalized corpus artifact is Phase 2's sole input (matrix builder). Its header schema (D-08) is the first frozen contract in the system.
- The tuning-family tagging file feeds Phase 2's backoff tier (MODL-08/09) — the `other` family value must be representable there.

</code_context>

<specifics>
## Specific Ideas

- The census report is a first-class deliverable, not a debug log: the owner reads it to resolve SCHEMA.md unknowns with evidence (counts + example show IDs) before the normalizer is finalized. 2022 Red Rocks marathon shows are the known test case for multi-set representation.
- Refresh-script failure UX matters: hard failures must name the field/value/endpoint/show so a pre-tour refresh problem is diagnosable in minutes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Corpus Ingestion & Schema Foundation*
*Context gathered: 2026-07-08*
