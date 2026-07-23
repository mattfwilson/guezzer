# Phase 19: Shared Dex Progress - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 19-shared-dex-progress
**Areas discussed:** Friends screen home, Friend detail & compare, List & self-row, Sync & offline states, Rarest showcase & row badge, Tier reconstruction, Privacy / what syncs, Empty-before-sync state, Friend detail surface, Live-subscription scope, Reconnect reconciliation, Toggle label, Self-row tap, Zero-catch friend

---

## Friends screen home (placement)

| Option | Description | Selected |
|--------|-------------|----------|
| 6th bottom tab | Dedicated Friends/GizzCrew tab beside the other 5; max prominence, crowds tap targets to 6 | |
| Section inside GizzDex | A third `Albums \| Shows \| Friends` toggle; thematically natural, no new tab | ✓ |
| Folded into GizzMap | Add friends' progress to the geographic member map | |
| Reached from header avatar | Friends entry in the identity sheet → overlay; keeps 5 tabs, buries the payoff | |

**User's choice:** Section inside GizzDex (`Albums | Shows | Friends` toggle).
**Notes:** Compare logic already lives in the dex domain; it's literally "your dex vs their dexes." No new tab.

---

## Friend detail — what it leads with

| Option | Description | Selected |
|--------|-------------|----------|
| Head-to-head first | "You vs {name}" columns → per-tier → per-album (expandable) → their rarest showcase; mirrors shipped CompareView | ✓ |
| Their trophy case first | Lead celebrating them (rarest + stats), comparison below; friendlier/less competitive | |
| You decide | — | |

**User's choice:** Head-to-head first.

---

## Friend detail — reuse relationship to shipped CompareView

| Option | Description | Selected |
|--------|-------------|----------|
| Extract shared render, both use it | Pull CompareView's presentation into one shared component fed `theirs: DexStats`; file-import + live both render through it | |
| New friend-detail view | Leave file-import CompareView untouched; build separate live `FriendDetail.tsx` reusing core (`compareDexes`) + TierBadge | ✓ |
| You decide | — | |

**User's choice:** New `FriendDetail.tsx`; leave `CompareView.tsx` untouched.
**Notes:** Less coupling risk to the shipped import path; some render duplication accepted.

---

## List — self-row

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pinned "You" row on top | Own row from live local dex (`useDexStats`), always current, works offline; instant me-vs-everyone anchor | ✓ |
| No — others only | List others only; own numbers stay in the GizzDex header | |

**User's choice:** Pinned "You" row on top (from live local dex).

---

## List — default order

| Option | Description | Selected |
|--------|-------------|----------|
| By completion % (desc) | Highest completion first; implicit ranking; ties → caught, then name | ✓ |
| Alphabetical by name | Neutral, stable, never jumps mid-show | |
| You decide | — | |

**User's choice:** By completion % (desc). (Single fixed order — sortable leaderboard PROG-F1 deferred.)

---

## Offline / dead-signal view (other friends)

| Option | Description | Selected |
|--------|-------------|----------|
| Last-known cached rows + offline marker | Persist last pull locally; show dimmed rows + calm "offline · as of {time}" (SyncDot language); "You" stays live | ✓ |
| Your row only + "friends update online" note | Hide stale friend numbers; mostly-empty payoff screen at the venue | |
| You decide | — | |

**User's choice:** Last-known cached rows + offline marker.

---

## Own-row upsert debounce

| Option | Description | Selected |
|--------|-------------|----------|
| ~5s after last change | Balances "progress visibly moves" with not hammering during a logging burst; tunable | ✓ |
| ~2s (snappier) | Faster friend visibility, slightly more writes | |
| ~10s (calmer) | Fewer writes, more lag behind a live catch | |

**User's choice:** ~5s after last change (config constant).

---

## Rarest — detail showcase count

| Option | Description | Selected |
|--------|-------------|----------|
| Top 5 | Showcase 5 rarest; matches existing top-5 idioms | ✓ |
| Top 3 | Tighter, 3 headline trophies | |
| You decide | — | |

**User's choice:** Top 5.

---

## Rarest — list row badge

| Option | Description | Selected |
|--------|-------------|----------|
| Single rarest badge | One badge = single rarest tier (PROG-04's "rarest badge"); scannable rows | ✓ |
| Small cluster (top 3) | Three tier dots per row; richer but busier | |

**User's choice:** Single rarest badge.

---

## Tier reconstruction for compare

| Option | Description | Selected |
|--------|-------------|----------|
| Local rarity-index lookup | Reconstruct tiers from bundled shared rarity index by songId; lean payload (ids only) | ✓ |
| Carry per-song tiers in payload | Include each song's tier in the summary; bulkier, redundant (rarity is corpus-derived) | |

**User's choice:** Local rarity-index lookup.

---

## Privacy / what syncs

| Option | Description | Selected |
|--------|-------------|----------|
| Fine — sync the full set | Whole `caughtSongIds` int[] + name/completion/counts/perAlbum/rarest → readable by the friend group; powers head-to-head | ✓ |
| Scope it down | Headline stats only; would neuter PROG-06 diff lists | |

**User's choice:** Fine — sync the full set (consistent with the old manual JSON handoff, now automatic).

---

## Empty-before-sync state

| Option | Description | Selected |
|--------|-------------|----------|
| Your row + "friends appear here" note | Pinned "You" row + calm empty note; payoff primed, never blank | ✓ |
| You decide | — | |

**User's choice:** Your row + "friends appear here as they sign in and start catching" note.

---

## Friend detail surface

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom Sheet | Over the list; matches shipped CompareView + dex drill-in idiom; swipe/tap dismiss | |
| Full-screen overlay | Takes over the screen; more room for head-to-head; own back affordance | ✓ |

**User's choice:** Full-screen overlay.
**Notes:** Owner chose room for the head-to-head over strict sheet-pattern consistency.

---

## When live updates run (subscription scope)

| Option | Description | Selected |
|--------|-------------|----------|
| Only while Friends is open | Subscribe on toggle mount, unsubscribe on leave; no idle socket | |
| App-wide while signed in | Stay subscribed the whole session; friend data always warm | ✓ |

**User's choice:** App-wide while signed in.
**Notes:** Dovetails with Phase 20's persistent presence channel.

---

## Reconnect reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| Flush own row + re-pull friends | On regaining signal, upsert fresh summary (catch friends up on offline catches) + re-pull all friend rows once | ✓ |
| Just resume debounced writes | No special flush; next dex change triggers normal ~5s upsert | |

**User's choice:** Flush own row + re-pull friends (ties into `useOnlineStatus` / SyncDot).

---

## GizzDex toggle label

| Option | Description | Selected |
|--------|-------------|----------|
| Friends | Plain, clear; matches "Gizz With Friends" framing | ✓ |
| GizzCrew | On-brand with GizzDex/GizzVerse/GizzMap/GizzGames; more playful | |
| You decide | — | |

**User's choice:** Friends.

---

## Self-row tap

| Option | Description | Selected |
|--------|-------------|----------|
| Not tappable | Static self-anchor; full dex already in GizzDex | |
| Opens your trophy case | Own rarest-catches showcase (detail layout, no head-to-head) | ✓ |

**User's choice:** Opens your own trophy case.

---

## Zero-catch friend (row exists, 0%)

| Option | Description | Selected |
|--------|-------------|----------|
| Show at bottom (0%) | List with 0% · 0 caught · no badge, sorted last; honest "here, not caught yet" | ✓ |
| Hide until first catch | Cleaner list; a present-but-empty friend is invisible | |

**User's choice:** Show at bottom (0%).

---

## Claude's Discretion

- Exact debounce constant value + config-block location; reconnect/first-sync wiring mechanics.
- Location of the Supabase progress-sync module (app-layer `packages/app/src/sync/` fence, never in core).
- The exact `SharedProgress` type + the summary→minimal-`DexStats` reconstruction helper (must feed the unchanged `compareDexes`).
- Where/how the last-known friend pull is persisted for the offline view (Dexie vs localStorage) + the "as of {time}" stamp derivation.
- Exact copy strings and the visual treatment of the FriendDetail overlay, list rows, and self-row.
- Rarest-showcase constant name/value (default top-5); neutral treatment when a friend has no rarest badge.

## Deferred Ideas

- Sortable multi-key leaderboard → PROG-F1 (deferred).
- Per-friend live-syncing share card → PROG-F2 (deferred).
- Historical progress timeline / climb graph → PROG-F3 (later milestone).
- Presence dots / coarse activity / waves / reactions on this screen → Phase 20 (PRES-01…07; PRES-07 fuses PROG+PRES here).
- Rare-catch notifications outside the Friends toggle → out of scope; borders Phase 20.
- Resettable rows / own-inflation trust hardening → not needed for a ~5-friend private tool; revisit only if it becomes a concern.
