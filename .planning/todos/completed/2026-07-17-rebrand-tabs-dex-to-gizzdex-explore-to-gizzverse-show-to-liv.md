---
created: 2026-07-17T03:38:29.677Z
title: Rebrand tabs — Dex→GizzDex, Explore→GizzVerse, Show→LiveGizz
area: ui
files:
  - packages/app/src/components/BottomTabBar.tsx:5-7
---

> **Status update (2026-07-17):** **Layer-1 (visible tab labels) is DONE** —
> shipped in quick task `260716-wwj`, commit `ba775f0`. `BottomTabBar` now renders
> **GizzDex / GizzVerse / LiveGizz**; routes and storage keys were left untouched.
> Only **layer-2 (internal code-identifier consistency)** remains open below — an
> optional pass, deliberately deferred (owner: leave for later unless it causes
> problems; it does not).

## Problem

The three main tabs are named with generic words. Owner wants themed names
consistent with the King Gizzard brand, applied both in the UI and in code:

- "Dex" → **GizzDex**
- "Explore" → **GizzVerse**
- "Show" → **LiveGizz**

Owner request 2026-07-17: change these "everywhere ... as in the tab title" in
the app, and also "in code (for consistency)".

## Solution

Tab labels are defined in `packages/app/src/components/BottomTabBar.tsx:5-7`:
```
{ route: "show",    label: "Show",    Icon: Music },
{ route: "explore", label: "Explore", Icon: Compass },
{ route: "dex",     label: "Dex",     Icon: BookOpen },
```

Scope the change in two layers during planning — they carry very different risk:

1. **User-facing copy (safe, do this):** the tab `label`s above, plus any headers,
   view titles, empty-states, menu items, and prose that say "Dex" / "Explore" /
   "Show" as product names (~50 `.tsx` occurrences of these words — filter out the
   generic/verb uses of "show", e.g. "show more", and the noun "shows" meaning
   concerts/setlists, which should NOT be renamed).

2. **Code identifiers "for consistency" (do carefully, NOT blind find-replace):**
   directory names (`src/dex/`, `src/explore/`, `src/show/`), component/type
   names, etc. can be renamed, BUT the following MUST stay stable or be migrated
   deliberately:
   - **Route strings** `"show"` / `"explore"` / `"dex"` — changing these breaks
     hash/route navigation and any saved deep links. Keep the route keys, or add a
     redirect/alias if they must change.
   - **Persisted keys** — Dexie table names, IndexedDB store names, localStorage
     keys, and JSON export field names. Renaming these silently orphans users'
     already-logged setlists / Pokédex data. Leave persisted schema alone (or write
     a migration).

Recommendation: do layer 1 (visible rename) as the shippable change; treat layer 2
as an optional internal-consistency pass that explicitly excludes route + storage
keys. Decouple the *display name* from the *route/storage key* so the brand can
change without data risk.
