---
quick_id: 260716-wwj
title: Rebrand tab display names — Dex→GizzDex, Explore→GizzVerse, Show→LiveGizz
created: 2026-07-17T03:41:26.071Z
mode: quick
---

# Quick Task 260716-wwj: Rebrand tab display names

Layer-1 of todo `2026-07-17-rebrand-tabs-dex-to-gizzdex-explore-to-gizzverse-show-to-liv`.
Change the visible bottom-tab labels only, so future work refers to the screens
by their branded names. Routes, storage keys, and identifiers are untouched.

## Scope decision (from discovery)

The only always-visible surface that displays the tab identity is the
`TABS` array in `packages/app/src/components/BottomTabBar.tsx:5-7`. Confirmed by
discovery:
- The top app-bar header is a static "Guezzer" wordmark (`AppShell.tsx:43-45`) — no tab name.
- `config.copy.placeholders.{show,explore,dex}.heading` are dead scaffold
  empty-states ("… lands in Phase N") — `PlaceholderView` renders only for the
  fallback route (`App.tsx:59`), never for show/explore/dex which all have real
  views. Not user-visible → left unchanged.
- All other "Show"/"Explore"/"Dex" hits are code comments, the verb "Show"
  ("Show all N"), the concert-noun "Show" ("Start Show"/"End Show"/"Show recap"),
  or identifiers/routes — all explicitly out of scope.

## Task 1: Rename the three bottom-tab labels

- **files:** `packages/app/src/components/BottomTabBar.tsx`
- **action:** In the `TABS` array, change `label` values only:
  - `label: "Show"` → `label: "LiveGizz"`
  - `label: "Explore"` → `label: "GizzVerse"`
  - `label: "Dex"` → `label: "GizzDex"`
  Leave every `route:` value (`"show"`/`"explore"`/`"dex"`) and the `Icon`
  bindings exactly as they are.
- **verify:** `route` strings unchanged; `pnpm -w typecheck` (or `tsc`) clean; grep
  shows the three new labels present.
- **done:** Bottom tab bar renders GizzDex / GizzVerse / LiveGizz with navigation
  and routing unchanged.

## Out of scope (deliberate)

Route strings, Dexie/IndexedDB/localStorage keys, JSON export fields, directory
names (`src/dex`, `src/explore`, `src/show`), component/type identifiers, feature
name "Show Mode", concert-noun "Show", and verb "Show". Deeper code-identifier
consistency remains available as layer-2 of the source todo.
