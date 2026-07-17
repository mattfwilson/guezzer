---
phase: quick-260717-onl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/app/src/config.ts
  - packages/app/src/dex/TierBadge.tsx
  - packages/app/src/dex/shareCard.ts
  - packages/app/test/shareCard.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Exactly ONE tier-color map exists in the app; TierBadge and shareCard both import it — no local TIER_COLOR map remains in either file"
    - "Tier chips render the new scheme: debut #A1A1AA, common #E4E4E7, uncommon #34D399, rare #60A5FA, epic #A855F7, legendary #FB923C"
    - "The debut chip renders a DOTTED border; all other tiers render a solid border"
    - "The share-card wordmark renders in fixed brand gold #F2C14E, independent of the legendary tier hue (now orange)"
    - "rarestCatch tier text and tier-breakdown segments still follow the consolidated map (legendary now orange #FB923C)"
    - "The tier WORD always renders regardless of color (WCAG 1.4.1 preserved)"
    - "app typecheck is clean and the affected app vitest suites pass"
  artifacts:
    - path: "packages/app/src/config.ts"
      provides: "Consolidated config.dex.tierColors map + config.share.wordmarkGold"
      contains: "tierColors"
    - path: "packages/app/src/dex/TierBadge.tsx"
      provides: "Tier pill importing the shared map, dotted border for debut"
    - path: "packages/app/src/dex/shareCard.ts"
      provides: "Share card importing the shared map, wordmark decoupled to wordmarkGold"
  key_links:
    - from: "packages/app/src/dex/TierBadge.tsx"
      to: "config.dex.tierColors"
      via: "import config, index by tier"
      pattern: "config\\.dex\\.tierColors"
    - from: "packages/app/src/dex/shareCard.ts"
      to: "config.dex.tierColors"
      via: "import config, index by tier"
      pattern: "config\\.dex\\.tierColors"
    - from: "packages/app/src/dex/shareCard.ts"
      to: "config.share.wordmarkGold"
      via: "wordmark fill color"
      pattern: "config\\.share\\.wordmarkGold"
---

<objective>
Recolor the six rarity tier chips to a new scheme and eliminate the duplicated
`TIER_COLOR` maps by consolidating them into a single app-config source of truth.
Decouple the share-card brand wordmark from the legendary tier hue (it stays gold
permanently), and switch the debut chip's border to dotted.

Purpose: Resolve the pending recolor todo — one map, no drift between TierBadge
and shareCard, and a wordmark that no longer inherits the legendary color.
Output: Updated `config.ts` (new consolidated map + brand-gold constant), updated
`TierBadge.tsx` and `shareCard.ts` (import the map, delete local copies), and
updated color assertions in `shareCard.test.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@packages/app/src/config.ts
@packages/app/src/dex/TierBadge.tsx
@packages/app/src/dex/shareCard.ts
@packages/app/test/shareCard.test.tsx

# New color scheme (badge text color + 40%-opacity border of the same hue):
#   debut      #A1A1AA gray   — DOTTED outline (debut only)
#   common     #E4E4E7        — soft white, solid border
#   uncommon   #34D399        — emerald (distinct from reserved caught-green #22C55E)
#   rare       #60A5FA        — blue (reuses the old uncommon blue, now free)
#   epic       #A855F7        — purple (distinct from tuning C#-violet #B98CF2; never co-occur)
#   legendary  #FB923C        — orange (reuses the hue epic briefly held, now free)
# Wordmark brand gold stays #F2C14E permanently, decoupled from legendary.
# Core purity (CLAUDE.md): colors are app UI chrome — NO hex colors in packages/core.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Consolidate the tier-color map + brand gold into config.ts</name>
  <files>packages/app/src/config.ts</files>
  <action>
Add ONE consolidated tier-color map at `config.dex.tierColors` (chosen home:
alongside the existing dex geometry constants in the `dex` object, because tier
rarity is a dex concept consumed by both dex UI and the share card — document this
choice in a doc comment). Type it as `Record<RarityTier | "debut", string>` with
exactly these six entries and hexes: debut `#A1A1AA`, common `#E4E4E7`, uncommon
`#34D399` (comment: emerald, deliberately distinct from reserved caught-green
`#22C55E`), rare `#60A5FA` (comment: reuses the old uncommon blue, now free), epic
`#A855F7` (comment: purple, distinct from tuning C#-violet `#B98CF2`; never
co-occur), legendary `#FB923C` (comment: orange, reuses the hue epic briefly held).

Add a type-only import at the top of config.ts: `import type { RarityTier } from "@guezzer/core";` (type-only, so core purity is unaffected — the app is allowed to import from core). Annotate `tierColors` with the `Record<RarityTier | "debut", string>` type so a missing/extra tier is a compile error.

Also add `config.share.wordmarkGold: "#F2C14E"` (a `const`-friendly string) inside the existing `share` object, with a doc comment: fixed brand gold for the share-card wordmark, permanently decoupled from the legendary tier hue. Do NOT reuse the legendary tier value for the wordmark.

Keep everything under the existing `as const` on `config`. Follow the surrounding single-config-file ethos (CLAUDE.md) and the nearby comment style.
  </action>
  <verify>
    <automated>npx tsc -p packages/app/tsconfig.json --noEmit</automated>
  </verify>
  <done>config.ts exposes `config.dex.tierColors` (6 tiers incl. debut, typed `Record<RarityTier | "debut", string>`) and `config.share.wordmarkGold === "#F2C14E"`; app typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 2: Wire both consumers to the shared map + dotted debut border, update tests</name>
  <files>packages/app/src/dex/TierBadge.tsx, packages/app/src/dex/shareCard.ts, packages/app/test/shareCard.test.tsx</files>
  <action>
TierBadge.tsx:
- DELETE the local `TIER_COLOR` map (lines ~15-23). Read the color from
  `config.dex.tierColors[tier]` instead (`config` is already imported).
- For `tier === "debut"` ONLY, render a DOTTED border; all other tiers keep the
  solid border. Use Tailwind `border-dotted` conditionally on the pill's className
  (the base className already has `border`) — e.g. append `border-dotted` when the
  tier is debut, leaving `border-solid`/default for the rest. Keep the existing
  `borderColor: ${color}66` inline style (the 40%-opacity same-hue border) for all
  tiers. Do NOT gate the WORD on color — the label text must always render (WCAG
  1.4.1); this property is unchanged.
- Update the stale top-of-file doc comment (lines ~1-11): it currently claims this
  is "the ONLY place the two new Phase-6 hues (#60A5FA Uncommon / #E879F9 Rare)
  appear." That is no longer true — the map now lives in config and colors changed.
  Rewrite it to describe the current behavior: the pill reads its hue from the
  single `config.dex.tierColors` source, debut renders a dotted neutral border, and
  the WORD always renders (color is reinforcement only).

shareCard.ts:
- DELETE the local `TIER_COLOR` map (lines ~31-38). Read tier colors from
  `config.dex.tierColors` (`config` is already imported).
- Wordmark (line ~87): change the fill from `TIER_COLOR.legendary` to
  `config.share.wordmarkGold` so the wordmark stays gold `#F2C14E` regardless of the
  legendary tier now being orange.
- `data.rarestCatch.tier` fill (~line 106) and the tier-breakdown segment fills
  (~line 156) MUST still follow the tier via `config.dex.tierColors[...]` — only the
  fixed wordmark is decoupled.
- Update the doc comment on the deleted map / near the wordmark draw (~lines 31, 86,
  96, 110) so no comment still says "Legendary reuses accent gold" for the wordmark;
  reflect that legendary is now orange and the wordmark uses the separate brand gold.

shareCard.test.tsx:
- The assertion at ~line 87-92 finds the "Legendary" tier-BREAKDOWN segment and
  asserts its fillStyle is `#F2C14E`. That segment now follows the tier, so update
  the expected hex to `#FB923C` (legendary orange). Update the `it(...)` title if it
  says "gold Legendary segment" (it now describes the orange legendary segment).
- Note: this test does NOT currently assert the wordmark color. Optionally add a
  focused assertion that the "Guezzer" wordmark fillText is drawn in `#F2C14E` to
  pin the decoupling — but keep it minimal.

Do NOT touch songRow.test.tsx (its assertions are text-only — "Rare"/"Uncommon"/
etc. — no color assertions, so it needs no change but must still pass). Do NOT touch
packages/core (core stays color/DOM-free). Do NOT touch the todo file — the
orchestrator handles todo/docs cleanup.
  </action>
  <verify>
    <automated>npx tsc -p packages/app/tsconfig.json --noEmit && npx vitest run packages/app/test/shareCard.test.tsx packages/app/test/songRow.test.tsx</automated>
  </verify>
  <done>Neither TierBadge.tsx nor shareCard.ts contains a local TIER_COLOR map; both read from config.dex.tierColors; wordmark draws in config.share.wordmarkGold (#F2C14E); debut chip has a dotted border, others solid; shareCard + songRow vitest suites green; app typecheck clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

No new trust boundary. This is an app-side, color/config-only change: static hex
strings and Tailwind class selection. No untrusted input, no new network/data path,
no package installs.

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-onl-01 | Tampering | tier color map drift | mitigate | Single source `config.dex.tierColors`; both consumers import it, local maps deleted — no second pipeline to drift |
| T-onl-02 | Information disclosure | none | accept | No PII, no secrets, no new inputs — cosmetic recolor only |
</threat_model>

<verification>
- `grep -n "TIER_COLOR" packages/app/src/dex/TierBadge.tsx packages/app/src/dex/shareCard.ts` returns nothing (both local maps deleted).
- `config.dex.tierColors` has 6 entries (5 tiers + debut) with the new hexes.
- `config.share.wordmarkGold === "#F2C14E"` and the wordmark draw references it, not the legendary tier.
- Debut chip className includes `border-dotted`; other tiers do not.
- `npx tsc -p packages/app/tsconfig.json --noEmit` is clean.
- `npx vitest run packages/app/test/shareCard.test.tsx packages/app/test/songRow.test.tsx` passes.
</verification>

<success_criteria>
- Single `config.dex.tierColors` map is the only tier-color source; TierBadge and
  shareCard both import it; no local `TIER_COLOR` map remains.
- Tier chips render the new six-color scheme; debut chip border is dotted, others
  solid; the tier word always renders.
- Share-card wordmark stays brand gold `#F2C14E`, decoupled from legendary (now
  orange `#FB923C`); rarestCatch + breakdown segments still follow the tier map.
- App typecheck clean; affected vitest suites green.
</success_criteria>

<output>
Create `.planning/quick/260717-onl-recolor-rarity-tier-chips-consolidate-ti/260717-onl-SUMMARY.md` when done.

In the SUMMARY, note that this resolves the pending todo
`.planning/todos/pending/2026-07-17-recolor-rarity-tier-tags-common-uncommon-rare-legendary.md`
— the ORCHESTRATOR will remove that todo file and its STATE line; the executor must
NOT touch the todo file or STATE.md.
</output>
