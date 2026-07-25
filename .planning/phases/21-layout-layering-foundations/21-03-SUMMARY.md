---
phase: 21-layout-layering-foundations
plan: 03
subsystem: navigation-and-presence-copy
tags: [nav, copy, presence, config, security-input-validation]
requires:
  - packages/app/src/routing/useHashRoute.ts (Route union, ROUTES — read-only, frozen)
  - packages/app/src/sync/presenceActivity.ts (Tab union, ROUTE_TO_TAB, reduceActivity — frozen)
  - packages/app/src/config.ts (copy.presence.atShow / offline)
provides:
  - config.copy.tabs (show/explore/map/dex/games — the tab voice)
  - config.copy.presence.activity (Record<Tab, string> — the presence voice)
  - config.copy.presence.activityUnknown ("in the app" — the D-41 constant fallback)
  - presenceActivityLabel(activity, online) exported from packages/app/src/dex/FriendRow.tsx
  - PresenceActivitySlot `online?: boolean` prop
affects:
  - packages/app/src/components/BottomTabBar.tsx (labels now read from config)
  - packages/app/src/dex/FriendRow.tsx, packages/app/src/dex/SelfRow.tsx (presence label resolution)
tech-stack:
  added: []
  patterns:
    - "`as const satisfies Record<K, string>` for exhaustive, literal-typed copy maps in config.ts"
    - "type-only imports into config.ts (`import type`) keep it a runtime leaf module"
    - "render-path fallback (option ii) — never relax a read-boundary allow-list to fix display"
key-files:
  created:
    - packages/app/test/presenceLabels.test.ts
  modified:
    - packages/app/src/config.ts
    - packages/app/src/components/BottomTabBar.tsx
    - packages/app/src/dex/FriendRow.tsx
    - packages/app/src/dex/SelfRow.tsx
    - packages/app/src/sync/presenceActivity.ts (comment-only)
    - packages/app/test/rebrand.test.ts
    - packages/app/test/dex/friendPresence.test.tsx
decisions:
  - "NAV-03 fallback placed in the render path (option ii), NOT in reduceActivity — the TABS allow-list is a real input-validation control over untrusted peer payloads and stays byte-identical"
  - "The `??` arm is always the constant `activityUnknown`, never `?? activity.tab` — no peer-supplied text reaches the DOM"
  - "BottomTabBar's TABS array narrows to `Exclude<Route, 'settings'>` because `settings` owns no tab and therefore no label"
  - "Typecheck proven with `tsc --noEmit`, not `vite build` (esbuild transpiles without typechecking)"
metrics:
  duration: ~12 min
  completed: 2026-07-24
  tasks: 3
  commits: 3
  tests_before: 954
  tests_after: 972
---

# Phase 21 Plan 03: Tab Rename & Presence Labels Summary

Two label voices off one frozen wire token: `config.copy.tabs` shortens the bottom strip to
Live · GizzVerse · Map · Me · Games, `config.copy.presence.activity` renders a friend's dot as
"on GizzDex", and an online friend whose activity can't be resolved reads "in the app" instead
of blank — with every route, wire token and storage key provably untouched.

## What Was Built

**Task 1 — both label maps in `config.copy`; `BottomTabBar` reads the tab voice** (`1cc5787`)

`config.ts` gained two type-only imports (`Route`, `Tab`) and two maps:

- `copy.tabs` — `show: "Live"`, `explore: "GizzVerse"`, `map: "Map"`, `dex: "Me"`,
  `games: "Games"`, typed `as const satisfies Record<Exclude<Route, "settings">, string>`.
- `copy.presence.activity` — the six-token presence voice (`on LiveGizz` … `idle`), typed
  `as const satisfies Record<Tab, string>` so adding a `Tab` member without a label is a
  **compile error**, not a blank presence dot.
- `copy.presence.activityUnknown: "in the app"` — the D-41 constant.

Both carry JSDoc stating the `260716-wwj` display-only rule, D-40's two-voices rationale
verbatim in substance ("the tab reads *Me* because it is *your* tab, so a friend's dot must never
read 'Alex is on Me'"), and the capitalization rule (only the emphasized `At a show 🎸` keeps its
capital; every muted state is lowercase-leading, and `idle` is a state so it is `"idle"`, never
`"on idle"`).

`BottomTabBar.tsx` now reads `config.copy.tabs.<route>` per `TABS` entry. Array shape and order,
the `Icon: typeof Music` typing, all five icons (including the deliberately-unchanged `BookOpen`
beside "Me", D-43), `flex-1 min-h-11 min-w-11`, `aria-current`, the `text-accent`/`text-text-muted`
split, the label span classes and the `<nav>` height/padding (owned by 21-07) are all unchanged.

**Task 2 — presence resolution + the D-41 render-path fallback** (`63a2b1b`)

New pure exported helper in `FriendRow.tsx`:

```ts
presenceActivityLabel(activity: Activity | null | undefined, online: boolean): string | null
```

Resolution order exactly as specified: `atShow` wins → known token → its presence-voice label
(unknown token falls through to the constant) → `activity == null && online` → `"in the app"` →
otherwise `null`. `PresenceActivitySlot` gained `online?: boolean` (default `false`) and computes
`label ?? presenceActivityLabel(activity, online)`; the explicit-`label` override precedence, the
`strong` emphasis rule, the `data-slot`/`shrink-0` wrapper, the 13px muted/primary split and the
WCAG-1.4.1 doc sentence are unchanged. `FriendRow` passes `online={online}`; `SelfRow` passes
`online` on the online branch and leaves the offline branch's `label={config.copy.presence.offline}`
override alone.

`presenceActivity.ts` received a **comment-only** change (verified: the diff contains zero
non-comment lines) correcting the stale "These ARE the display labels" note — it now records the
frozen `gizz-room` vocabulary, where each voice lives, why receiver-side resolution makes a token
rename permanently breaking, and the honest limitation that the D-41 fallback is **forward
protection only** (already-shipped builds still render blank for a token they don't know).

**Task 3 — the discipline locked by test** (`c48651c`)

- New `packages/app/test/presenceLabels.test.ts` (9 `it` cases): whole-map equality on
  `config.copy.presence.activity`, explicit iteration over all six `Tab` tokens for non-empty
  labels, the D-40 assertion (`"on GizzDex"` and explicitly `!== "on Me"`, `!== config.copy.tabs.dex`,
  `!== "GizzDex"`), atShow precedence, `null + online → "in the app"`, `null + offline → null`, and
  the unknown-token case pinned to the constant with `!== "SomeFutureTab"` / `not.toContain`.
- `rebrand.test.ts` NAV-02 block (7 cases): `config.copy.tabs` equality, `ROUTES` unchanged,
  `ROUTE_TO_TAB` unchanged, the six frozen `Tab` tokens, `config.DB_NAME === "guezzer"`,
  `sectionHeading` still `"GizzGames"` beside `tabs.games === "Games"`, and the **D-44** source-read
  (`readFileSync` + `fileURLToPath` against `src/dex/DexView.tsx`, never `dist`) proving
  `<DexHeader` → `<AlbumGrid` → `<ShowsList` → `<FriendsList` all present and in that `indexOf`
  order.
- `friendPresence.test.tsx` gained the two end-to-end render cases (`on GizzDex` with
  `queryByText("on Me")`/`("GizzDex")` both absent; `in the app` for an online friend with
  `activity={null}`).

`test/sync/presenceActivity.test.ts` passes with **zero edits** — `reduceActivity([{ tab: "nonsense" }])`
still returns `null`, which is the whole point of option (ii).

## Key Decisions

**NAV-03 fallback placement: option (ii), the render path.** `reduceActivity`'s `TABS` allow-list
is a genuine input-validation control (ASVS V5) over attacker-influenceable peer presence payloads
crossing into the DOM. Relaxing it so an unknown token could survive to the render layer would
trade a security property for a cosmetic one, so the fallback lives in `presenceActivityLabel`
instead and the allow-list is byte-identical. Recorded as a comment at the fallback site and
locked by the zero-diff assertion plus the `!== "SomeFutureTab"` test (T-21-06).

**The map lookup is index-then-constant.** `presence.activity[activity.tab] ?? presence.activityUnknown`
— the `??` arm is a string we chose, never the peer's token, so no peer-supplied text can reach
the DOM through this slot even for a token from a future build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing `friendPresence.test.tsx` assertions pinned the raw wire tokens**

- **Found during:** Task 2 (its `<verify>` command runs `friendPresence.test.tsx`)
- **Issue:** Three shipped assertions asserted the bare token as rendered text
  (`getByText("GizzVerse")`, two × `getByText("GizzDex")`), and one case asserted that an
  **online** friend with `activity={null}` renders no label — which D-41 deliberately changes to
  `"in the app"`.
- **Fix:** Retargeted the three token assertions to `presence.activity.<Token>` (and added a
  negative assertion that the bare token is gone), and re-pointed the never-blank case at an
  **offline** friend, where an empty slot remains correct. The online-and-null case is re-added as
  a positive `in the app` assertion in Task 3, so coverage strictly increased.
- **Files modified:** `packages/app/test/dex/friendPresence.test.tsx`
- **Commit:** `63a2b1b`

**2. [Rule 3 - Blocking] `TABS` array annotation had to narrow to `Exclude<Route, "settings">`**

- **Found during:** Task 1
- **Issue:** The plan says keep the `TABS` array shape, but `config.copy.tabs` correctly has no
  `settings` key (settings owns no bottom tab), so a `route: Route` annotation makes
  `config.copy.tabs[route]` a type error.
- **Fix:** Added a one-line local `type TabRoute = Exclude<Route, "settings">` and used it for the
  `route` field. Array shape, order, icons and every other field are unchanged; `navigate(route)`
  and `active === route` still typecheck because `TabRoute` is a subset of `Route`.
- **Files modified:** `packages/app/src/components/BottomTabBar.tsx`
- **Commit:** `1cc5787`

### Verification Note (not a code deviation)

The plan's Task 1 acceptance criterion states that `npm run build --workspace packages/app` proves
the `Record<Tab, string>` typing resolves. It does not — Vite builds via esbuild, which transpiles
without typechecking (there is no `typecheck` script in either workspace). The build was run and
passes, but the typing claim was proven separately and genuinely with
`npx tsc --noEmit -p packages/app/tsconfig.json`, which exits clean. Worth carrying forward: any
future plan asserting "the build proves the types" in this repo needs the explicit `tsc` step.

## Verification Results

| Check | Result |
|-------|--------|
| `npm test` (full suite) | **126 files / 972 tests passed**, 0 failed (baseline 125/954 → +1 file, +18 tests) |
| `npx tsc --noEmit -p packages/app/tsconfig.json` | clean |
| `npm run build --workspace packages/app` | succeeds (PWA precache 40 entries) |
| `git diff packages/app/src/sync/presenceActivity.ts` | comment-only — zero non-comment diff lines |
| `grep -c 'import { config }\|from "../config' .../presenceActivity.ts` | `0` — module stays pure |
| `git diff packages/app/test/sync/presenceActivity.test.ts` | empty — allow-list tests unedited |
| `grep '"LiveGizz"\|"GizzMap"\|"GizzDex"\|"GizzGames"' BottomTabBar.tsx` | `0` matches |
| `grep -n 'sectionHeading' config.ts` | still `"GizzGames"` (line 1231) |
| `grep -n 'activity\.tab' FriendRow.tsx` | only the `config.copy.presence.activity[activity.tab]` index + one doc comment |

## Success Criteria

- [x] Bottom tabs read Live · GizzVerse · Map · Me · Games, sourced from `config.copy`
- [x] Presence renders a distinct second voice ("on GizzDex") off the same frozen token
- [x] An online friend with unresolvable activity reads "in the app" — never blank, never a raw token
- [x] `ROUTES`, `ROUTE_TO_TAB`, the `Tab` union, `TABS` and `config.DB_NAME` provably unchanged
- [x] The Me tab is a rename only — `DexView`'s contents and order provably unchanged (D-44)

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access or schema surface was introduced; the one
security-relevant control in scope (`reduceActivity`'s `TABS` allow-list) is byte-identical, and
zero packages were added, removed or upgraded (`package.json` untouched).

## Follow-ups for Later Plans

- **D-42 remains open and is not satisfiable by this plan.** NAV-03's two-direction correctness
  needs the old-build/new-build device UAT over the HTTPS tunnel (serve pre-rename to one device,
  post-rename to the other, check the activity label in **both** directions). The unit tests prove
  the forward direction only; this repo has learned twice (quicks `260724-hqu` / `260724-lgo`) that
  a unit-proven Realtime path is not a verified one.
- Plan 21-07 owns the `<nav>` height/padding on `BottomTabBar` — deliberately untouched here.

## Self-Check: PASSED

- `packages/app/test/presenceLabels.test.ts` — FOUND
- `packages/app/src/config.ts` — FOUND (contains `activityUnknown`)
- `packages/app/src/components/BottomTabBar.tsx` — FOUND (contains `config.copy.tabs`)
- `packages/app/src/dex/FriendRow.tsx` — FOUND (contains `config.copy.presence.activity`)
- Commit `1cc5787` — FOUND
- Commit `63a2b1b` — FOUND
- Commit `c48651c` — FOUND
