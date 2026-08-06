---
phase: 22-surface-motion-the-chrome-mechanism
plan: 09
subsystem: pwa-install
tags: [pwa, meta-tags, ios, standalone, device-uat, revert-procedure, SHEET-02, NAV-06, D-18]

# Dependency graph
requires:
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 02
    provides: "the single `feat(22-02):` exit commit `53d6e59` — the unit revert procedure 1 step (a) reverts, and the `d976ca0` Task-1 commit that must NOT be reverted with it"
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 04
    provides: "`DexView`'s prop-driven fullscreen trophy case (UAT test 1a's only exit-animating fullscreen exemplar) and the `dexView.test.tsx` exit-window block — revert step (b)"
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 10
    provides: "`TrailNodeSheet` / `WhyDetail` prop-driven bottom sheets and the two identically-named exit-window blocks — revert step (c)"
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 06
    provides: "the relocated `#install` Settings section + the one neutral AppMenu row — the surface UAT test 4 (NAV-06) exercises"
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 07
    provides: "`ChromeToggle` and its safety escapes — the surface UAT tests 0 and 5 grade for safe-area containment"
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 08
    provides: "ordered bottom-overlay stacking — the behaviour UAT test 6's toast rider observes at the collapsed position"
  - phase: 21-layout-layering-foundations
    provides: "the `?layoutProbe=1` harness (`sab` / `sat` / `standalone` / `innerH`) that gates every graded result"
provides:
  - "`apple-mobile-web-app-capable` + `mobile-web-app-capable` in `packages/app/index.html`, in a ONE-FILE commit (`04b3bc1`) that can be reverted in isolation"
  - "`22-HUMAN-UAT.md` — the numbered device script, tests 0–6, in the Phase-10 VALID-02 format"
  - "the phase's two revert procedures, both naming real SHAs, with procedure 1 DRY-RUN VERIFIED green"
affects: [phase-22-verification-gate, phase-23-overlays]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a behaviour-changing HTML-shell tag lands ALONE, so the device capture that grades it has a one-commit answer"
    - "a revert procedure is only real once it has been executed on a scratch branch and its exit codes recorded"
    - "name out-of-commit test artifacts by exact `describe` title — `git revert` cannot reach them, and a stale assertion reds the suite for the wrong reason"

key-files:
  created:
    - .planning/phases/22-surface-motion-the-chrome-mechanism/22-HUMAN-UAT.md
  modified:
    - packages/app/index.html

key-decisions:
  - "`requirements-completed: []` — SHEET-02 and NAV-06 both have UNRUN device halves. This plan authored the script; it did not execute it. Marking either would be a false green, consistent with 22-02/22-04/22-10 all declining."
  - "Revert procedure 1 deliberately does NOT revert the three prop-driven source conversions, per 22-04's and 22-10's arguments — a prop-driven `<Sheet>` is correct under the enter-only ship too, and `DexView`'s `key={openShow.showId}` is CR-02's, not motion's."
  - "The dry-run's -18 test delta was reconciled term by term rather than accepted as 'about right'."
  - "The plan's `lint clean` gate is NOT RUNNABLE in this repo — no eslint config, no lint script, no lint package. Recorded as an honest gap rather than reported as a pass."

requirements-completed: []

# Metrics
duration: 18min
completed: 2026-08-06
---

# Phase 22 Plan 09: Device Items & the Revert Procedures Summary

**The two capability meta tags landed in a one-file commit that can be reverted in isolation, and `22-HUMAN-UAT.md` now carries a seven-test device script whose install-mode proof gates every later result — plus both revert procedures, the three-step one proven green on a scratch branch rather than asserted.**

## Performance

- **Duration:** ~18 min
- **Base:** `1ca0bfa`
- **Tasks:** 3 (landing as 3 commits)
- **Files:** 2 (1 created, 1 modified) — exactly the plan's declared `files_modified`

## Task Commits

1. **Task 1: the two capability meta tags, alone** — `04b3bc1` (feat)
2. **Task 2: `22-HUMAN-UAT.md`, the numbered device script** — `e2911a2` (docs)
3. **Task 3: both revert procedures, dry-run verified** — `e271ea0` (docs)

`git show --stat 04b3bc1` lists **exactly one file**: `packages/app/index.html`. That isolation is the entire point of the commit.

## Accomplishments

- **The meta-tag commit is revertible in isolation, and its comment says why it is not a tidy-up.** `22-RESEARCH` §Pitfall 13(b) upgrades `apple-mobile-web-app-capable` to a HIGH-confidence behaviour change: Apple's reference states the already-shipped `apple-mobile-web-app-status-bar-style="black-translucent"` has **no effect until `capable` is present**, and `black-translucent` puts web content under the status bar. That is exactly the geometry CHROME-03 and D-13 depend on, in a project bitten by top-inset math twice. The HTML comment records the deprecation, the manifest-owns-launch-mode fact, the `black-translucent` interaction and the device gate — so a future reader cannot mistake it for cosmetics.
- **The device script gates itself.** Test 0 proves install mode before anything is graded, names the bookmark trap and the `sab: 0` tell, and — the part that is easy to get wrong — states that **`sab` is the iOS tell and NOT the Android one**, so Android install-mode is graded on `matchMedia("(display-mode: standalone)")` plus `beforeinstallprompt` having fired at all.
- **The sample is chosen by prop shape and is honest about what can even exit-animate.** Test 1's `initialFocusRef` exemplar is `SettingsView`'s name prompt and the file says explicitly **not `PinSheet`**, with the reason (`PinSheet` is unmount-driven, so it cannot exercise the close-start half at all). Test 1(a) names the GizzDex trophy case as the only fullscreen consumer that can exit-animate and notes `CompareView`/`FriendDetail` stay unmount-driven **by design**.
- **Revert procedure 1 is a fact, not a claim.** Executed end to end on a scratch branch: `git revert 53d6e59` plus the two describe-block deletions → `npx vitest run` **EXIT 0** (139 files / 1196 tests), `npx tsc -b packages/core packages/app` **EXIT 0**. The scratch branch was then deleted.
- **The test delta reconciles exactly.** 140 files / 1214 tests → 139 / 1196 is −1 file and −18 tests: `sheet.closeStart` 5 + `sheet.motion` exit 5 + `dexView` 2 + `trailNodeSheet` 3 + `songRow` 3 = **18**. Nothing unaccounted for.
- **Phase gate green and unchanged from base.** `npx vitest run` → **140 files / 1214 tests passed**, `npx tsc -b packages/core packages/app` → exit 0. Identical to the base commit, as it must be — this plan changed one HTML file and one markdown file.

## Files Created/Modified

- **`packages/app/index.html`** — the two capability tags beside the shipped `apple-mobile-web-app-status-bar-style`, under a 19-line comment recording (1) that the Apple tag is deprecated and the manifest's `display: "standalone"` is what drives launch mode, so the tag's live effect here is the **status-bar style**; (2) that `black-translucent` has no effect without it and displays content partially obscured by the status bar — the CHROME-03 / D-13 geometry, verified on device before it is trusted; (3) that `mobile-web-app-capable` is there purely to silence Chromium's deprecation warning.
- **`.planning/phases/22-surface-motion-the-chrome-mechanism/22-HUMAN-UAT.md`** — **new**, 401 lines. Frontmatter `status: pending`, a device/OS/build-SHA header block, the cloudflared harness recipe, tests 0–6 each with Steps / Expected / a blank **Result: PASS / FAIL** line, a Summary block, the Revert procedures section, and a Gaps section.

## The revert procedures, as recorded

### Procedure 1 — the enter-only fallback (three steps)

| Step | Action | Artifact |
|---|---|---|
| (a) | `git revert --no-edit 53d6e59` | carries `Sheet.tsx`, `sheet.motion.test.tsx`, `sheet.closeStart.test.tsx` |
| (b) | delete `describe("fullscreen sheet exit window (reverts with the 22-02 exit commit)", …)` | `packages/app/test/dexView.test.tsx` (22-04) |
| (c) | delete `describe("bottom-sheet exit window (reverts with the 22-02 exit commit)", …)` | `packages/app/test/trailNodeSheet.test.tsx` **and** `packages/app/test/songRow.test.tsx` (22-10) |

**Deliberately NOT reverted**, and the file says so:

- **`d976ca0`** (22-02 Task 1 — the `useFocusTrap` split + enter-END `initialFocusRef` wiring). Verified in the dry-run: `sheet.a11y.test.tsx` stays green (16 tests) after step (a).
- **The three prop-driven source conversions** (`DexView`, `TrailNodeSheet`, `WhyDetail`). Both 22-04 and 22-10 argued this and both are right: `open={payload != null}` simply removes the node synchronously once the exit is gone — exactly the pre-conversion behaviour. Reverting them is churn that would additionally re-break `Sheet.tsx`'s seam roster and require unpicking `dexView.test.tsx`'s `FriendsList` stub.
- **`DexView`'s `key={openShow.showId}`** — CR-02's, not motion's. Deleting it reintroduces a stale-pending window with a fully green suite.

The section states plainly that the result is an **enter-only** build, cites **ROADMAP success criterion 2** ("Enter-only animation is an explicitly acceptable degraded ship if the exit cannot meet that bar") and SHEET-02 as sanctioning it, and records that there is **no runtime kill-switch and no feature flag** (D-18).

### Procedure 2 — the meta tag

`git revert --no-edit 04b3bc1`. One file. The manifest's `display: standalone` is what makes iOS launch standalone, so the cost is only the iOS startup-image nicety — not standalone launch, and not NAV-06.

## Decisions Made

- **`requirements-completed: []`.** SHEET-02's and NAV-06's device halves are **authored but unrun**. This plan produced the instrument, not the evidence. Marking either complete would be exactly the false green that 22-02, 22-04 and 22-10 each declined to write.
- **NAV-05 is also not checked off here.** Plan 22-06 shipped the relocation; its on-device confirmation rides in UAT test 4 alongside NAV-06. The orchestrator owns `REQUIREMENTS.md` and the end-of-phase gate owns the grading.
- **The leftover-import question was answered empirically rather than hedged.** 22-10's summary said "plus the import additions if lint complains". Measured: after steps (b)+(c), `waitForElementToBeRemoved` is unused in **all three** files and `within` is unused in `trailNodeSheet.test.tsx` **only** (still used in the other two). `noUnusedLocals` is set in **no** tsconfig here and there is no linter, so leaving them is harmless — the procedure says so, which is what keeps it a two-minute decision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 – Blocking] `npx tsc -b` is vacuous in this repo — with a CORRECTION to the inherited finding**

- **Found during:** every typecheck gate (carried from plans 22-01, 22-02, 22-04, 22-06, 22-07, 22-08, 22-10).
- **Issue:** there is no root `tsconfig.json` (only `tsconfig.base.json` + per-package configs), so the plan's literal `npx tsc -b` gate does not typecheck this repo.
- **Correction worth recording:** every prior plan states the bare command "prints `TS5083` and **still exits 0**". Measured here, it prints `TS5083` and **exits 1**. The conclusion is unchanged — the bare form is the wrong gate either way — but the inherited claim that it silently passes is not true at this toolchain version, and a future reader relying on "it exits 0" to explain a green CI would be chasing a ghost.
- **Fix:** ran `npx tsc -b packages/core packages/app` at every gate — exit 0, no output, every time.
- **Files modified:** none (verification-only)

**2. [Rule 3 – Blocking] The plan's `lint clean` gate is NOT RUNNABLE — no lint toolchain exists**

- **Found during:** Task 3's phase gate.
- **Issue:** Task 3 requires "lint clean" as one of four gate results. There is **no** `eslint.config.*` and no `.eslintrc*` anywhere in the repo, **no** `lint` script in the root or in either workspace package, and **no** lint package in the root dependency set — despite `CLAUDE.md`'s tech-stack table recommending ESLint 10 + typescript-eslint 8.63. The gate has nothing to run.
- **Fix:** recorded as an honest gap rather than reported as a vacuous pass. The other three gates (vitest, tsc, the `git log` extract) all ran for real. **No lint toolchain was installed** — that is a repo-wide tooling decision well outside this plan's two-file scope, and installing packages is explicitly excluded from auto-fix.
- **Files modified:** none (verification-only)

### Disclosure, not a change

**3. The `?layoutProbe=1` top-inset row is labelled `sat`, not "top inset"**

The plan's Task 2 asks test 0 to record "the top inset". The shipped probe emits it as a row literally labelled **`sat`** (alongside `sab`/`sal`/`sar`), so the UAT names `sat` explicitly rather than sending a tester hunting for a differently-named row at 1am on a device night. Same value, real label.

---

**Total deviations:** 3 (2 Rule-3 blocking, 1 disclosure)
**Impact on plan:** No scope change. No file outside the declared `files_modified` was touched, no dependency added, no behaviour beyond the `<action>` text implemented.

## Verification

| Gate | Result |
|---|---|
| `npx vitest run` | **140 files / 1214 tests passed** (base `1ca0bfa`: 140 / 1214 — unchanged, as expected) |
| `npx tsc -b packages/core packages/app` | exit 0, no output |
| lint | **not runnable — no lint toolchain in this repo** (see deviation 2) |
| `git show --stat 04b3bc1` | exactly 1 file: `packages/app/index.html` |
| `git show --stat 53d6e59` | exactly 3 files — the revert unit is intact |
| `npm run build --workspace @guezzer/app` | exit 0; both tags asserted present in `dist/index.html` |
| UAT automated check | `7 tests`, all six required keys present |
| `git diff --diff-filter=D --name-only 1ca0bfa..HEAD` | empty (no deletions) |

### The three-step revert dry-run, as executed

```
git checkout -b scratch-22-09-revert-dryrun
git revert --no-edit 53d6e59        →  3 files changed, 15 insertions(+), 429 deletions(-)
                                       delete mode packages/app/test/sheet.closeStart.test.tsx
steps (b) + (c)                     →  3 files changed, 248 deletions(-)
npx vitest run                      →  EXIT 0   (139 files / 1196 tests passed)
npx tsc -b packages/core packages/app  →  EXIT 0   (no output)
git checkout worktree-agent-…; git branch -D scratch-22-09-revert-dryrun
```

Observed, all as predicted:

- Step (a) **auto-merged `Sheet.tsx` with no conflict**, despite plan 22-10 having edited that same file's module doc afterwards.
- `sheet.closeStart.test.tsx` was deleted by the revert.
- `sheet.a11y.test.tsx` — untouched, **still green (16 tests)**: Task 1's enter-END wiring lives in `d976ca0` and survives.
- All three exit-window `describe` blocks run to the end of their file, so each deletion is a clean truncation.
- After cleanup, `grep` finds all three blocks restored on the real branch and `git status` is clean.

## Todos this phase resolves (for the orchestrator to move at phase close)

Not moved by this agent — `.planning/todos/` is a shared path and this plan ran as a worktree agent.

| Todo | Closed by |
|---|---|
| `2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md` | its **animation** half — plans 22-01/22-02/22-04/22-10 (the layering half already shipped as Phase-21 FOUND-03) |
| `2026-08-05-setlistview-loading-state-is-an-unrecoverable-aria-modal-trap.md` | plan 22-04 (CR-02) |
| `2026-07-24-simultaneous-bottom-overlay-stacking.md` | **plan 22-08** (CR-01) |
| `2026-08-05-add-apple-mobile-web-app-capable-so-ios-installs-are-determi.md` | **this plan**, Task 1 (`04b3bc1`) — its own verification step ("delete the icon, re-add from a cold tunnel URL, confirm `?layoutProbe=1` reports `sab: 34` and `standalone: nav=true mq=true`") is now UAT test 0 |

### Follow-on deliberately deferred (file it, do not do it)

**Hoist `env(safe-area-inset-top)` into a `--gz-safe-top` custom property on `:root`**, mirroring the shipped `--gz-safe-bottom`. Recorded as out of scope in plan 22-05 and re-flagged by 22-07. It touches **ten surfaces including five device-verified sheets**, and it would additionally retire 22-07's `calc()`-normalization workaround and its deviation-2 source-read case. Not a Phase-22 action.

## Issues Encountered

- **The inherited "bare `tsc -b` exits 0" claim is wrong at this toolchain version** (deviation 1). It has been repeated verbatim through six plan summaries. The substitution it motivates is still correct; the stated mechanism is not.
- **The repo has no linter at all**, which no prior plan surfaced because no prior plan's verification block listed lint as a gate. Worth a decision at some point — `CLAUDE.md` documents a lint toolchain that does not exist in the tree.
- **The worktree spawned at a stale ancestor** (`e847183`, 6 commits behind) and required the sanctioned `git reset --hard 1ca0bfa` before any work. All six dependency summaries were verified present afterwards, per the dependency check. This is now the third consecutive plan to hit it.

## Known Stubs

None in `src/`. The two meta tags are live configuration read by the platform, not placeholders.

`22-HUMAN-UAT.md` ships with **empty Result lines and an empty device/build header** — that is the document's designed state (`status: pending`), not a stub: it is an instrument to be filled in at the end-of-phase verification gate, exactly as `10-HUMAN-UAT.md` was.

## Threat Flags

None. No network call, no persistence, no user-supplied data path, no dependency, no new endpoint or auth path. The register behaves as predicted:

- **T-22-31** (`capable` activating `black-translucent` and pushing content under the status bar) — **mitigated**: own atomic commit, gated on the before/after `?layoutProbe=1` capture in test 0, with a named single-commit revert (procedure 2). It alters no CSP, no service-worker scope and no `start_url` — verified, the commit touches one file and adds only two `<meta>` tags plus a comment.
- **T-22-32** (a bookmark launch graded as a real install) — **mitigated**: test 0 gates every later test and names both platform tells separately, with the Phase-21 session loss stated in the test body so the reason survives.
- **T-22-33** (shipping an exit whose close-start contract fails on real VoiceOver) — **mitigated**: tests 1 and 2 are marked blocking, and the fallback is **dry-run green**, not asserted. No feature flag exists to rot (D-18).
- **T-22-34** (the cloudflared tunnel exposing a local build) — **accept**, unchanged: ephemeral, static-only, torn down at session end; the harness section says so.
- **T-22-SC** (package installs) — **no packages installed.** `cloudflared` is invoked by full path from an existing install, never fetched. The one place this plan could have been tempted — deviation 2's missing linter — was deliberately left uninstalled.

## User Setup Required

**Yes — this plan's deliverable is a device session that only the owner can run.**

Before the session: rebuild and reinstall. `04b3bc1` changes the built HTML shell, so any tester on an old home-screen icon is testing the old shell and test 0's "after" reading is meaningless.

Required hardware, none of which has a fallback: an **iPhone with VoiceOver and an external keyboard** (SHEET-02) and a **real Android device with Chrome** (NAV-06 — `beforeinstallprompt` fires nowhere else).

## Next Phase Readiness

- **The phase's verification gate is unblocked.** Every automated gate is green and the device script is executable as written; the results go into the Result lines of `22-HUMAN-UAT.md`, not into a new document.
- **SHEET-02 and NAV-06 remain OPEN pending the session**, and a failure of either has a named, pre-verified answer rather than an investigation.
- **NAV-03 stays Phase 21's recorded gap (D-38).** `21-HUMAN-UAT.md` stays `status: partial` — an accepted override, not a pass. This phase does not close it and does not read it as closed; the Gaps section of the new UAT says so explicitly, including the cost that keeps it open (two devices, two different builds, harness base `e92d4a8`).
- **`STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` are untouched by this agent** — the orchestrator owns those writes after the wave completes.

## Self-Check: PASSED

Files verified on disk:
- `packages/app/index.html` — FOUND (contains both capability tags)
- `.planning/phases/22-surface-motion-the-chrome-mechanism/22-HUMAN-UAT.md` — FOUND (401 lines, `status: pending`, 7 tests, Revert procedures + Gaps)
- this SUMMARY — FOUND

Commits verified in `git log 1ca0bfa..HEAD` on `worktree-agent-afc0ce8803967bd76`:
`04b3bc1`, `e2911a2`, `e271ea0`.

SHAs named in the revert procedures, all resolving under `git show`: `53d6e59`, `d976ca0`, `04b3bc1`.

Final gate re-run at close: `npx vitest run` → 140 files / 1214 tests passed; `npx tsc -b packages/core packages/app` → exit 0; `git status --short` → clean, scratch branch deleted.

---
*Phase: 22-surface-motion-the-chrome-mechanism*
*Completed: 2026-08-06*
