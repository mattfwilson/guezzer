---
phase: quick-260717-sjg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/app/src/config.ts
  - packages/app/src/explore/ExploreBackground.tsx
  - packages/app/src/styles.css
  - packages/app/src/explore/ConstellationCanvas.tsx
autonomous: true
requirements: [EXPL-06, "todo-260717-sjg"]

must_haves:
  truths:
    - "The GizzVerse (Explore) constellation renders over a subtle static gradient nebula backdrop instead of flat #0C0C10."
    - "With prefers-reduced-motion: no-preference, the nebula blooms drift/pulse very slowly; under reduced motion the sky is completely static."
    - "The backdrop never intercepts pan/zoom/tap — it is aria-hidden and pointer-events-none."
    - "Tuning-color node fills, 20%-alpha edges, focus-dim (0.12) and Dex-dim (0.35 grayscale) overlays all still read clearly over the backdrop."
    - "All backdrop tunables live in config.explore.background — no magic numbers in the component or CSS."
  artifacts:
    - path: "packages/app/src/explore/ExploreBackground.tsx"
      provides: "Decorative aria-hidden/pointer-events-none absolute-inset-0 CSS-gradient nebula layer, config-driven"
      min_lines: 30
    - path: "packages/app/src/config.ts"
      provides: "config.explore.background tunable block (bloom colors/opacities, size/blur, drift periods)"
      contains: "background:"
    - path: "packages/app/src/styles.css"
      provides: "explore-bg drift/pulse @keyframes gated behind @media (prefers-reduced-motion: no-preference)"
      contains: "prefers-reduced-motion: no-preference"
  key_links:
    - from: "packages/app/src/explore/ConstellationCanvas.tsx"
      to: "packages/app/src/explore/ExploreBackground.tsx"
      via: "first child of the relative flex-1 bg-surface wrapper div, behind <ForceGraph2D>"
      pattern: "<ExploreBackground"
    - from: "packages/app/src/explore/ConstellationCanvas.tsx"
      to: "ForceGraph2D backgroundColor"
      via: "transparent canvas fill so the DOM backdrop shows through"
      pattern: "backgroundColor=\"rgba\\(0, ?0, ?0, ?0\\)\""
---

<objective>
Add a subtle, purely-aesthetic animated "galaxy/nebula" backdrop behind the GizzVerse
(Explore) constellation, built from CSS radial-gradients on a DOM layer under the
`<ForceGraph2D>` canvas — the owner's locked MVP (todo Option 1, NOT the canvas
`onRenderFramePre` route). It reads as ambient depth and never competes with nodes,
labels, edges, or the focus/Dex-dim overlays, and never intercepts gestures.

Purpose: Give the constellation a sense of deep-space depth without touching the
force sim, battery budget (EXPL-06 settle-and-freeze), or offline guarantees.

Output: A new `ExploreBackground.tsx` component (mirroring `ShowBackground.tsx`),
a `config.explore.background` tunable block, reduced-motion-gated CSS keyframes, and
the ConstellationCanvas wiring (including the transparent-canvas fix) that makes the
backdrop visible.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260717-sjg-animated-galaxy-gradient-backdrop-behind/260717-sjg-PLAN.md

# The analog to mirror exactly (decorative aria-hidden/pointer-events-none/absolute-inset-0 ambient layer, config-driven tunables via CSS custom props):
@packages/app/src/show/ShowBackground.tsx

# Where the canvas lives + the wrapper div to inject into, and the backgroundColor gotcha (line ~458):
@packages/app/src/explore/ConstellationCanvas.tsx

# The single-config-file surface — add under the existing config.explore block (mirror the shape of config.show.background):
@packages/app/src/config.ts

# The reduced-motion CSS idiom — DEFAULT is static/reduced; @media (prefers-reduced-motion: no-preference) ADDS motion (see show-bg-fade-in / orb-breathe / orb-float, lines ~45-137):
@packages/app/src/styles.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: config.explore.background tunables + ExploreBackground.tsx component + reduced-motion-gated CSS</name>
  <files>packages/app/src/config.ts, packages/app/src/explore/ExploreBackground.tsx, packages/app/src/styles.css</files>
  <action>
Add a `background` sub-object to `config.explore` in config.ts (mirror the shape and
comment style of `config.show.background`). Include ALL of these tunables so nothing is
hardcoded downstream; mark every new numeric/color constant `[ASSUMED]` (tune on device
later, per the single-config rule):
  - Two-to-three off-center nebula blooms. For each bloom expose a color, a peak
    opacity (LOW — keep the sky subtle so a 0.12 focus-dimmed node stays visible), a
    size (bloom diameter as a viewport %/px), and a normalized center position (x/y as
    0–1 fractions). Suggested palette from the todo: a violet, an indigo, and a teal
    bloom, each at low opacity (roughly 0.10–0.22 band — [ASSUMED]).
  - A blur radius for the blooms (soft-edged wash).
  - Faint static star-speck opacity (the specks are pure CSS, drawn via tiny
    radial-gradient dots — NO external images, offline-safe).
  - Per-bloom (or shared) drift period(s) in ms — very slow (tens of seconds) so it's
    ambient, and an optional opacity-pulse period in ms.
Keep the base dark color out of config here — the wrapper div's `bg-surface`
(#0C0C10) remains the opaque base (see Task 2); the backdrop paints only translucent
blooms + specks over transparency.

Create `packages/app/src/explore/ExploreBackground.tsx` mirroring `ShowBackground.tsx`:
  - A decorative container div: `aria-hidden="true"` + `className="pointer-events-none
    absolute inset-0 overflow-hidden"`. It must be self-contained (no props needed) and
    import `config` from `../config.ts`; read every value from
    `config.explore.background`.
  - Render 2–3 absolutely-positioned bloom layers, each a div sized/positioned from
    config with a `radial-gradient` fill of its config color fading to transparent, at
    its config peak opacity, and the config blur applied (CSS `filter: blur(...)`).
    Give each bloom an animation class (e.g. `explore-bg-bloom`) and feed its drift
    period + a per-bloom `animation-delay` (deterministic offsets so blooms don't drift
    in sync — mirror the `--float-period`/`--float-delay` per-element idiom already in
    styles.css) via inline CSS custom properties on `style` (cast to `CSSProperties`,
    exactly like ShowBackground passes `--show-bg-crossfade-ms`).
  - Add one faint static star-speck layer: a div covering inset-0 whose background is a
    small set of tiny radial-gradient dots (or a repeating-radial-gradient) at the
    config speck opacity. This layer is NOT animated (specks stay put; the drift is
    carried by the blooms only) — keeps it cheap.
  - Do NOT paint an opaque base fill in this component (transparency lets the wrapper's
    bg-surface show through, so dim overlays read against #0C0C10).
  - NO React/DOM entanglement beyond rendering; no state, no effects, no per-frame JS.

Add the keyframes + reduced-motion gate to styles.css following the file's EXACT idiom
(DEFAULT = static, `@media (prefers-reduced-motion: no-preference)` ADDS motion):
  - Define `@keyframes explore-bg-bloom` using transform (slow translate and/or gentle
    rotate) and/or opacity ONLY (GPU-composited) — a very slow, subtle loop.
  - The `.explore-bg-bloom` selector is STATIC by default (no animation declared).
  - Inside a `@media (prefers-reduced-motion: no-preference)` block, attach the
    `animation` to `.explore-bg-bloom` driven by the config-fed `--explore-bg-*` custom
    properties (period + delay), with `will-change: transform` (and `opacity` if pulsed)
    and `animation: ... infinite`.
  - Mirror the comment style of the existing show-bg-fade-in / orb-float blocks so the
    reduced-motion contract is documented inline.
Under reduced motion the sky is a static gradient with zero drift/pulse. This is a pure
CSS compositor layer — it must NOT run per-frame JS and must NOT touch/reheat the d3
force sim (EXPL-06).
  </action>
  <verify>
    <automated>cd C:/Users/mattf/git/guezzer && npx tsc -p packages/app/tsconfig.json</automated>
    <automated>cd C:/Users/mattf/git/guezzer && npx vitest run --project @guezzer/app</automated>
  </verify>
  <done>
`config.explore.background` exists with bloom colors/opacities, blur, speck opacity, and
drift/pulse period(s), every new constant marked [ASSUMED]. `ExploreBackground.tsx`
exists as an aria-hidden + pointer-events-none + absolute-inset-0 layer of 2–3
config-driven radial-gradient blooms + a static speck layer, no state/effects. styles.css
has `@keyframes explore-bg-bloom` with the animation attached ONLY inside a
`@media (prefers-reduced-motion: no-preference)` block. App `tsc` passes and the
`@guezzer/app` vitest project is green (no regressions).
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire ExploreBackground into the ConstellationCanvas wrapper + make the canvas transparent</name>
  <files>packages/app/src/explore/ConstellationCanvas.tsx</files>
  <action>
Wire the backdrop into `ConstellationCanvas.tsx` so it renders behind the constellation:
  - Import `ExploreBackground` from `./ExploreBackground.tsx`.
  - Render `<ExploreBackground />` as the FIRST child of the existing wrapper div
    (the `<div ref={stageRef} role="img" ... className="relative flex-1 touch-none
    select-none overflow-hidden bg-surface">`), i.e. before the `{size.width > 0 && ...
    <ForceGraph2D>}` block. Because the wrapper is `relative` and the background is
    `absolute inset-0` placed first in DOM order, it sits behind the canvas in z-order.
  - KEEP the wrapper's `bg-surface` class — it stays the opaque #0C0C10 base so nothing
    white-flickers/flashes; the backdrop's translucent blooms paint over it.

CRITICAL GOTCHA — make the canvas transparent or the backdrop is invisible: the
`<ForceGraph2D>` currently sets `backgroundColor="#0c0c10"`, which fills the canvas
OPAQUELY every frame and would completely hide a DOM layer behind it. Change that prop to
a fully transparent fill — `backgroundColor="rgba(0, 0, 0, 0)"` — so the gradient shows
through. The wrapper's `bg-surface` provides the base dark color, so the constellation
still reads on #0C0C10 where there are no blooms. Do NOT otherwise change any node/edge/
overlay draw logic — tuning-color fills, the 20%-alpha muted edges (§B3), focus-dim
(0.12) and Dex-dim (0.35 grayscale) all stay exactly as-is; they now composite over the
subtle backdrop instead of flat color.

Confirm (by reading, not guessing) that nothing else feeds an opaque background: the
only opaque fill to remove is the ForceGraph2D `backgroundColor` prop; the wrapper's
`bg-surface` is intentionally retained as the base.

NOTE — legibility is a visual property tests cannot confirm: the executor CANNOT verify
that the blooms are subtle enough or that a 0.12-dimmed non-neighbor node still reads.
Call this out in the SUMMARY as a required on-device follow-up for the owner (subtlety +
overlay legibility check on the GizzVerse tab, motion and reduced-motion). Do NOT claim
visual correctness from the automated checks.
  </action>
  <verify>
    <automated>cd C:/Users/mattf/git/guezzer && npx tsc -p packages/app/tsconfig.json</automated>
    <automated>cd C:/Users/mattf/git/guezzer && npx vitest run --project @guezzer/app</automated>
  </verify>
  <done>
`ConstellationCanvas.tsx` renders `<ExploreBackground />` as the first child of the
`relative flex-1 ... bg-surface` wrapper (behind `<ForceGraph2D>`), the wrapper keeps
`bg-surface`, and `<ForceGraph2D backgroundColor="rgba(0, 0, 0, 0)">` is transparent so
the gradient shows through. App `tsc` passes and the `@guezzer/app` vitest project is
green. SUMMARY flags the on-device subtlety + focus/Dex-dim legibility check as an
owner follow-up (not verifiable by tests).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Pure decorative, static CSS. No user/untrusted input, no network, no package installs, no new attack surface. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-sjg-01 | Denial of Service (battery) | ExploreBackground CSS animation | mitigate | Transform/opacity-only GPU-composited keyframes on a DOM layer; NO per-frame JS, NO d3 sim reheat (EXPL-06). Fully disabled under prefers-reduced-motion (default state is static). |
| T-sjg-02 | Tampering | node dependencies | accept | No npm/pip/cargo installs — CSS gradients only, offline-safe, no external assets. |
</threat_model>

<verification>
- App typecheck clean: `npx tsc -p packages/app/tsconfig.json`.
- App test project green (no regressions): `npx vitest run --project @guezzer/app`.
- Grep confirms wiring: `<ExploreBackground` present in ConstellationCanvas.tsx and the
  ForceGraph2D `backgroundColor` is a transparent rgba, not `#0c0c10`.
- Grep confirms the reduced-motion gate: `explore-bg-bloom` animation appears ONLY inside
  a `@media (prefers-reduced-motion: no-preference)` block in styles.css.
- MANUAL (owner, on-device follow-up — NOT provable by tests): open the GizzVerse tab and
  confirm (1) the nebula reads as subtle ambient depth, (2) tuning-color nodes, muted
  edges, focus-dim and Dex-dim silhouettes stay clearly legible over it, (3) pan/zoom/tap
  are unaffected, (4) motion drifts slowly with motion enabled and is fully static under
  reduced motion.
</verification>

<success_criteria>
- GizzVerse constellation renders over a config-driven CSS-gradient nebula backdrop
  instead of flat #0C0C10, with the canvas made transparent so it shows through.
- Backdrop is aria-hidden + pointer-events-none and never intercepts gestures.
- All tunables live in `config.explore.background`; no magic numbers in component/CSS.
- Animation is transform/opacity-only, reduced-motion-gated (static by default), and
  never touches the d3 sim (EXPL-06).
- No `packages/core` changes (decorative, app-side only).
- App `tsc` + `@guezzer/app` vitest green.
</success_criteria>

<output>
Create `.planning/quick/260717-sjg-animated-galaxy-gradient-backdrop-behind/260717-sjg-SUMMARY.md` when done.
In the SUMMARY, record: the final config.explore.background values (marked [ASSUMED]),
that Option 2 (canvas onRenderFramePre pan/zoom-locked sky) remains a documented future
escalation, and the required on-device owner follow-up (subtlety + focus/Dex-dim
legibility, motion + reduced-motion) that automated checks cannot verify.
</output>
