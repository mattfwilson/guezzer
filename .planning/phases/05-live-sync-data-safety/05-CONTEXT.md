# Phase 5: Live Sync & Data Safety - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

During an active show, the app politely polls kglw.net's `latest` endpoint as a **second set of eyes** — surfacing editor-logged songs as **suggestions that never overwrite manual tracking** — and provides a **prominent JSON export/import** so a lost phone never means a lost dex. Delivers the show-#1 hard bar: **SYNC-01, SYNC-02, SYNC-03, PWA-04**. **Mode:** MVP (vertical slices).

**In scope:**
- Live polling of the `latest` endpoint only (≤ 1/60s, active-show only), reusing the core ingestion/validation layer (SYNC-01).
- Editor songs surfaced as dismissible, deduped suggestions — adopt or dismiss, never auto-merged (SYNC-02).
- Auto-binding the tracked show to the real kglw.net `show_id` + venue by date-matching `latest` (finishing the Phase-4-deferred D-05 binding).
- Full offline operation with silent poll resume and calm offline reassurance (SYNC-03).
- Versioned JSON export/import with merge semantics, zod validation, and a prominent Settings surface (PWA-04).
- Additive Dexie `version(3)` migration: entry provenance (`source`) + tracked-show `show_id`/venue binding fields.

**Not in scope (later phases):**
- Friend-specific import conflict UI, dex-diff, shareable summary card (Phase 6 — SHAR-01/SHAR-02).
- Retroactive attendance marking against the full archive (Phase 6 — DEX-02).
- Post-show recap view + rarity score that *consumes* the source-tagged entries (Phase 6 — SHOW-14/STAT-02).
- Destructive "clear all data" / reset (deferred; footgun on a hard-bar phase).

</domain>

<decisions>
## Implementation Decisions

### Live Sync — Suggestions (SYNC-02)
- **D-01:** Editor songs from `latest` surface as a **dismissible strip below the orbit** — tap to adopt (logs it as yours), swipe/X to dismiss. NOT ghost orbs inside the orbit (mis-tap risk in a dark venue, contra D-13), NOT a hidden badge-only affordance.
- **D-02:** The strip shows only the **next 1–2 un-logged** editor songs, **deduped by song ID** against the current trail. The editor **never contradicts** songs you've already logged — purest reading of SYNC-02's manual-primary "second set of eyes." No "editor disagrees with your entry" flagging.
- **D-03:** Adopting a suggestion runs the **same hit/miss fan classification** as any log (in the shown fan → hit; otherwise → miss, per Phase 4 D-06/D-08) **and** stamps a **`source: 'manual' | 'editor'`** provenance field on the entry. Requires an additive Dexie **version(3)** migration adding `source` to `trackedEntries`. Keeps the running tally honest and gives the Phase 6 recap the manual-vs-editor decomposition the "two-source trail" was front-loaded for.
- **D-04:** Editor sync also offers to **resolve "???" placeholders**: when `latest` reveals a song at a position where you logged "???", surface a dismissible suggestion to fill it in — **never auto-applied** — reusing the D-14/D-15 rename path. (Folded in from a Phase-4-deferred growth idea; small addition on top of the strip.)

### Live Sync — Polling & Binding (SYNC-01, SYNC-03)
- **D-05:** The poller's **pure fetch/parse/dedupe logic lives in `packages/core`** (zero-DOM; reuses the zod row schemas + `assertFilterApplied` artist_id guard). The **app** owns the 60s cadence, active-show gating, and offline pause/resume. Preserves strict core/UI separation.
- **D-06:** Poll the **`latest` endpoint only**, **≤ once per 60s, only while a show is active** — never the full `setlists` endpoint from client devices (SYNC-01). Descriptive **User-Agent** naming project + owner (mirrors the corpus fetcher's etiquette). **Tolerant failure policy:** a failed poll is **silent — just retry next interval** (UNLIKE the corpus fetcher's hard-fail-no-retry, which is a build-time path). Optionally **slow the cadence** when nothing changes for a long stretch (adaptive, within the ≤1/60s ceiling).
- **D-07:** **Auto-bind** the tracked show to the real kglw.net **`show_id` + venue** by **date-matching `latest`**, silently attaching it to the provisional record (finishes D-05 from Phase 4) and enabling Phase 6 dex/attendance reconciliation. **Wrong-show guard:** bind only when `latest`'s date equals today and it reads as tonight's show; any mismatch → **stay provisional, never overwrite**. Binding is reversible via the export/import round-trip.
- **D-08:** **Offline (SYNC-03):** the app is **fully functional offline**; on signal drop mid-show the quiet sync indicator flips to an "offline" state plus a **brief calm reassurance** ("offline — tracking still works, resyncs when signal returns"). Polling **resumes silently** when signal returns. Sync status is a **quiet indicator (small dot)**, never a loud banner.

### Data Safety — Export/Import (PWA-04)
- **D-09:** Export is a **single versioned JSON**: `{ schemaVersion, exportedAt, meta, attendedShows, trackedShows, trackedEntries }`.
- **D-10:** **Import merges (union)** by stable keys (`show_id` / `date` / `sessionId`) and **never drops existing local data** — friend-safe by construction. Phase 5 scope is **your own lose-a-phone round-trip**; friend-specific conflict UI / dex-diff is deferred to Phase 6 (SHAR-01).
- **D-11:** **Same-show dedupe:** shows with the same bound `show_id` (or same `date` when unbound) count as **one attendance** for the dex even across different `sessionIds` (phone + iPad) — consolidate under one show / keep the richer setlist. Prevents double-counted attendance on multi-device import.
- **D-12:** **Import validation:** **zod-validate** the file (reuse the project's zod pattern); **reject** a corrupt/unrecognized file with a clear message rather than partial-merging; **version-migrate** older `schemaVersion` exports forward. Protects the local dex from a bad file.
- **D-13:** **Backup nudge:** **auto-download the JSON at End Show**; a **one-time warning** if `navigator.storage.persist()` was denied; a **prominent Settings export/import button** always available. Not per-show nagging; not passive-only.
- **D-14:** **Placement:** add a **Settings surface** (new tab or gear-icon hash route, extending the existing `BottomTabBar` / `useHashRoute` pattern) hosting export/import + persist-storage status. **Scope-limited to export/import + storage status** — no destructive "clear all data" in Phase 5.

### Claude's Discretion
- Exact suggestion-strip copy/layout, sync-dot colors/placement, offline-reassurance wording, and adaptive-backoff timing thresholds — belong to planning / `/gsd-ui-phase`.
- Dexie **version(3)** migration wiring specifics (additive: `trackedEntries.source`; `trackedShows` `show_id`/venue binding columns) following the established additive-migration rule (never rewrite prior versions).
- Whether the Settings surface is a bottom-tab vs a gear-route — pick the most prominent without overbuilding navigation.
- Merge-conflict detail when two files disagree on the same show's entries (pick the richer set) — provided attendance stays deduped (D-11) and no local data is dropped (D-10).
- Poll cadence adaptivity curve (fixed-60 vs slow-when-idle) within the ≤1/60s ceiling.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 5 section: goal, 4 success criteria, requirement IDs (SYNC-01/02/03, PWA-04), `Mode: mvp`, `Depends on: Phase 4`.
- `.planning/REQUIREMENTS.md` — authoritative text for SYNC-01/02/03 and PWA-04 (and SHAR-01/DEX-02/SHOW-14 for Phase-6 boundary awareness — explicitly out of scope here).
- `.planning/PROJECT.md` — API-etiquette constraint (live polling only `latest`, ≤ 1/60s, volunteer-run fan site), iOS Safari IndexedDB eviction context, no-backend constraint.

### kglw.net API + schema (reuse for the live poller)
- `packages/core/src/cli/fetch-corpus.ts` — `fetchJson()` pattern (User-Agent, `AbortSignal.timeout`, envelope `error`/`data:[]` handling) to mirror for the `latest` poller. NOTE its hard-fail-no-retry is a build-time policy; the live poller uses the D-06 tolerant policy instead.
- `packages/core/src/ingest/api-types.ts` — `rawSetlistRowCensus` / `rawSetlistRowLocked` zod schemas + `formatRowError`; `latest` returns setlist rows validated by these.
- `packages/core/src/ingest/validate.ts` — `assertFilterApplied` (artist_id === 1 guard — SYNC-01 / DATA-03; the API silently ignores invalid filters).
- `packages/core/src/config.ts` — `apiBase`, `userAgent`, `fetchTimeoutMs`, `fetchDelayMs` (extend for the live poller cadence).
- `docs/SCHEMA.md` — `latest` endpoint shape, `setnumber`/`transition_id`/artist_id semantics, `data: []` = valid empty result.

### App foundation this phase extends
- `packages/app/src/db/db.ts` — Dexie `version(2)` schema + write helpers (`startShow`/`logSong`/`endShow`, provisional attendance). Extend via **`version(3)`** additive migration (`trackedEntries.source`; `trackedShows` `show_id`/venue binding fields).
- `packages/app/src/show/useShowSession.ts` — the `useLiveQuery` session hook the suggestion strip + adopt path integrate with.
- `packages/app/src/show/ActionBar.tsx` / `SearchSheet.tsx` / `TrailNodeSheet.tsx` — adopt + "???"-resolution reuse the D-14/D-15 rename and `logSong` paths (add `source`).
- `packages/app/src/routing/useHashRoute.ts`, `packages/app/src/components/BottomTabBar.tsx`, `packages/app/src/components/AppShell.tsx` — nav pattern the new Settings route extends.
- `packages/app/src/pwa/persist.ts` — `navigator.storage.persist()` handling (denied-persist warning hooks here); mirror its feature-detect + never-throw idiom for the poller.
- `packages/app/src/config.ts` — app-level constants (poll cadence, backoff, suggestion count) — single-config-file ethos.

### Prior-phase decisions
- `.planning/phases/04-show-mode/04-CONTEXT.md` — D-05 (venue/`show_id` deferred to Phase 5), D-06/D-08 (hit/miss semantics adopt-classification reuses), D-14/D-15 ("???" + rename), the two-source-trail note.
- `.planning/phases/03-app-shell-pwa-foundation/03-CONTEXT.md` — additive Dexie-migration rule, hash routing, install/update/persist patterns.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Core ingestion layer** (`fetch-corpus.ts` `fetchJson`, `api-types.ts` zod schemas, `validate.ts` `assertFilterApplied`) — the live poller reuses the fetch idiom, row validation, and artist_id guard; only the endpoint (`latest`), the browser lifecycle, and the tolerant failure policy differ.
- **Dexie DB** (`db.ts`) — extend via `version(3).stores({...})` additively (`trackedEntries.source`, `trackedShows` binding columns); `meta`/`attendedShows`/`trackedShows`/`trackedEntries` carry forward untouched and are exactly the export payload.
- **`useShowSession` + `useLiveQuery`** — reactive session state the suggestion strip reads; adopting a suggestion is just a `logSong(..., source:'editor')` write-through that the trail/tally re-render from.
- **`persist.ts`** — the `navigator.storage.persist()` seam for the backup nudge's denied-persist warning; also the never-throw browser-API idiom the poller mirrors.
- **Vitest `projects`** (core=`node`, app=`jsdom`) — core poller logic testable in Node with an injected `{ fetch }`; app export/import + migration testable via `fake-indexeddb`.

### Established Patterns
- **Strict core/UI separation** — API ingestion/parse/dedupe stays in core (zero DOM); the app owns timing/lifecycle (D-05).
- **Additive-only Dexie migrations** — never rewrite a prior `version(n)`; `version(3)` is purely additive.
- **Single config file for constants** — poll cadence, backoff, suggestion count live in config, no scattered magic numbers.
- **Write-through + `useLiveQuery` reactivity** — adopted suggestions and "???" resolutions commit to IndexedDB immediately; UI re-renders from the DB.
- **Injected deps for API code** — `fetch-corpus.ts` takes a `{ fetch, sleep }` pair for testability; the poller follows suit.

### Integration Points
- The **Show view** (`useShowSession`/`ShowView`) is where the suggestion strip mounts and the poller lifecycle binds (start on active show, pause offline, stop on End Show).
- **`version(3)` migration** is the seam Phase 6 (recap/dex derivation, retroactive marking) extends — design `source` + binding fields to be additive-friendly.
- The **new Settings route** plugs into `useHashRoute` + `BottomTabBar`; export/import + persist status live there.
- **Auto-bind** writes `show_id`/venue onto the existing provisional `trackedShows` row (the reconciliation seam D-05 left open).

</code_context>

<specifics>
## Specific Ideas

- **"Second set of eyes, never a clobber":** the editor is advisory only — suggestions are dismissible, deduped, and only ever for songs you haven't logged. Manual tracking is always the source of truth (SYNC-02).
- **Honest tally survives sync:** an adopted editor song is classified by the same fan rule as any log (hit if it was on your orbit, miss otherwise) and carries a `source:'editor'` tag — the tally never lies, and the recap can later separate your calls from the editor's.
- **The export is the real backstop:** iOS Safari can evict IndexedDB, so the JSON export — auto-offered at End Show, warned-about when persistence is denied, always reachable in Settings — is the genuine "losing a phone can't lose a dex" guarantee (PWA-04).
- **Polite by construction:** `latest`-only, ≤1/60s, active-show-only, descriptive User-Agent, silent-tolerant on failure, adaptive when idle — the volunteer-run site is treated as a guest treats a host.

</specifics>

<deferred>
## Deferred Ideas

- **Friend-file merge UX** — conflict preview, dex-diff, and the shareable summary card are Phase 6 (SHAR-01/SHAR-02). Phase 5's merge is friend-*safe* by construction (stable-key union) but ships no friend-specific UI.
- **Retroactive attendance marking** against the full kglw.net archive by date/venue — Phase 6 (DEX-02); Phase 5 only binds the *current* show via `latest`.
- **Post-show recap + rarity score** consuming the new `source`-tagged entries — Phase 6 (SHOW-14/STAT-02).
- **Destructive "clear all data" / reset** in Settings — deferred; a real data-loss footgun, out of scope for a show-#1 hard-bar phase.
- **Suppress the update toast during an active tracked show** — carried from Phase 3/4 deferred notes; belt-and-suspenders, not required by Phase 5.

### Reviewed Todos (not folded)
- **Fix truncated/oversized song-name text inside prediction orbs** (`.planning/todos/pending/2026-07-11-orb-song-name-text-truncated-and-oversized.md`) — matched Phase 5 on keywords (0.9) but it is a UI-rendering polish item for the orbit; it belongs in Phase 6 UI polish, not this sync/data phase. Left deferred.

</deferred>

---

*Phase: 5-Live Sync & Data Safety*
*Context gathered: 2026-07-13*
