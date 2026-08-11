---
phase: quick-260811-pxg
plan: 01
subsystem: app-copy
tags: [copy, rebrand, nav-02, regression-guard]
requires: []
provides:
  - config.copy.appName (app)
  - config.appName (core)
  - rebrand.test.ts two-tree single-owner source guard
affects:
  - packages/app/src/config.ts
  - packages/app/src/components/AppMenu.tsx
  - packages/app/src/components/AppShell.tsx
  - packages/app/src/auth/SignInScreen.tsx
  - packages/core/src/config.ts
  - packages/core/src/data-safety/merge.ts
tech-stack:
  added: []
  patterns:
    - "module-private const above the `as const` config literal, surfaced as a copy key"
    - "comment-stripped source scan across BOTH package src trees, package-prefixed keys, with an anti-vacuity half (bottomOverlayInset idiom)"
key-files:
  created: []
  modified:
    - packages/app/src/config.ts
    - packages/app/src/components/AppMenu.tsx
    - packages/app/src/components/AppShell.tsx
    - packages/app/src/auth/SignInScreen.tsx
    - packages/core/src/config.ts
    - packages/core/src/data-safety/merge.ts
    - packages/app/test/rebrand.test.ts
    - .planning/todos/done/2026-08-10-app-name-still-says-guezzer-on-user-facing-surfaces.md
decisions:
  - "D-1: APP_NAME is module-private, read as config.copy.appName — a member of the `as const` literal cannot reference a sibling, so the const lives above it"
  - "D-3: storageNotProtected reworded to 'Your device may clear your Gizz With Friends data.' — a mechanical swap produced a possessive on a three-word name"
  - "D-4: the two already-correct component literals were routed too; without them the single-owner assertion would be false"
  - "D-5 (post-gap): core owns a SECOND copy of the literal rather than importing app's. D-39 pins app's config as a leaf module, so copy cannot cross the core/app seam. Two owners, one per package, asserted as exactly two."
metrics:
  duration: ~15min
  completed: 2026-08-11
---

# Quick Task 260811-pxg: Route the app name through one owner — Summary

Replaced fifteen scattered app-name literals with one module-private `APP_NAME` const exposed as
`config.copy.appName`, fixing the six user-facing strings that still read the pre-rebrand name, and
added a source-scan guard — proven discriminating by probe — that makes re-introducing a hard-coded
app name anywhere under `packages/app/src` unmergeable.

## What Shipped

**Task 1 — `config.ts` gets one owner (`4781203`).** `const APP_NAME = "Gizz With Friends";` now
sits above the `export const config = {` literal, with a doc comment that states the ownership rule
and warns that `DB_NAME` and the Dexie class must never follow it. It is surfaced as the first key
in `copy` (`appName: APP_NAME`) and deliberately not exported — `config.ts`'s own header already says
no other file under `src/` should hardcode a copy string, so components read `config.copy.appName`
like every other copy consumer.

All fifteen name-bearing strings now interpolate it: the six that said the wrong name
(`show.modelLoadFailureBody`, `settings.importErrorHeading`, `settings.storageNotProtected`,
`map.loadFailureBody`, `schedule.loadFailureBody`, `explore.errorBody`) **and** the nine that already
said the right one. Folding in the already-correct nine is what makes "single owner" a true claim
rather than a slogan — a correct-but-independent literal is the same defect class, one coin-flip away
from drifting. Em dashes and typographic apostrophes were preserved byte-for-byte;
`share.card.wordmark` became a bare `APP_NAME` reference since it is the whole name and nothing else.

**Task 2 — three component literals routed (`afc493c`).** `AppMenu.tsx:59` was the headline defect:
the bare text `Guezzer` as the first line of a sheet the user opens deliberately. `AppShell.tsx:162`
and `SignInScreen.tsx:128` already read correctly and were routed for single-ownership. All three are
pure text-node swaps — no markup, className or comment changes — and all three already imported
`config`, so no imports were added. `SignInScreen` destructures `const copy = config.copy.auth`, so
it writes `{config.copy.appName}` (not `{copy.appName}`); no `appName` key was added to the `auth`
block, which would have recreated the duplication this task exists to delete.

**Task 3 — the guard (`94897c0`).** A third `describe` block in the existing `test/rebrand.test.ts`
(test-file count stays 140). `scanSrc(token)` walks comment-stripped `src/` — the helpers copied
verbatim from `bottomOverlayInset.test.tsx` per the repo's established copy-with-attribution idiom —
and returns per-file occurrence counts. Four assertions:

1. **Anti-vacuity, first.** >100 files walked; the walk reached all five files the other assertions
   name; and `scanSrc("Guezzer").hits.get("db/db.ts") >= 2`, which proves the token **matcher** fires
   rather than merely that files were read. A file count alone cannot catch a matcher that never
   matches.
2. **The old name survives only in `db/db.ts`** — commented with the NAV-02 reason the exemption
   exists, so a future reader cannot mistake it for an oversight to "finish".
3. **The brand literal appears in exactly one file, exactly once** — the `APP_NAME` declaration. This
   is the root-cause guard.
4. **The owner is wired to the surfaces** — `config.copy.appName === BRAND`, and all three components
   contain `config.copy.appName`. Assertion 3 alone would be satisfied by deleting the text nodes
   entirely; only this one proves the surfaces still render the name.

Comment stripping is what keeps the four prose mentions (`shareCard.ts`, `importPicker.ts`,
`config.ts`'s share-card colour note, `InstallSection.tsx`) and the new `APP_NAME` doc comment
invisible to the scan.

**Gap found after the first three commits — two user-facing strings in `packages/core` (`cf4934e`).**
The coordinator found them in the **built bundle**, not by reading source:
`grep -a "Guezzer" packages/app/dist/assets/index-*.js`. Both live in
`packages/core/src/data-safety/merge.ts` and are rendered to users —
`classifyImport` → `SettingsView.tsx:165` `setImportResult({ ok: false, error: result.error })` →
rendered at `SettingsView.tsx:291`:

- `merge.ts:96` — `"That file isn't a recognized Guezzer backup."`
- `merge.ts:108` — `"That backup was made by a newer version of Guezzer — update the app first."`

**Why the plan's core-exclusion was incomplete.** The `<do_not_touch>` table scoped
`packages/core` out on the strength of its ONE known mention, `core/src/config.ts:31`'s `userAgent`.
That call was correct on its own terms — it is an HTTP identity for the volunteer-run kglw.net API
(API etiquette), it is not UI, and `core/test/fetch.test.ts:67` pins it verbatim. The error was the
step before it: the plan reasoned about the mention it had found and concluded core was out of
scope, rather than asking whether core holds user-facing copy **at all**. Core is architecturally
pure of React and the DOM, which makes "core has no UI" an easy and wrong inference — purity of
*rendering* is not absence of *copy*. Core returns strings; the app renders them.

**Two independent reasons a source grep never surfaced this:**

1. **Scope.** The plan's own verification command was
   `grep -rn "Guezzer" packages/app/src` — core was not in the scan root, and neither was the
   guard's.
2. **A literal NUL byte.** `merge.ts:66` builds a composite key as
   `` `${e.sessionId}\x00${e.position}` `` with a real NUL in the source, not a `\0` escape. `grep`
   therefore classifies the file as binary and prints `Binary file … matches` instead of the
   matching lines — **silently omitting them from any `grep -rn` sweep** unless `-a` is passed. This
   was reproduced during the fix: `grep -rn` shows nothing usable, `grep -arn` shows both strings.

The second reason is the more durable lesson, and it is now recorded in the guard's own doc comment:
a `readFileSync`-based source scan has no binary heuristic and cannot be fooled the way grep was.
The guard is strictly stronger than the command that missed the bug. **The NUL byte itself was left
alone** — it is a working key delimiter inside merge-identity derivation, unrelated to this task,
and changing it risks the union-merge for zero user-visible gain.

**The fix.** `packages/core/src/config.ts` gained its own module-private `APP_NAME`, exposed as
`config.appName`; `merge.ts` interpolates it in both strings. Core holds a **second** copy of the
literal deliberately: `packages/app/src/config.ts:13` records **D-39** — app config "stays a leaf
module with no runtime dependency", type-only imports throughout — so importing a value across the
core/app seam to collapse the two owners into one would break the decision the leaf rule exists to
hold. Two owners, one per package, is the correct answer; the guard now asserts *exactly* that pair
so it cannot quietly become three. `userAgent` was left byte-identical. The em dash and the NUL
delimiter were preserved byte-for-byte (edits applied at the byte level, verified before and after).

The guard now walks both trees with package-prefixed keys (`app/…`, `core/…` — both packages have a
`config.ts`, so bare keys would collide), allows the old name only in `app/db/db.ts` (Dexie identity)
and `core/config.ts` (`userAgent`), and its anti-vacuity half additionally proves the **core** walk
reached `core/data-safety/merge.ts` and that the matcher fires inside the core tree.

## The Discriminating-Guard Check

**The guard was proven to fail, not assumed to pass.** Two temporary probes, each reverted with
`git checkout -- <file>` immediately after:

| Probe | Injected | Result |
|---|---|---|
| A | reverted `AppMenu.tsx`'s `{config.copy.appName}` back to the bare text `Guezzer` | **2 failed / 14 passed** — tripped assertion 2 (`['components/AppMenu.tsx', 'db/db.ts']` vs `['db/db.ts']`) and assertion 4 (the wiring check) |
| B | added `const PROBE = "Gizz With Friends";` to `AppShell.tsx` | **1 failed / 15 passed** — tripped assertion 3 exactly: `['components/AppShell.tsx', 'config.ts']` vs `['config.ts']` |

After the core gap was closed, the EXTENDED guard was re-proven the same way — an app-only proof
says nothing about whether the core half of the walk is live:

| Probe | Injected | Result |
|---|---|---|
| C | `merge.ts`'s first rejection reverted to the hard-coded old name | **2 failed / 14 passed** — assertion 2 (`['app/db/db.ts', …(2)]` vs `['app/db/db.ts','core/config.ts']`) and assertion 4 (`expected 1 to be 2` `${config.appName}` interpolations) |
| D | `merge.ts`'s first rejection hard-coded to the brand literal | **2 failed / 14 passed** — assertion 3 (`['app/config.ts', …(2)]` vs the two-owner pair) and assertion 4 |
| E | the `core` tree misrouted from `core/src` to `core/test` | **4 failed / 12 passed** — the anti-vacuity assertion fired first: `expected [ 'app/App.tsx', …(208) ] to include 'core/config.ts'` |

Probe E is the one that matters most: it proves the **core-reach** half of the anti-vacuity check is
load-bearing. A core walk pointed at the wrong directory would otherwise leave assertions 2 and 3
green-by-emptiness — the precise failure mode that let these two strings ship in the first place.

All five probes were reverted with `git checkout -- <file>`, and the working tree was confirmed
probe-free before the gates were run.

**Process note learned the hard way:** probe C was first run against *uncommitted* work, and the
`git checkout --` revert destroyed the fix along with the probe. Probes must be run against a
committed baseline. The core fix was committed (`cf4934e`) before probes C–E.

## Verification

| Gate | Result |
|---|---|
| `npx vitest run` | **140 test files / 1231 tests, 0 failures** (baseline 140/1227; +4 = the four new `it` blocks, exactly as planned — the core fix extended the existing four rather than adding more) |
| `npx tsc -b packages/core packages/app` | **exit 0** |
| `grep -c '${APP_NAME}' config.ts` | 14 |
| `grep -c 'wordmark: APP_NAME'` / `'appName: APP_NAME'` / `'Guezzer'` in app config.ts | 1 / 1 / **0** |
| `grep -rn "Guezzer" packages/app/src --include=*.ts --include=*.tsx` | exactly the four expected: `db/db.ts:324`, `db/db.ts:462`, `shareCard.ts:133`, `importPicker.ts:30` |
| `grep -arn "Guezzer" packages/core/src --include=*.ts` (note `-a`) | exactly one: `config.ts:55` `userAgent`, unchanged |
| `grep -arn "Gizz With Friends"` over both trees | two declarations (`app/src/config.ts:32`, `core/src/config.ts:27`) plus three comment-only mentions |

`config.DB_NAME` is still `"guezzer"` and `GuezzerDB` is unrenamed — both shipped
`expect(config.DB_NAME).toBe("guezzer")` assertions stand untouched (T-PXG-01 mitigated three ways:
the do-not-touch list, those two assertions, and the guard's explicit `db/db.ts` allow-list).

## Deviations from Plan

**One substantive addition, found post-hoc by the coordinator:** the plan's `packages/core`
exclusion was incomplete and two rendered strings survived it. Fixed in `cf4934e` — see "Gap found
after the first three commits" above for how it was found (built-bundle grep, not source reading),
why the plan's reasoning missed it, and the NUL-byte mechanism that made `grep -rn` lie. The plan's
one explicit core decision (`userAgent` stays) was correct and was honoured.

Two procedural notes:

1. **Build and preview were deliberately not run.** Task 3's action text describes
   `npm run build` plus a fresh-port preview on 4179; the orchestrator owns the build and the
   fresh-port preview for this task and instructed the executor to stop after the gates. The
   CLAUDE.md fresh-build-fresh-port convention still applies — it is being honoured one level up,
   not skipped.
2. **The todo move landed in its own commit** (`8a0c45f`) rather than riding a code commit, so the
   code changes stay independently revertible.

Everything in the `<do_not_touch>` table was left alone: `db/db.ts`, `config.DB_NAME`,
`vite.config.ts`'s manifest block, `index.html`'s `<title>`, `packages/core`'s `userAgent`, and the
three comment-only mentions.

## Follow-ups

None. The todo is closed and moved to `.planning/todos/done/` with a resolution note naming this
quick task and its commits.

## Commits

| Commit | Scope |
|---|---|
| `4781203` | `refactor` — `APP_NAME` const + fifteen config strings routed through it |
| `afc493c` | `fix` — the three component literals read `config.copy.appName` |
| `94897c0` | `test` — the single-owner source-scan guard |
| `8a0c45f` | `docs` — todo moved to `done/` with a resolution note |
| `cf4934e` | `fix` — core's two user-facing strings routed through a core owner; guard extended to both src trees |

## Self-Check: PASSED

- `packages/app/src/config.ts` — FOUND
- `packages/app/src/components/AppMenu.tsx` — FOUND
- `packages/app/src/components/AppShell.tsx` — FOUND
- `packages/app/src/auth/SignInScreen.tsx` — FOUND
- `packages/core/src/config.ts` — FOUND
- `packages/core/src/data-safety/merge.ts` — FOUND (NUL delimiter intact: 1 before, 1 after)
- `packages/app/test/rebrand.test.ts` — FOUND
- `.planning/todos/done/2026-08-10-app-name-still-says-guezzer-on-user-facing-surfaces.md` — FOUND
- `.planning/todos/pending/2026-08-10-...` — correctly ABSENT (moved)
- Commits `4781203`, `afc493c`, `94897c0`, `8a0c45f`, `cf4934e` — all FOUND in `git log`
