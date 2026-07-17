---
phase: quick-260717-gvm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/app/src/dex/song-cover.ts
  - packages/app/test/songCover.test.ts
  - packages/app/src/config.ts
  - packages/app/src/show/ShowBackground.tsx
  - packages/app/src/styles.css
  - packages/app/src/show/ShowView.tsx
autonomous: true
requirements: [QUICK-260717-gvm]

must_haves:
  truths:
    - "Selecting a next song (tap an orb OR pick via search) crossfades the blurred page background to that song's album cover."
    - "Selecting a song with no committed album art keeps the currently-shown background (never reverts to a random cover, never flashes empty)."
    - "Before any song is selected (pre-opener) the background is the existing random ambient cover."
    - "Under prefers-reduced-motion the background swaps instantly with no fade."
    - "Works fully offline — only bundled covers are used; a dex-albums load failure degrades to no-art (background unchanged)."
  artifacts:
    - path: "packages/app/src/dex/song-cover.ts"
      provides: "Pure songId->cover-slug map builder + app-bound coverUrlForSong(songId) resolver"
      exports: ["buildSongCoverSlugMap", "coverUrlForSong"]
    - path: "packages/app/test/songCover.test.ts"
      provides: "Unit test for buildSongCoverSlugMap over a small fixture dex-albums artifact"
    - path: "packages/app/src/show/ShowBackground.tsx"
      provides: "Two-layer crossfading blurred cover background"
  key_links:
    - from: "packages/app/src/show/ShowView.tsx"
      to: "coverUrlForSong"
      via: "derive target cover from session.currentSongId"
      pattern: "coverUrlForSong\\(session\\.currentSongId"
    - from: "packages/app/src/show/ShowBackground.tsx"
      to: "config.show.background.CROSSFADE_MS"
      via: "crossfade duration"
      pattern: "CROSSFADE_MS"
---

<objective>
On the Show/tracking page, make the blurred ambient background reflect the album cover of the currently-selected next song. When the user selects a song — by tapping a prediction orb OR choosing one via search — the background crossfades to that song's album cover. Both selection paths already funnel through `session.currentSongId`, so driving the background off that one value covers both with no handler edits.

Purpose: Give the Show page a live sense of place — the backdrop becomes the album the centre song belongs to — while staying decorative, legible, offline-safe, and honoring reduced-motion.
Output: A pure song->cover resolver (with a unit test), a crossfading `ShowBackground`, a single config-driven crossfade duration, and `ShowView` wiring off `session.currentSongId`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# Facts pre-traced by the orchestrator — do NOT re-derive:
# - packages/app/src/show/ShowView.tsx:82-102 — random `bgCoverUrl` state + `withBackground()` wrapper that renders <ShowBackground coverUrl={bgCoverUrl} />.
# - packages/app/src/show/ShowBackground.tsx — single blurred+dimmed <img> layer; null coverUrl -> render nothing. Blur/dim from config.show.background.
# - session.currentSongId (useShowSession) is the last confirmed real song; updates on BOTH tap-orb and search-select (both call logSong). number | null.
# - packages/app/src/dex/covers.ts — coverUrlFor(slug): string|null; coverUrlList(): string[].
# - packages/app/src/dex/dex-albums-loader.ts — loadDexAlbums(): { ok:true, albums } | { ok:false, error }. Memoized. schemaVersion guard.
# - Album cover slug = albumUrl last path segment (slugForAlbumUrl in packages/app/src/dex/AlbumGrid.tsx:37).
# - DexAlbumsArtifact shape (packages/core/src/dex/archive-types.ts):
#     { schemaVersion: 1, albums: DexAlbum[], buckets: { covers: AlbumTrack[], miscellaneous: AlbumTrack[] } }
#     DexAlbum   = { albumUrl: string, title: string, releaseDate: string, tracks: AlbumTrack[] }
#     AlbumTrack = { songId: number | null, slug: string, title: string, inMatrix?: boolean }
#   NOTE: bucket songs (covers/miscellaneous) are NOT inside any album.tracks -> they have no card album -> no art.
# - config.show.background currently = { BLUR_PX: 5, DIM_OPACITY: 0.75 } (packages/app/src/config.ts ~line 111).
# - Reduced-motion convention in this repo is CSS-only: default state is the reduced-motion state, and
#   `@media (prefers-reduced-motion: no-preference)` turns animation ON (see packages/app/src/styles.css orb-breathe/orb-float/orb-ripple).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure songId -> album-cover resolver + unit test</name>
  <files>packages/app/src/dex/song-cover.ts, packages/app/test/songCover.test.ts</files>
  <behavior>
    buildSongCoverSlugMap(artifact) over a small fixture DexAlbumsArtifact:
    - Test 1: For an album with albumUrl "/albums/nonagon-infinity" and a track { songId: 42 }, the map has 42 -> "nonagon-infinity" (slug = albumUrl last path segment).
    - Test 2: Tracks whose songId is null are skipped (no null key in the map).
    - Test 3: Bucket songs (buckets.covers / buckets.miscellaneous) are NOT mapped — only songs inside albums[].tracks get an entry (buckets carry no card album / no art).
    - Test 4: A songId absent from every album is absent from the map (lookup would yield undefined -> caller treats as no-art).
  </behavior>
  <action>
    Create `packages/app/src/dex/song-cover.ts`, an app-layer module (imports allowed from ../dex/covers.ts and ../dex/dex-albums-loader.ts — no core/UI violation; covers/dex-albums are app-layer).

    Export a PURE `buildSongCoverSlugMap(artifact: DexAlbumsArtifact): Map<number, string>` that iterates `artifact.albums`, computes each album's cover slug as the last path segment of `album.albumUrl` (mirror slugForAlbumUrl in AlbumGrid.tsx — split on "/" and take the last segment; do not import from AlbumGrid, keep a tiny local slug helper), and for every track in `album.tracks` with a non-null `songId`, sets `songId -> slug`. Do NOT map bucket songs. Import the `DexAlbumsArtifact` type from `@guezzer/core` (same import path dex-albums-loader.ts uses).

    Export `coverUrlForSong(songId: number): string | null` — the app-bound resolver: call `loadDexAlbums()`; if `!ok`, return null (dex-albums load failure -> no art). Build the songId->slug map ONCE via `buildSongCoverSlugMap(result.albums)` and memoize it in a module-level cache keyed off the loaded artifact (loadDexAlbums is already memoized, so a simple module-level `let cachedMap` is sufficient — build lazily on first call). Look up the slug for `songId`; if none, return null. Otherwise return `coverUrlFor(slug)` (which itself returns null for an album with no committed webp). Never throw.

    Add `packages/app/test/songCover.test.ts` targeting `buildSongCoverSlugMap` with an inline fixture DexAlbumsArtifact (schemaVersion:1, a couple of albums with tracks, plus non-empty buckets) covering the four behaviors above. Follow the existing test style in packages/app/test (vitest describe/it/expect; no mocks — the fixture IS the input). Do not test coverUrlForSong's glob-bound branch here (import.meta.glob resolves real bundled assets); the pure map builder is the derivation with known expected outputs per CLAUDE.md's testing convention.
  </action>
  <verify>
    <automated>cd packages/app && npx vitest run test/songCover.test.ts</automated>
  </verify>
  <done>buildSongCoverSlugMap maps album-track songIds to their album cover slug, skips null songIds and bucket songs; coverUrlForSong returns a bundled cover URL for songs with committed art and null otherwise (including dex-albums ok:false); the unit test passes.</done>
</task>

<task type="auto">
  <name>Task 2: Crossfade ShowBackground between covers (config-driven, reduced-motion aware)</name>
  <files>packages/app/src/config.ts, packages/app/src/show/ShowBackground.tsx, packages/app/src/styles.css</files>
  <action>
    Config (single-config rule — no magic numbers in the component): in `packages/app/src/config.ts`, add `CROSSFADE_MS: 600` to `config.show.background` alongside BLUR_PX/DIM_OPACITY, with a short comment ("Crossfade duration in ms when the background swaps to a newly-selected song's album cover"). Pick 600ms as a calm ambient fade.

    styles.css (mirror the existing reduced-motion idiom — default = reduced state, `@media (prefers-reduced-motion: no-preference)` enables motion): add a `@keyframes show-bg-fade-in` from `opacity: 0` to `opacity: 1`, and a `.show-bg-fade-layer` class whose DEFAULT is `opacity: 1` (so under reduced motion the incoming cover appears instantly, no fade). Inside `@media (prefers-reduced-motion: no-preference)`, set `.show-bg-fade-layer { animation: show-bg-fade-in var(--show-bg-crossfade-ms, 600ms) ease forwards; }`. This matches the orb-breathe/orb-float/orb-ripple pattern already in this file.

    ShowBackground.tsx — convert the single static layer into a two-layer crossfade while preserving the existing contract (aria-hidden, pointer-events-none, absolute inset-0, blur+dim from config, `coverUrl == null` -> render nothing). Keep TWO React state values: `base` (the settled/underneath cover URL) and `incoming` (the cover currently fading in, or null). On each render, when the `coverUrl` prop differs from both `base` and `incoming`, set `incoming = coverUrl` (drive this in a useEffect on `coverUrl`). Render:
      - a base blurred cover layer for `base` (unchanged blur/scale/dim styling), and
      - when `incoming != null` and differs from `base`, an overlaid `.show-bg-fade-layer` blurred cover layer for `incoming`, keyed by the incoming URL, with inline style `--show-bg-crossfade-ms` set to `${config.show.background.CROSSFADE_MS}ms`.
    Promote `incoming` -> `base` (and clear `incoming`) when the fade completes: use `onAnimationEnd` on the incoming layer AND a `setTimeout(CROSSFADE_MS)` fallback inside the useEffect (cleared on cleanup) so promotion also happens under reduced motion where no CSS animation fires. Keep the dark scrim (`rgba(12,12,16, DIM_OPACITY)`) as the topmost layer above both covers so legibility is unchanged during the fade. If `coverUrl` is null AND there is no `base` yet, render nothing (unchanged first-load contract). Do NOT put fenced code in this plan — implement per this contract.
  </action>
  <verify>
    <automated>cd packages/app && npx tsc --noEmit && npx vitest run test/configMirror.test.ts</automated>
  </verify>
  <done>config.show.background has CROSSFADE_MS; ShowBackground renders a base + fading-in incoming cover layer that crossfades on coverUrl change, swaps instantly under prefers-reduced-motion, keeps aria-hidden/pointer-events-none/blur/dim, and still renders nothing before any cover exists; typecheck passes.</done>
</task>

<task type="auto">
  <name>Task 3: Drive the Show background off the selected song</name>
  <files>packages/app/src/show/ShowView.tsx</files>
  <action>
    In `packages/app/src/show/ShowView.tsx`, import `coverUrlForSong` from `../dex/song-cover.ts` (keep the existing `coverUrlList` import for the random ambient fallback).

    Derive the target cover, covering BOTH selection paths via the single `session.currentSongId` value (no changes to handleTapOrb / handleSearchSelect):
      - `const selectedCover = session.currentSongId != null ? coverUrlForSong(session.currentSongId) : null;`
      - Retain the last REAL album cover shown so an art-less selection does not revert to random or flash empty: keep `const [lastSelectedCover, setLastSelectedCover] = useState<string | null>(null);` and a `useEffect` that calls `setLastSelectedCover(selectedCover)` only when `selectedCover != null` (deps: [selectedCover]).
      - Keep the existing random `bgCoverUrl` state as the pre-opener / no-covers-bundled default.
      - `const targetCover = selectedCover ?? lastSelectedCover ?? bgCoverUrl;`
    Pass `targetCover` (not `bgCoverUrl`) to `<ShowBackground coverUrl={...} />` inside `withBackground`. Net semantics: pre-opener shows the random ambient cover; selecting a song WITH art crossfades to that album; selecting a song WITHOUT art keeps whatever cover was showing.

    Do not introduce a routing/state library or touch core. Purely app-layer wiring.
  </action>
  <verify>
    <automated>cd packages/app && npx tsc --noEmit && npx vitest run</automated>
  </verify>
  <done>The Show page background is the random ambient cover pre-opener, crossfades to the selected song's album cover on orb-tap or search-select, and holds the current cover when the selected song has no art. Typecheck and the app test suite pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Feature is decorative UI over already-bundled, build-time-validated assets. No network, no user text, no new package installs. Song IDs are internal integers already trusted by the app. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-gvm-01 | Denial of Service | ShowBackground crossfade re-render loop | mitigate | Promote incoming->base via useEffect + timeout with cleanup; layers keyed by URL so identical coverUrl re-renders are no-ops (guard: only set incoming when it differs from base and current incoming). |
| T-gvm-02 | Information Disclosure | dex-albums load failure / missing art | accept | coverUrlForSong returns null on ok:false or no committed webp; background simply retains the current cover. No PII, no data path. |
</threat_model>

<verification>
- `cd packages/app && npx tsc --noEmit` passes (no core/UI purity or type regressions).
- `cd packages/app && npx vitest run` — full app suite green, including the new test/songCover.test.ts and existing configMirror.test.ts.
- Manual sanity (optional, not required to pass): on the Show page, tap a prediction orb -> background crossfades to that song's album cover; open search and pick a song with art -> same crossfade; pick an art-less song -> background unchanged.
</verification>

<success_criteria>
- Background reflects the currently-selected next song's album cover, crossfading on both orb-tap and search-select.
- Art-less selections retain the current cover; pre-opener shows the random ambient cover.
- Reduced-motion swaps instantly; feature is offline-safe, aria-hidden, non-interactive.
- Crossfade duration lives only in config.show.background (no scattered magic numbers); all logic app-layer (no core touch).
- Pure song->cover derivation is unit-tested with known expected outputs.
</success_criteria>

<output>
Create `.planning/quick/260717-gvm-show-page-crossfade-blurred-background-t/260717-gvm-SUMMARY.md` when done.
</output>
