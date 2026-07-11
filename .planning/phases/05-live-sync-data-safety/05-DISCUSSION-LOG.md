# Phase 5: Live Sync & Data Safety - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 5-live-sync-data-safety
**Areas discussed:** Suggestion display, Polling & show-binding, Export/import UX, Sync trust framing, Adoption tally & provenance, Backup nudge, Offline reassurance, Friend-file import scope, Poll etiquette/failure policy, ??? resolution via sync, Import validation, Export placement, Same-show merge identity, Settings scope

---

## Suggestion display (SYNC-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Dismissible strip | Subtle strip below the orbit; tap-adopt / swipe-dismiss; keeps orbit uncluttered | ✓ |
| Ghost orbs in orbit | Editor suggestions as distinct ghost orbs; richer but mis-tap risk | |
| Badge only | Unobtrusive badge; minimal but hides the suggestion | |

**User's choice:** Dismissible strip
**Notes:** Aligns with D-13 mis-tap avoidance in a dark venue.

---

## Polling & show-binding (SYNC-01, D-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-bind by date | Silently bind show_id/venue when `latest` matches today's date; else stay provisional | ✓ |
| Suggest, then confirm | One-tap confirm before binding; safer against wrong-show | |
| No binding in Phase 5 | Defer all show_id binding to Phase 6 | |

**User's choice:** Auto-bind by date
**Notes:** Wrong-show guard captured as discretion — bind only when date == today and it reads as tonight's show.

---

## Export / import UX (PWA-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Merge / union | Merge by stable keys, never drop local data; friend-safe by construction | ✓ |
| Replace / restore | Wholesale replace; simpler but risky for exchange/multi-device | |
| Merge with conflict preview | Default merge + preview on conflict; safest but more UI | |

**User's choice:** Merge / union

---

## Sync trust framing (SYNC-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Only un-logged songs | Suggestions only for songs not yet logged; editor never contradicts you | ✓ |
| Also flag disagreements | Note when editor diverges from your manual entry; more info, more doubt | |
| You decide | Least-intrusive per SYNC-02 | |

**User's choice:** Only un-logged songs

---

## Adoption tally & provenance

| Option | Description | Selected |
|--------|-------------|----------|
| Fan rule + source tag | Same hit/miss classify + `source:'editor'` via additive Dexie v3 migration | ✓ |
| Always miss + source tag | Any editor-adopted song is a miss regardless; simpler, less honest | |
| You decide | Most consistent with D-06/D-08 | |

**User's choice:** Fan rule + source tag
**Notes:** Adds `source: 'manual' | 'editor'` to `trackedEntries` (version(3)); enables Phase 6 recap decomposition.

---

## Backup nudge aggressiveness (PWA-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-download at End Show + persist warning | Offer download at End Show; one-time warning if persist denied; Settings button always | ✓ |
| Passive Settings button only | No prompts; relies on user remembering | |
| Aggressive (every show + auto-download) | Nudge every show; safest but annoying | |

**User's choice:** Auto-download at End Show + persist warning

---

## Offline reassurance UX (SYNC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Calm reassurance line | Quiet dot → offline + brief "tracking still works, resyncs" line | ✓ |
| Silent (dot only) | Only dot changes; cleanest but user may not realize tracking is safe | |
| You decide | Least-intrusive reassurance | |

**User's choice:** Calm reassurance line

---

## Friend-file import scope (vs Phase 6 SHAR-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Own-backup only, friend-safe by construction | Lose-a-phone round-trip; merge keyed by stable IDs; no friend UI | ✓ |
| Anticipate friend files now | Full merge/conflict handling this phase; pulls Phase 6 forward | |
| You decide | Minimal but forward-compatible | |

**User's choice:** Own-backup only, friend-safe by construction

---

## Poll etiquette / failure policy (SYNC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptive + tolerant | 60s active-show only; descriptive UA; silent-retry on failure; slow when idle | ✓ |
| Fixed 60s, tolerant | Strict 60s, silent-tolerate, no backoff; simpler | |
| You decide | Best honors etiquette constraint | |

**User's choice:** Adaptive + tolerant
**Notes:** Contrasts with the corpus fetcher's build-time hard-fail-no-retry policy.

---

## ??? resolution via sync (Phase-4-deferred growth)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, offer to fill ??? | Editor-revealed song offered (dismissible) to fill a "???" placeholder; reuses D-14/D-15 | ✓ |
| No, defer to later | Keeps scope tighter | |
| You decide | Fold in only if small | |

**User's choice:** Yes, offer to fill ???

---

## Import validation (PWA-04, data safety)

| Option | Description | Selected |
|--------|-------------|----------|
| Zod-validate + version-migrate | Validate; reject corrupt file clearly; migrate older schemaVersion forward | ✓ |
| Best-effort merge | Merge whatever parses; forgiving but risks silent partial import | |
| You decide | Best protects local data | |

**User's choice:** Zod-validate + version-migrate

---

## Export placement (PWA-04 "prominently surfaced")

| Option | Description | Selected |
|--------|-------------|----------|
| New Settings tab/route | Settings surface hosting export/import + storage status; extends BottomTabBar/hash route | ✓ |
| Tuck into existing view | No new nav, less prominent | |
| You decide | Most prominent without overbuilding | |

**User's choice:** New Settings tab/route

---

## Same-show merge identity

| Option | Description | Selected |
|--------|-------------|----------|
| Dedupe by show identity | Same show_id (or date when unbound) = one attendance across sessionIds | ✓ |
| Keep both, flag duplicate | Import both, flag possible duplicate; simpler but risks inflated attendance | |
| You decide | Keeps counts honest without heavy UI | |

**User's choice:** Dedupe by show identity

---

## Settings scope

| Option | Description | Selected |
|--------|-------------|----------|
| Export/import + storage status only | Minimal, safe; no destructive clear-data | ✓ |
| Also include 'clear all data' | Adds guarded reset; useful but a data-loss footgun | |
| You decide | What PWA-04 needs, defer destructive | |

**User's choice:** Export/import + storage status only

---

## Claude's Discretion

- Exact suggestion-strip copy/layout, sync-dot colors/placement, offline-reassurance wording, adaptive-backoff timing thresholds (planning / UI-spec).
- Dexie version(3) migration wiring specifics (additive: `trackedEntries.source`; `trackedShows` show_id/venue columns).
- Settings surface as bottom-tab vs gear-route.
- Merge-conflict detail when two files disagree on the same show's entries (pick richer set), provided attendance stays deduped (D-11) and no local data dropped (D-10).
- Poll cadence adaptivity curve within the ≤1/60s ceiling.

## Deferred Ideas

- Friend-file merge UX / conflict preview / dex-diff / shareable summary card — Phase 6 (SHAR-01/02).
- Retroactive attendance marking against the full archive — Phase 6 (DEX-02).
- Post-show recap + rarity score consuming `source`-tagged entries — Phase 6 (SHOW-14/STAT-02).
- Destructive "clear all data" / reset — deferred (footgun).
- Suppress the update toast during an active tracked show — carried from Phase 3/4 deferred notes.
- Reviewed-not-folded todo: orb song-name text truncation (UI polish → Phase 6).
