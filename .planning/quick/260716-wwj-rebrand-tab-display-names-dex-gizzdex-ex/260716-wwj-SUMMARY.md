---
quick_id: 260716-wwj
title: Rebrand tab display names — Dex→GizzDex, Explore→GizzVerse, Show→LiveGizz
status: complete
date: 2026-07-17
---

# Summary — Quick Task 260716-wwj

Renamed the three bottom-tab **display labels** so the app (and future work)
refers to the screens by their branded names.

## Changed

- `packages/app/src/components/BottomTabBar.tsx` — `TABS` array labels only:
  - "Show" → **LiveGizz**
  - "Explore" → **GizzVerse**
  - "Dex" → **GizzDex**

Route keys (`"show"`/`"explore"`/`"dex"`) and Icon bindings unchanged.

## Verification

- `npx tsc -p packages/app/tsconfig.json --noEmit` → exit 0 (clean).
- Grep confirms new labels present and all three `route:` values unchanged.
- Change is a `label: string` value swap — no type/route/storage impact.

## Deliberately NOT changed

- Route strings, Dexie/IndexedDB/localStorage keys, JSON export fields,
  directory names, component/type identifiers.
- Dead `config.copy.placeholders.{show,explore,dex}.heading` scaffold strings
  (never rendered — real views exist for all three tabs).
- Feature name "Show Mode", concert-noun "Show" (Start Show / End Show /
  Show recap), and verb "Show" ("Show all N").

## Follow-up available

Layer-2 of source todo `2026-07-17-rebrand-tabs-dex-to-gizzdex-explore-to-gizzverse-show-to-liv`
(internal code-identifier consistency, excluding routes + persisted keys) remains
open if deeper consistency is wanted later.
