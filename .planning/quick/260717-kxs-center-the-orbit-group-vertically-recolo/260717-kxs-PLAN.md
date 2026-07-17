---
phase: quick-260717-kxs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/app/src/show/OrbitStage.tsx
  - packages/app/src/show/CometTrail.tsx
  - packages/app/test/cometTrail.test.tsx
autonomous: true
requirements: [SHOW-01, SHOW-02, SHOW-08]

must_haves:
  truths:
    - "The orbit group (center orb + prediction fan) is visually centered in the stage — no lopsided empty band below it."
    - "The tapped-orb collapse glide still lands the selected orb on the center node (SHOW-02 no-relayout preserved)."
    - "The pre-opener 'Search for the opener' centered prompt stays centered (offset is 0 with no orbs)."
    - "Comet-trail dots are filled with the song's TUNING-FAMILY color, matching the main orbs — not hit-green / miss-red."
    - "A ??? / off-matrix trail entry falls back to the muted neutral (#A1A1AA)."
    - "The FullSetlistSheet row ring also uses the tuning-family color."
    - "Main-view weak-fan (low-confidence) orb dimming is unchanged."
  artifacts:
    - path: "packages/app/src/show/OrbitStage.tsx"
      provides: "translateY wrapper centering the orbit group bbox"
    - path: "packages/app/src/show/CometTrail.tsx"
      provides: "tuning-family colored trail dots + sheet rings"
    - path: "packages/app/test/cometTrail.test.tsx"
      provides: "tuning-color assertions replacing the hit/miss color test"
  key_links:
    - from: "packages/app/src/show/CometTrail.tsx"
      to: "packages/app/src/show/tuningColor.ts"
      via: "tuningColor(family)"
      pattern: "tuningColor\\("
    - from: "packages/app/src/show/CometTrail.tsx"
      to: "packages/app/src/show/matrix.ts"
      via: "getMatrixIndex().nodeById.get(entry.songId)?.tuningFamily"
      pattern: "getMatrixIndex\\(\\)\\.nodeById"
---

<objective>
Two tracking-view (LiveGizz Show) polish fixes, app-layer only:

1. **Vertically center the orbit group.** The radial layout centers the ring geometrically at `cy`, but a 5-orb pentagon puts one vertex up and two at the bottom, so the group's *bounding box* sits ~11px above `cy` → ~23px more empty space below than above. Fix by translating the whole orbit group so its bbox centers in the stage.

2. **Recolor comet-trail history nodes to tuning-family colors.** Replace the hit-green / miss-red dots (and the FullSetlistSheet rings) with the same `tuningColor(family)` used by the main orbs, resolved per entry via the bundled matrix.

Purpose: match the "constellation" visual language across the trail and the fan, and remove the lopsided empty band below the orbit.
Output: edited OrbitStage.tsx, CometTrail.tsx, and rewritten cometTrail color test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# Orbit (Task 1)
@packages/app/src/show/OrbitStage.tsx
@packages/app/src/show/orbitLayout.ts

# Trail (Task 2)
@packages/app/src/show/CometTrail.tsx
@packages/app/src/show/tuningColor.ts
@packages/app/src/show/matrix.ts
@packages/app/test/cometTrail.test.tsx

Scouted facts (do not re-derive):
- `MatrixIndex.nodeById` is `Map<number, MatrixNode>`; `MatrixNode.tuningFamily` is a non-null `TuningFamily` (packages/core/src/domain/types.ts:109).
- `tuningColor(null)` returns the muted fallback `#A1A1AA` and never throws.
- Vitest MUST run from the REPO ROOT (the app's jsdom env + aliases only load via the root `vitest.config.ts` `projects` config). `tsc --noEmit` runs from `packages/app`.
- A dev server is live on http://localhost:5175 for the owner's visual check.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Vertically center the orbit group in OrbitStage</name>
  <files>packages/app/src/show/OrbitStage.tsx</files>
  <action>
Keep orbitLayout.ts PURE and UNCHANGED. Do the centering entirely in OrbitStage.tsx by wrapping BOTH the center-node container AND the mapped orb `motion.div`s in a single positioned wrapper carrying a static `transform: translateY(offset)`.

Compute the offset from `renderLayouts` (the currently-rendered orbs — during a collapse this is the frozen snapshot, so it stays stable within a fan). Define a small helper that, given `renderLayouts`, `renderOrbs`, `cy`, and `config.show.ORB_CENTER_DIAMETER`, returns the vertical offset that centers the orbit group's bounding box on `cy`:
  - For each rendered orb i with a layout, its vertical extent is `[layout.y - d/2, layout.y + d/2]` where `d = layout.diameterPx`.
  - Also include the center node's extent `[cy - ORB_CENTER_DIAMETER/2, cy + ORB_CENTER_DIAMETER/2]` so the group bbox accounts for the center orb (bound groupTop by `cy - ORB_CENTER_DIAMETER/2` and groupBottom by `cy + ORB_CENTER_DIAMETER/2`).
  - `groupTop = min` of all those tops; `groupBottom = max` of all those bottoms.
  - `offset = cy - (groupTop + groupBottom) / 2`.
  - When there are no rendered orbs (pre-opener) OR not yet laid out (`!laidOut`) → offset = 0, so the centered "Search for the opener" prompt stays centered.
This offset is DERIVED, not a config constant — no new magic numbers (honors CLAUDE.md single-config rule).

Wrap the two orbit layers in a NEW `absolute inset-0` div (so the orbs' absolute `left/top` = `layout.x/y - d/2` resolve against it identically to the full stage) with `style={{ transform: offset ? `translateY(${offset}px)` : undefined }}`. The wrapper must contain: (a) the existing `pointer-events-none absolute inset-0 flex items-center justify-center` center-node block, and (b) the `laidOut && renderOrbs.map(...)` orb list.

Apply the transform regardless of `prefers-reduced-motion` (it is a static layout transform, not an animation). It must NOT wrap: the weak-fan hint (`absolute inset-x-0 bottom-2 ...`, bottom-anchored chrome) or the outer `stageRef` div (the ResizeObserver measures the full stage). Because the collapse-glide math targets `cy` via `-dy = cy - layout.y` on the SAME frame that translates, the whole group shifts together and the tapped-orb glide still lands on the center — do not change any `dx/dy`, `initial`, `animate`, or `transition` values.
  </action>
  <verify>
    <automated>cd packages/app && npx tsc --noEmit</automated>
    <human-check>On http://localhost:5175 in Show mode with an opener + fan showing, the orbit group looks vertically centered — the empty space above and below the group is roughly equal (no ~23px extra band below). Tap a prediction orb: it still glides cleanly onto the center.</human-check>
  </verify>
  <done>OrbitStage renders the center node + orbs inside one `absolute inset-0` translateY wrapper; offset centers the group bbox on cy and is 0 pre-opener; orbitLayout.ts is untouched; typecheck passes; collapse glide still lands on center.</done>
</task>

<task type="auto">
  <name>Task 2: Recolor comet-trail nodes to tuning-family colors + update test</name>
  <files>packages/app/src/show/CometTrail.tsx, packages/app/test/cometTrail.test.tsx</files>
  <action>
In CometTrail.tsx, replace hit/miss coloring with tuning-family coloring on BOTH the trail dot and the FullSetlistSheet ring:
  - Import `tuningColor` from `./tuningColor.ts` and `getMatrixIndex, loadMatrix` from `./matrix.ts`.
  - Add a small pure resolver, e.g. `trailColor(entry)`: `const family = entry.songId != null && loadMatrix().ok ? getMatrixIndex().nodeById.get(entry.songId)?.tuningFamily ?? null : null; return tuningColor(family);`. This never throws — a `???` placeholder (songId null) or off-matrix song → null → muted fallback. Guarding on `loadMatrix().ok` avoids `getMatrixIndex()` throwing when the matrix failed to load.
  - Trail dot (~line 176): set `backgroundColor: trailColor(entry)` instead of `RING_COLOR[entry.outcome]`.
  - FullSetlistSheet ring (~line 240): set `borderColor: trailColor(entry)` instead of `RING_COLOR[entry.outcome]`. (Move/share the resolver so the sheet can call it too — a module-level function is simplest since it takes only the entry.)
  - Remove the now-unused `RING_COLOR` map and the `EntryOutcome` import IF it becomes unused after the change (it is only used by RING_COLOR). Update the file's top doc-comment lines that describe "solid hit (green) / miss (red)" to describe tuning-family coloring, so the header prose no longer contradicts the code.
  - Do NOT add any dimming to the trail (trail nodes are already-played history, not live predictions). Do NOT touch PredictionOrb weak-fan dimming.

In packages/app/test/cometTrail.test.tsx, rewrite the color test (`"dot fill derives from entry.outcome — solid hit green / miss red"`, ~line 67) to assert TUNING-family coloring. jsdom loads the REAL bundled matrix via `loadMatrix()`:
  - The `entry()` fixture currently uses `songId: 100 + position`, which is off-matrix → all fallback. For the color test, use songIds that EXIST in the bundled matrix (read the matrix index in the test) so at least one dot gets a real family color. Import `getMatrixIndex, loadMatrix` from `../src/show/matrix.ts` and `tuningColor` from `../src/show/tuningColor.ts`.
  - Prefer asserting against the EXPRESSION rather than a hardcoded hex to stay robust: for a real songId `id`, expected dot bg = `tuningColor(getMatrixIndex().nodeById.get(id)?.tuningFamily ?? null)`; normalize via the existing `bgColor()` helper (jsdom may emit `rgb()` — compare both forms, or normalize the expected hex through the same path the test already uses for HIT/MISS).
  - Also assert a `???`/null-songId (or clearly off-matrix songId) entry gets the muted fallback `#A1A1AA` (rgb(161,161,170)).
  - Remove the now-stale `HIT_FORMS` / `MISS_FORMS` constants and any `EntryOutcome`-only imports if this test file no longer needs them (other tests pass `outcome` into the fixture — keep the fixture's `outcome` param since `TrackedEntry` still requires the field; just don't assert on hit/miss color).
  - The other cometTrail tests (node COUNT, +N compression, diminishing size, fit-to-width) are color-agnostic — do not change their assertions; they must stay green. Note: to make a real-family songId visible, you may need to pick songIds that exist in the matrix for the color test's two entries only, without disturbing the count-based tests.
  </action>
  <verify>
    <automated>cd packages/app && npx tsc --noEmit</automated>
    <automated>npx vitest run cometTrail</automated>
  </verify>
  <done>Trail dots and sheet rings fill with `tuningColor(family)` resolved from the bundled matrix; `???`/off-matrix entries use `#A1A1AA`; `RING_COLOR`/unused `EntryOutcome` removed; the rewritten color test asserts tuning coloring and all other cometTrail tests stay green; typecheck passes.</done>
</task>

</tasks>

<verification>
- `cd packages/app && npx tsc --noEmit` clean (both edits).
- From the REPO ROOT: `npx vitest run` green — no orbitLayout test churn (that file is untouched), cometTrail color test rewritten, all other cometTrail tests still pass.
- Manual on http://localhost:5175: orbit group vertically centered; collapse glide lands on center; trail dots show blue/orange tuning colors.
</verification>

<success_criteria>
- Orbit group bbox is centered in the stage (offset derived in OrbitStage, orbitLayout.ts unchanged, pre-opener prompt still centered, collapse glide preserved).
- Comet-trail dots + sheet rings use tuning-family colors matching the main orbs; ??? / off-matrix → muted fallback.
- Main-view weak-fan dimming unchanged; no packages/core changes; no new config magic numbers.
- Typecheck + full vitest green.
</success_criteria>

<output>
Create `.planning/quick/260717-kxs-center-the-orbit-group-vertically-recolo/260717-kxs-SUMMARY.md` when done.
</output>
