# Phase 6: Pokédex, History & Stats - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 6-Pokédex, History & Stats
**Areas discussed:** Todo folding, Dex browsing & organization, Retroactive attendance marking, Recap & show history, Dex sharing, FAB trade-off

---

## Todo Folding

| Option | Description | Selected |
|--------|-------------|----------|
| None — keep Phase 6 dex-only | Leave all three as pending todos for a separate quick pass | |
| Orb song-name text fix | Fold the truncated/oversized orb-label fix | ✓ |
| InstallBanner once-per-version | Fold the banner-frequency fix | ✓ |
| FAB action-menu consolidation | Fold the collapsed FAB menu | ✓ |

**User's choice:** Fold all three (initial answer selected "None" plus all three; clarifying follow-up confirmed "Fold all three into Phase 6").
**Notes:** Phase 6 becomes dex + the UI-polish pass.

---

## Dex Browsing & Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Card grid (song-level) | Pokédex-style grid of song cards with tuning color + count badges | |
| Compact list | Dense stats-table rows | |
| Stats header + list hybrid | Stats-first, collection second | |

**User's choice (free text):** Card grid **aggregated by album** with the correct album cover; card shows caught/total tally; clicking an album opens its song list with seen/unseen highlighting. May need to source covers from the internet.

| Question | Selected |
|----------|----------|
| Default sort | Alphabetical **by album name** (free text) |
| Never-seen songs | Dimmed in same view (Recommended) |
| Debut-candidate framing | Badge everywhere (Recommended) |

Follow-ups on the album design:

| Question | Options | Selected |
|----------|---------|----------|
| Cover sourcing | Fetch once at build + bundle / No covers / You decide | Fetch once at build, bundle (Recommended) |
| Song→album mapping | Canonical studio album / Studio only hide rest / You decide | Canonical studio album (Recommended) |
| Check-off semantics | Display-only derived / Manual toggle too | Display-only, derived (Recommended) |
| Stats placement | Header + song rows / Dedicated stats view / You decide | Header + song rows (Recommended) |

---

## Retroactive Attendance Marking

| Question | Options | Selected |
|----------|---------|----------|
| Archive source | Bundled corpus / Bundled + live API fallback / You decide | Free text: corpus first, online kglw.net search for very recent shows, and the full album discography — source is Claude's to figure out |
| Search UX | Browse by year + search / Search box only / Calendar picker | Browse by year + search (Recommended) |
| Credit on mark | Full setlist auto-credited / Confirm per-song / You decide | Full setlist auto-credited (Recommended) |
| Unmark | One-tap unmark / Retro-marked only / You decide | Yes, one-tap unmark (Recommended) |

---

## Recap & Show History

| Question | Options | Selected |
|----------|---------|----------|
| Recap timing | Auto after End Show / From history only / You decide | Auto after End Show (Recommended) |
| Recap contents (multi) | Tally+% / Manual vs editor split / Rarity + rarest / New catches | All four |
| Rarity presentation | Number + label / Tier labels / You decide | Free text: **Tier labels** Common/Uncommon/Rare/Legendary based on play-frequency data, plus "any other interesting metrics you can think of" |
| History home | In the Dex tab / Own tab / You decide | In the Dex tab (Recommended) |

---

## Dex Sharing

| Question | Options | Selected |
|----------|---------|----------|
| Friend-file import | Compare view never merge / Ask on import / You decide | Compare view, never merge (Recommended) |
| Card format | Image / Text block / Both | Image (Recommended) |
| Card extras (multi) | Tier breakdown / Total songs caught / Latest-best show / Keep minimal | Tier breakdown + Total caught + Latest/best show |
| Share flow | Web Share API + fallback / Download only / You decide | Web Share API + fallback (Recommended) |

---

## FAB Trade-off (folded todo)

| Option | Description | Selected |
|--------|-------------|----------|
| Everything in the FAB | All five actions collapse; extra tap on hot paths | ✓ |
| Keep ??? + Undo exposed (Recommended) | FAB holds Search/Set break/Encore only | |
| Keep ??? exposed only | Undo joins the FAB | |

**User's choice:** Everything in the FAB — extra tap on ???/Undo accepted deliberately (goes against the flagged recommendation; owner prioritizes orbit space).

---

## Claude's Discretion

- Album-cover source + build pipeline; discography source selection
- Archive-index artifact shape (compact show→songIds derivation vs corpus subset)
- Rarity-tier thresholds + bonus recap metrics (data-driven, config constants)
- Dex derivation module design in core (fixture-tested)
- Dexie version(4) migration shape; compare-view layout; recap visual design
- Live-API recent-show search specifics (reuse ingestion schemas + assertFilterApplied)

## Deferred Ideas

- Constellation dex overlay — Phase 7 (DEX-05)
- Real-time friend sync — v2 (SOCL-V2-01)
- Destructive "clear all data" — still deferred
- Suppress update toast during active show — still unclaimed (carried from Phases 3–5)
