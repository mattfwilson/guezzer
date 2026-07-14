# Phase 6: Pokédex, History & Stats - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The user's live-show history becomes a browsable collection: an **album-organized Pokédex** (cover-art card grid → per-album song lists with derived seen/unseen state), **retroactive attendance marking** against the show archive, a **post-show recap** with a game-style rarity system, **show history** as complete setlists, and **dex sharing** (friend-file compare view + PNG summary card). Delivers **SHOW-14, STAT-01..04, DEX-02..04, HIST-01, SHAR-01..02**. Also carries a folded **Show-Mode UI-polish pass** (orb label text, InstallBanner frequency, FAB action menu). **Mode:** MVP.

**In scope:**
- Album-grouped Pokédex UI with bundled cover art, per-album caught/total tallies, per-song derived stats (DEX-03/04, STAT-01/03/04).
- Retroactive attendance marking: browse-by-year + search over the bundled corpus with a live-API fallback for very recent shows; full-setlist credit; one-tap unmark (DEX-02).
- Post-show recap auto-shown at End Show: tally + manual/editor split + rarity tiers + new catches + final setlist (SHOW-14, STAT-02).
- Show history inside the Dex tab (HIST-01).
- Friend-file compare view (never merges) + PNG summary card via Web Share API (SHAR-01/02).
- Folded UI-polish todos: orb song-name text fit, InstallBanner once-per-version, ActionBar → collapsed FAB menu.

**Not in scope (later phases / out of scope):**
- Constellation dex overlay and everything Explore Mode (Phase 7 — DEX-05, EXPL-*).
- Real-time shared state between friends (v2 — SOCL-V2-01); compare view is file-based only.
- Destructive "clear all data" in Settings (still deferred).
- Any change to prediction scoring or the matrix artifact.

</domain>

<decisions>
## Implementation Decisions

### Pokédex Layout & Organization (DEX-03/04, STAT-03/04)
- **D-01:** The Dex tab is a **card grid aggregated by ALBUM**, each card showing the **album cover** and a **caught/total tally**. Tapping an album opens its **song list** with seen/unseen highlighting (derived checkmarks). NOT a flat 264-song grid or list.
- **D-02:** Default sort: **alphabetical by album name**.
- **D-03:** **Album covers are fetched once at build time and bundled** as small thumbnails (offline-first; no runtime fetching). Source is Claude's discretion (kglw.net album pages, MusicBrainz/Cover Art Archive, or similar) — the owner explicitly delegated finding the best discography/cover source.
- **D-04:** **Song→album mapping: canonical studio album** (islive=0, earliest release date from `data/raw/albums.json`, filtered to artist_id=1). Live-album-only/unreleased songs → a **Miscellaneous** bucket; covers of other artists → a **Covers** bucket. Every catchable song appears somewhere; the album grid should represent the **full studio discography**.
- **D-05:** Seen/unseen state in the album view is **display-only, derived from attendance** — never a manual toggle (locked DEX-03). The only ways to catch a song: live-track a show that played it, or retroactively mark a show that did.
- **D-06:** Never-seen songs render **dimmed/silhouetted in the same view** (consistent with the Phase 7 constellation dimmed-silhouette plan).
- **D-07:** **Stats placement:** overall completion %, rarest catch, and show count in a **header above the album grid**; per-song stats (sighting count, personal gap "N of your shows since you last saw it", last-seen, debut badge) in the **album song-list rows**.
- **D-08:** **Debut-candidate framing (STAT-04) badges everywhere** — dex entries AND the Show Mode orb why-detail — anywhere a stat would otherwise imply fake precision for a song with zero live history.

### Retroactive Attendance Marking (DEX-02)
- **D-09:** Archive search runs **corpus-first (bundled 738 shows, fully offline)** with an **online kglw.net search fallback for very recent shows** not yet in the bundled corpus. Live lookups must follow the established API etiquette (polite, filtered, validated).
- **D-10:** Finding shows: **browse by year (newest first) + text search** over date/venue/city.
- **D-11:** Marking a show **auto-credits its full corpus setlist as sightings** — one tap per show, pure derivation. No per-song confirm step.
- **D-12:** **One-tap unmark** (confirm acceptable) with all derived counts recomputing from remaining attendance. Derivation makes unmark free.

### Post-Show Recap & History (SHOW-14, STAT-02, HIST-01)
- **D-13:** The recap **auto-appears after End Show** (the payoff moment) and remains reachable from show history.
- **D-14:** Recap contents: **hit/miss tally + %**, **manual-vs-editor decomposition** (consuming Phase 5's `source` tags — this is what they were built for), **rarity score + rarest catch of the night**, **new catches ("+N new")**, and the final setlist with set structure.
- **D-15:** **Rarity is a game-style tier system — Common / Uncommon / Rare / Legendary — derived from actual play data** (base play rate / gap). Thresholds must be **data-driven** (e.g., quantiles over the corpus), constants in the single config file. The owner invited "any other interesting metrics you can think of" — Claude may enrich the recap/tiers with additional honest, data-backed metrics at its discretion. The underlying honest numbers (gap, play count, last played — STAT-01) stay available in song detail.
- **D-16:** **Show history lives in the Dex tab** (a Shows section/segment alongside Albums) — attended shows newest-first, tap → full setlist / recap. No new bottom-bar tab.

### Dex Sharing (SHAR-01/02)
- **D-17:** **A friend's imported file opens a compare view and NEVER merges** into local data. Your own backup restore keeps the Phase 5 merge path. The export envelope gains an **owner name/id** so the app can distinguish whose file it is. A friend's file must never silently inflate your attendance.
- **D-18:** Summary card is a **canvas-rendered PNG image**: completion %, rarest catch, show count, **rarity-tier breakdown** (e.g., 3 Legendary / 12 Rare), **total songs caught (87/264)**, and **latest/best show**.
- **D-19:** Sharing via **Web Share API (`navigator.share`) with image-download fallback** where unsupported.

### Folded UI-Polish Pass (Show Mode / shell)
- **D-20:** **FAB menu — everything collapses.** All five Show-Mode actions (Search, ???, Set break, Encore, Undo) move into a single collapsed-by-default FAB anchored bottom-right. The owner explicitly accepts the extra tap on the ??? and Undo hot paths (trade-off was flagged and decided 2026-07-14). Must respect the ≥44px floor, `env(safe-area-inset-bottom)` + BottomTabBar inset accounting, gesture-suppression scope, and re-check the non-scrolling AppShell seam once the ActionBar rows are removed (details in the todo file).
- **D-21:** **Orb song-name text fix**: song names must be readable in full — dynamic fit/wrap per the todo's candidate approaches; keep SHOW-02 tap-target floors; constants in config.
- **D-22:** **InstallBanner shows at most once per app version** — persist a seen/dismissed flag keyed on a stable build version (meta-table idiom like `PERSIST_WARNING_SHOWN`).

### Claude's Discretion
- Album-cover source and build-time pipeline (D-03) — including image sizing/format (small thumbs, bundle-friendly) and attribution needs.
- Where the app gets the show→songIds archive index: shipping a compact build-time derivation of the corpus vs importing `corpus.json` — pick the smallest artifact that serves DEX-02/DEX-03 offline.
- Exact rarity-tier thresholds and any bonus recap metrics (D-15) — data-driven, config-file constants, honest framing.
- Dex derivation module design in `packages/core` (pure, fixture-tested per the project testing constraint — EVAL-05 explicitly covers dex derivation).
- Dexie migration shape (additive `version(4)` if needed — e.g., retro-marked attendance rows, export-owner metadata) following the additive-only rule.
- Compare-view layout and diff detail; recap visual design; year-browse UX specifics (subject to `/gsd-ui-phase` — ROADMAP flags "UI hint: yes").
- Live-API recent-show search specifics (endpoint choice, validation) — must reuse core ingestion schemas + `assertFilterApplied`.

### Folded Todos
- **Fix truncated/oversized song-name text inside prediction orbs** (`.planning/todos/pending/2026-07-11-orb-song-name-text-truncated-and-oversized.md`) → D-21. Owner-reported at the Phase 4 device gate; explicitly deferred to Phase 6 UI polish during Phase 5 review.
- **InstallBanner should show once per app version** (`.planning/todos/pending/2026-07-14-install-banner-reappears-every-reload.md`) → D-22. Owner-reported during Phase 5 UAT.
- **Consolidate Show-Mode actions into a collapsed FAB menu** (`.planning/todos/pending/2026-07-14-collapse-show-actions-into-fab-menu.md`) → D-20. Owner idea; its flagged ???/Undo trade-off was settled: full collapse.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 6 section: goal, 5 success criteria, requirement IDs (SHOW-14, STAT-01..04, DEX-02..04, HIST-01, SHAR-01..02), `Mode: mvp`, `UI hint: yes`, `Depends on: Phase 5`.
- `.planning/REQUIREMENTS.md` — authoritative requirement text (incl. DEX-05/EXPL-* for Phase-7 boundary awareness — out of scope here).
- `.planning/PROJECT.md` — derived-never-hand-tallied key decision, API-etiquette constraint, iOS eviction context, no-backend constraint.

### Data sources for albums / archive / stats
- `data/raw/albums.json` — track-level album table (`album_title`, `song_name`, `position`, `islive`, `releasedate`, `artist_id`) — filter to `artist_id === 1`; the D-04 mapping source.
- `data/raw/songs.json` — song id/name/`isoriginal`/`original_artist` (Covers-bucket detection).
- `data/normalized/corpus.json` — 738 shows with full setlists/dates/venues; the retro-marking archive and sighting-derivation source. NOT currently shipped to the app — a compact derived artifact is Claude's discretion.
- `docs/SCHEMA.md` — kglw.net API shapes (`setnumber`, `transition_id`, artist_id semantics) for the recent-show live search.
- `packages/core/src/cli/fetch-corpus.ts` + `packages/core/src/ingest/api-types.ts` + `packages/core/src/ingest/validate.ts` — fetch idiom, zod row schemas, `assertFilterApplied` guard to reuse for any live archive search and the cover-fetch build script's etiquette.

### App foundation this phase extends
- `packages/app/src/db/db.ts` — Dexie version(3) schema: `attendedShows`, `trackedShows` (provisional attendance + `show_id` binding), `trackedEntries` (hit/miss + `source` tags), `DbSnapshot` import/export helpers. Extend additively only.
- `packages/core/src/data-safety/export-schema.ts` / `merge.ts` / `serialize.ts` — Phase 5 export envelope + merge semantics; D-17's owner-id field and compare-path extend these.
- `packages/app/src/settings/SettingsView.tsx` / `exportDownload.ts` / `importPicker.ts` — existing export/import surface the friend-compare import extends.
- `packages/app/src/routing/useHashRoute.ts` (`ROUTES` already includes `"dex"`) + `packages/app/src/components/BottomTabBar.tsx` + `PlaceholderView.tsx` — the Dex tab placeholder this phase fills.
- `packages/app/src/show/EndShowDialog.tsx` — End Show flow the recap hooks after; also the `PERSIST_WARNING_SHOWN` meta-flag idiom D-22 copies.
- `packages/app/src/show/ActionBar.tsx` / `ShowView.tsx` / `OrbitStage.tsx` / `PredictionOrb.tsx` — the FAB consolidation (D-20) and orb-text fix (D-21) touch points.
- `packages/app/src/components/InstallBanner.tsx` + `packages/app/src/pwa/install/platform.ts` — D-22 touch points.
- `packages/app/src/config.ts` + `packages/core/src/config.ts` — single-config-file rule for tier thresholds, FAB/orb constants.

### Folded todo files (full problem statements + pointers)
- `.planning/todos/pending/2026-07-11-orb-song-name-text-truncated-and-oversized.md`
- `.planning/todos/pending/2026-07-14-install-banner-reappears-every-reload.md`
- `.planning/todos/pending/2026-07-14-collapse-show-actions-into-fab-menu.md`

### Prior-phase decisions
- `.planning/phases/05-live-sync-data-safety/05-CONTEXT.md` — D-03 `source` tags (recap decomposition), D-07 show binding, D-09..D-12 export/merge semantics the friend-compare path must not break.
- `.planning/phases/04-show-mode/04-CONTEXT.md` — D-02 provisional attendance, D-06/D-07/D-08 hit/miss semantics (recap decomposition note), D-13..D-15 ActionBar decisions the FAB supersedes.
- `.planning/phases/03-app-shell-pwa-foundation/03-UI-SPEC.md` — inherited design tokens (spacing, 44px floor, dark theme, lucide-react); extend, don't re-derive.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Dexie DB (`db.ts`)** — `attendedShows` + `trackedShows`/`trackedEntries` with `show_id` binding and `source` tags are exactly the attendance substrate dex derivation consumes; `DbSnapshot`/`importSnapshot` exist for the backup path.
- **Core `data-safety`** (export schema, merge, serialize) — friend compare reuses the same zod-validated envelope; only the post-validation routing (compare vs merge) is new.
- **`searchCatalog` (fuse.js in core)** — the archive year-browse text search can mirror this wrapped-pure-function pattern over show dates/venues.
- **`useLiveQuery` reactivity** — dex counts/tallies recompute automatically when attendance rows change (mark/unmark), no hand-synced state.
- **Vitest `projects`** (core=node, app=jsdom) — dex derivation is a pure-core fixture-tested module (EVAL-05 names dex derivation explicitly).

### Established Patterns
- **Strict core/UI separation** — dex derivation (sighting counts, completion %, rarest catch, gaps, tiers) is pure core code; the app renders it.
- **Additive-only Dexie migrations** — any new tables/fields (retro attendance, owner id) via `version(4)`, never rewriting priors.
- **Single config file** — tier thresholds, card constants, FAB/orb tunables.
- **Build-time static bundling** — album covers and the archive index follow the corpus/matrix pattern: fetched/derived once at build, committed, shipped static.
- **Polite API usage** — cover fetching and recent-show search reuse the paced-fetch/User-Agent/validation idioms.

### Integration Points
- **`#/dex` route** — currently `PlaceholderView`; the album grid + shows section mount here.
- **End Show flow (`EndShowDialog` → `endShow`)** — the recap hooks in immediately after finalize; auto-download backup already happens there.
- **Settings import path** — forks on owner-id: mine → Phase 5 merge; friend's → compare view.
- **`ShowView`/`ActionBar` seam** — FAB replaces the in-flow ActionBar rows; orbit stage grows; re-check the non-scrolling AppShell seam and gesture-suppression scope.
- **Dexie `version(3)` → `version(4)`** — the additive seam left open by Phase 5 for retro-marked attendance and export-owner metadata.

</code_context>

<specifics>
## Specific Ideas

- **"Album shelf" Pokédex:** the owner's mental model is a discography shelf — album covers as the collection's face, caught/total tallies per album, drill into an album to see checked-off songs. The full studio discography should be represented, covers sourced wherever best ("i'll let you figure out the best place to find/pull that").
- **Game-style rarity, honest data:** Common/Uncommon/Rare/Legendary tiers "based on the data of how often they are played (and any other interesting metrics you can think of)" — game feel on top, real corpus statistics underneath, never fake precision (STAT-04 badge everywhere).
- **The recap is the payoff moment:** auto-shown at End Show with the tally, your-calls-vs-editor split, rarity, and "+N new catches" — the night's scorecard while you're still in the venue.
- **Friend files are read-only trophies:** compare, never merge — "a friend's file can never silently inflate your attendance."
- **FAB: owner chose max orbit space** — all five actions collapse, extra tap on ???/Undo accepted deliberately.

</specifics>

<deferred>
## Deferred Ideas

- **Constellation dex overlay** (dimmed silhouettes / badges on the graph) — Phase 7 (DEX-05); D-06's dimmed-in-same-view choice keeps the visual language consistent for it.
- **Real-time friend sync / shared leaderboards** — v2 (SOCL-V2-01); the compare view is the v1 answer.
- **Destructive "clear all data" in Settings** — still deferred (carried from Phase 5).
- **Suppress the update toast during an active tracked show** — carried from Phases 3–5 deferred notes; still belt-and-suspenders, still unclaimed.

</deferred>

---

*Phase: 6-Pokédex, History & Stats*
*Context gathered: 2026-07-14*
