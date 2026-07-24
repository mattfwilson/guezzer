# Phase 21: Layout & Layering Foundations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-24
**Phase:** 21-layout-layering-foundations
**Areas discussed:** Bottom-space single owner, Layer-ordering invariant test, Date format + share card, Tab rename + presence labels

---

## Bottom-space single owner (FOUND-01, FOUND-02)

### Q1 — How is the one reserved-bottom-height source expressed?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: config → CSS var | Numbers in `config.ts`, written once to CSS custom properties at the app root; consumers read `var(...)` | ✓ |
| Pure CSS custom properties | Defined on `:root` in `styles.css`, no TS involvement; still needs a JS bridge for the runtime overlay px | |
| TS constant + hook | `useReservedBottom()` returning a composed `calc()` string; every call site concatenates its own | |

**User's choice:** Hybrid: config → CSS var
**Notes:** Keeps the CLAUDE.md single-config-file rule while giving one consumption idiom. The TS-hook option was noted as the exact shape the current four-notation drift grew out of.

### Q2 — Do runtime overlay heights fold into the same reserved value?

| Option | Description | Selected |
|--------|-------------|----------|
| One composed value | `useBottomOverlayInset` feeds the same variable, so "reserved bottom" means one thing | ✓ |
| Keep them separate | Static reserve for fixed chrome, dynamic reserve for scrollable body only | |
| You decide | Planner picks from the code audit | |

**User's choice:** One composed value
**Notes:** Later refined by the scroll/non-scroll finding (see Q13) into two named compositions derived from the same parts.

### Q3 — How do we approach the installed-PWA dead gap?

| Option | Description | Selected |
|--------|-------------|----------|
| Diagnose on device, then fix | Temporary on-device readout of insets, viewport heights and element heights; fix chosen from evidence | ✓ |
| Try the `height:100%` chain first | Cheapest hypothesis; escalate to measurement if the gap survives | |
| Lock the `visualViewport` approach now | Commit to a JS-measured `--gz-vh` custom property | |

**User's choice:** Diagnose on device, then fix
**Notes:** The FOUND-01 before/after measurement is already a phase deliverable, so the harness pays for itself twice. `100vh`/`min-h-screen` and `dvh` both remain excluded.

### Q4 — How much does phase 21 provision for the phase 22–24 chrome-hide?

| Option | Description | Selected |
|--------|-------------|----------|
| Build the collapse hook now | Reserve can go to 0 when chrome hides; phase 21 ships it pinned to always-visible | ✓ |
| Static now, dynamic in phase 22 | No speculative design; reopens the same call sites later | |
| Document the seam only | Compose so a future collapse is one line, add no plumbing | |

**User's choice:** Build the collapse hook now
**Notes:** Avoiding a second pass over the same call sites in a second layout state is the phase's stated reason for going first.

### Q5 — What enforces "a search returns exactly one owner"?

| Option | Description | Selected |
|--------|-------------|----------|
| Source-scanning guard test | Vitest test failing if a bottom-anchored magic literal appears outside the owner module | ✓ |
| jsdom render assertions | Render each surface and assert its composed offset; jsdom evaluates neither `env()` nor `calc()` | |
| Both | Source guard plus render assertions | |
| Code comment + review only | Cheapest; nothing stops a fifth notation appearing | |

**User's choice:** Source-scanning guard test
**Notes:** The only option that tests FOUND-02's own wording. Precedent: `configMirror.test`, cover-art budget guard.

### Q6 — How far does landscape go?

| Option | Description | Selected |
|--------|-------------|----------|
| Same layout, correct math | No landscape-specific design; guarantee the arithmetic when `inset-bottom` shrinks | ✓ |
| Also handle the notch gutters | Add `inset-left`/`inset-right` handling to full-bleed surfaces | |
| Measure only, fix if broken | Take the measurement; only spend effort on a real defect | |

**User's choice:** Same layout, correct math
**Notes:** `styles.css:221-222` already applies the left/right gutters at body level.

### Q7 — Do the modal sheet bottom paddings fold in?

| Option | Description | Selected |
|--------|-------------|----------|
| Fold in as a separate owned value | Sheets get their own named value; the three copy-pasted duplicates collapse | ✓ |
| Out of scope | FOUND-02 doesn't name sheets; keep blast radius minimal | |
| Deduplicate only, no new owner | Point the three copies at `Sheet.tsx`'s value | |

**User's choice:** Fold in as a separate owned value
**Notes:** Deliberate small widening beyond FOUND-02's list. Kept distinct from the tab-bar reserve — sheets are not tab-bar-relative.

### Q8 — How does the conversion land, given regression is the milestone's dominant risk?

| Option | Description | Selected |
|--------|-------------|----------|
| Introduce, then convert per surface | One commit establishes the owner byte-identically; surfaces convert in small revertible groups | ✓ |
| One atomic conversion | No half-migrated window; everything suspect at once if a pixel shifts | |
| You decide | Planner slices from the code | |

**User's choice:** Introduce, then convert per surface

### Q9 — Do the strips move to the measured model?

| Option | Description | Selected |
|--------|-------------|----------|
| Measure everything | Strips register their real height like the toasts do | ✓ (later revised) |
| Keep static constants for strips | Only variable-copy overlays need measuring | |
| You decide | Planner audits whether strips have variable content | |

**User's choice:** Measure everything — **subsequently revised** at Q17 after `SuggestionStrip.tsx:9` was found to document its fixed height as a deliberate no-jump design.

### Q10 — Is simultaneous-overlay stacking in scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope, capture as todo | Over-reserving is the safe failure; fixing stacking is new layout behavior | ✓ |
| Fix the stacking too | Each overlay offsets by the total below it | |
| Verify first, then decide | Confirm two overlays can co-occur before acting | |

**User's choice:** Out of scope, capture as todo

### Q11 — Is the keyboard-shrunk viewport in scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Check during the device pass, fix only if broken | Add "SearchSheet with keyboard up" to the diagnosis session | ✓ |
| Handle it explicitly | Wire `visualViewport` resize into the reserved value | |
| Out of scope | Not named in any FOUND requirement | |

**User's choice:** Check during the device pass, fix only if broken

### Q12 — What form does FOUND-01's before/after proof take?

| Option | Description | Selected |
|--------|-------------|----------|
| Numbers + screenshots in the phase HUMAN-UAT doc | Before/after, portrait + landscape, installed instance, device and iOS recorded | ✓ |
| Screenshots only | Faster; nothing to compare against on a future regression | |
| Keep the readout shipped behind a flag | Re-runnable on future devices/iOS versions; more surface to maintain | |

**User's choice:** Numbers + screenshots in the phase HUMAN-UAT doc

### Q13 — Finding: body-level bottom inset appears double-counted

| Option | Description | Selected |
|--------|-------------|----------|
| Lead hypothesis, mirror the UX-01 fix | Drop body-level `padding-bottom`, let each surface own its inset, as the top axis was fixed | ✓ |
| One hypothesis among several | Measure the whole chain and let the numbers pick | |
| Fix it regardless of the gap | Clean it up as part of the single-owner work, then measure | |

**User's choice:** Lead hypothesis, mirror the UX-01 fix
**Notes:** `styles.css:217-219` records the top-inset removal for exactly this reason, three lines above the bottom one that still has it.

### Q14 — How is the scroll/non-scroll divergence expressed?

| Option | Description | Selected |
|--------|-------------|----------|
| Two named compositions | Content reserve (tab bar + overlays) and chrome reserve (tab bar only), both from the same parts | ✓ |
| One value plus an opt-out flag | Same outcome as a parameter rather than two names | |
| Revisit the divergence | Question whether non-scrolling routes should reserve after all | |

**User's choice:** Two named compositions
**Notes:** Preserves `AppShell.tsx:64-78`'s deliberate behavior and turns an unexplained divergence into a documented one.

### Q15 — Does the FAB move when a strip appears?

| Option | Description | Selected |
|--------|-------------|----------|
| FAB holds position, strips reserve for content only | Founding "tap targets never move on their own" rule wins | ✓ |
| FAB tracks the strip, as today | Keeps shipped `fabLayout.ts` behavior; measuring just makes the lift accurate | |
| Static strip height for the FAB only | Stability for the tap target, accuracy for the content | |

**User's choice:** FAB holds position
**Notes:** Partly reverses shipped `fabLayout.ts`; flagged in CONTEXT.md D-05 so it isn't later rediscovered as a regression, with a cross-check against the phase-10 `a60d5e2` FAB lift.

### Q16 — What unit does the owner use?

| Option | Description | Selected |
|--------|-------------|----------|
| `rem`, and let the bar scale | Labels already scale; a fixed-px bar would clip them under enlarged Dynamic Type | ✓ |
| `px`, fixed bar height | Fully predictable arithmetic; a11y regression risk | |
| You decide | Planner checks label behavior at large sizes | |

**User's choice:** `rem`, and let the bar scale

### Q17 — Finding: the suggestion strip's fixed height is a deliberate no-jump design

| Option | Description | Selected |
|--------|-------------|----------|
| Exempt it — keep fixed and always-reserved | Restrict "measure everything" to overlays with genuinely variable content | ✓ |
| Measure it but keep space always reserved | Constant can't drift, but reserved height changes with content | |
| Measure it fully | Most consistent mechanism; gives up the no-jump property on the live-tracking surface | |

**User's choice:** Exempt it
**Notes:** Revises Q9. The 56→112px drift was a wrong constant, not a wrong mechanism.

### Q18 — FOUND-02 names the peek strip, but the code says it is never fixed

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope, record the correction | It has no bottom offset to unify; note the requirement overreached | ✓ |
| Include it anyway | Bring its expanded panel under the same owner | |
| Audit and document only | Verify it needs nothing, change no code | |

**User's choice:** Out of scope, record the correction

### Q19 — Finding: the five `bottom-16` overlays overlap the tab bar by one inset

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — compose them from the chrome reserve | Fixes a real installed-only defect in the same class as FOUND-01 | ✓ |
| Verify on device first | Confirm before changing five shipped surfaces | |
| Out of scope | Convert to the owner without changing offsets; ships a known overlap | |

**User's choice:** Yes — compose them from the chrome reserve

### Q20 — Are GizzMap and GizzVerse bottom surfaces in the audit?

| Option | Description | Selected |
|--------|-------------|----------|
| Audit all, convert what's tab-bar-relative | Anything left unconverted carries a comment saying why | ✓ |
| Only the six named surfaces | Tightest scope | |
| Audit only, no conversions | Inventory for phases 22–24, change nothing | |

**User's choice:** Audit all, convert what's tab-bar-relative

### Q21 — What if the dead gap can't be reproduced?

| Option | Description | Selected |
|--------|-------------|----------|
| Record the measurement as the deliverable | The success criterion is the measurement; flush numbers close it | ✓ |
| Keep hunting until something is found | Risks burning phase time on a bug that no longer exists | |
| Mark it deferred | Leaves the milestone audit an open item | |

**User's choice:** Record the measurement as the deliverable

### Q22 — What's the escape hatch if the rewrite misbehaves?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-surface revertibility, no compatibility shim | Each surface reverts as one commit; guard test catches partial reverts | ✓ |
| Keep old constants alongside for one milestone | Fast revert, but the search still returns two owners — fails FOUND-02 | |
| Feature-flag the new arithmetic | Strongest live safety; permanent branch in the most-shared layout code | |

**User's choice:** Per-surface revertibility, no compatibility shim

---

## Layer-ordering invariant test (FOUND-03)

### Q23 — Structural or numeric?

| Option | Description | Selected |
|--------|-------------|----------|
| Repro first, structural is the lead | Open a modal sheet, fire a toast, name the offender; expect structural | ✓ |
| Act on it as structural now | Analysis is solid; skip the repro | |
| Write the test only, change nothing | Strictest reading; would mean a test failing on day one | |

**User's choice:** Repro first, structural is the lead
**Notes:** Scouting evidence: top-level toasts at z 20 vs `ShowView.tsx:178` creating a stacking context at z 10 around non-portaled sheet-tier surfaces at z 50. Resolves the researchers' disagreement toward structural, pending the repro the roadmap asks for.

### Q24 — What does the test assert?

| Option | Description | Selected |
|--------|-------------|----------|
| Structural: sheet-tier surfaces escape to body | Asserts portal parentage — the assertion that catches the defect class | ✓ |
| Both structural and numeric | Portal assertion plus a config-ordering pin | |
| Numeric ordering only | Passes today despite the defect; cannot satisfy FOUND-03 | |

**User's choice:** Structural

### Q25 — How do the five surfaces escape the stacking context?

| Option | Description | Selected |
|--------|-------------|----------|
| Portal only, keep them hand-rolled | Smallest diff; does not grow phase 22's animation blast radius from 11 to 16 | ✓ |
| Migrate onto the shared `<Sheet>` primitive | One real primitive; rewrites five device-verified surfaces in a foundations phase | |
| Case by case | Criteria decided during planning | |

**User's choice:** Portal only

### Q26 — What is the invariant's scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal only, non-modal exempt by name | NodeSheet and the `focusedFab` lift carried as named commented exceptions | ✓ |
| All sheet-tier surfaces | Would fail on the shipped `focusedFab` lift the roadmap protects | |
| Modal only, exceptions in config | Same scope, exception list in `config.ui` | |

**User's choice:** Modal only, non-modal exempt by name

### Q27 — What does a portaled surface lose?

| Option | Description | Selected |
|--------|-------------|----------|
| Audit each surface, re-apply what it loses | Check ancestor-scoped CSS and behavior, apply on the portaled root | ✓ |
| Portal and rely on existing tests | CSS inheritance loss is what unit tests catch least | |
| Skip portaling where ancestors matter | Would mean changing the show column's layering instead | |

**User's choice:** Audit each surface, re-apply what it loses
**Notes:** `SearchSheet` matters most — losing `.orbit-stage` gesture suppression there is a real venue regression (SHOW-13).

### Q28 — Is FabMenu in scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Include in the repro, fix if confirmed | Same root cause; a toast eating a FAB tap mid-show hits the live-logging loop | ✓ |
| Modal sheets only | FOUND-03's literal wording | |
| Audit and document, defer the fix | Note it for phase 23 | |

**User's choice:** Include in the repro, fix if confirmed

### Q29 — Does the audit cover transform-created stacking contexts?

| Option | Description | Selected |
|--------|-------------|----------|
| Include in the audit | Same defect family, strictly worse — mispositioned, not just mispainted | ✓ |
| z-index only | Narrower; leaves the transform class unexamined | |
| Audit, document, don't fix | Inventory for phases 22–24 | |

**User's choice:** Include in the audit

### Q30 — Do the two documented numeric guards get automated protection?

| Option | Description | Selected |
|--------|-------------|----------|
| Add the two named guards | Targeted WR-01 and CR-01 assertions alongside the structural test — not a full ladder pin | ✓ |
| Structural only | Comments already document both guards | |
| Pin the full ladder | Maximum protection; churns on any legitimate tier insertion | |

**User's choice:** Add the two named guards

### Q31 — How is the repro produced?

| Option | Description | Selected |
|--------|-------------|----------|
| URL-flag harness, following the `?mockLatest` precedent | Force-show a toast so any sheet or the FAB can be opened over it, in a desktop browser | ✓ |
| Throwaway repro, deleted after | Next person rebuilds it | |
| Drive it from the automated test only | jsdom doesn't compute stacking | |

**User's choice:** URL-flag harness

### Q32 — What order relative to the bottom-space work?

| Option | Description | Selected |
|--------|-------------|----------|
| Repro first, then bottom-space, then portals | Repro is free and sizes the layering work; avoids editing the toast files twice | ✓ |
| Layering fully first | Clean separation; toast components edited twice | |
| You decide | Planner sequences from file overlap | |

**User's choice:** Repro first, then bottom-space, then portals

---

## Date format + share card (FOUND-04, FOUND-05)

### Q33 — Where does the helper live?

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling in the app, same file | Alongside `formatMonYear`; same Intl formatter, UTC guard and invalid-input behavior | ✓ |
| New file in the app | One export per file, two near-identical modules | |
| Put it in core | Core has no display-formatting layer | |

**User's choice:** Sibling in the app, same file

### Q34 — Which renders convert?

| Option | Description | Selected |
|--------|-------------|----------|
| Full dates only, coarse stays coarse | Five raw-ISO sites plus the share card; `formatMonYear` call sites untouched | ✓ |
| Everything full-date | Changes shipped GizzDex copy not named in any requirement | |
| Audit each site, decide per surface | Least predictable scope | |

**User's choice:** Full dates only, coarse stays coarse

### Q35 — How does the share-card footer handle the widest venue name?

| Option | Description | Selected |
|--------|-------------|----------|
| Ellipsize with the existing `truncateToWidth` | Zero new code; truncate the venue, never the date | ✓ |
| Shrink the font to fit | Inconsistent across shares; unreadable at extremes | |
| Wrap the venue to a second line | No vertical room at the current 99%-height baseline | |

**User's choice:** Ellipsize with the existing helper

### Q36 — Is the footer baseline in scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Check it in the same device pass | Already producing a card at the widest venue name; fix only if it clips | ✓ |
| Fix the baseline proactively | Changes a shipped layout on a hunch | |
| Out of scope | Capture a todo if it clips | |

**User's choice:** Check it in the same device pass

### Q37 — Do the accessible names convert too?

| Option | Description | Selected |
|--------|-------------|----------|
| Convert them as well | VoiceOver currently reads a number sequence; matters most on the unmark confirm | ✓ |
| Visible text only | FOUND-04 names visible renders | |
| You decide | Planner checks how each label is consumed | |

**User's choice:** Convert them as well

### Q38 — What keeps the format from drifting, and what happens on a malformed date?

| Option | Description | Selected |
|--------|-------------|----------|
| Unit tests on the helper plus a source guard | UTC boundary case, invalid-input path, and no bare ISO show date in components | ✓ |
| Helper unit tests only | Nothing stops a future raw render | |
| Rely on the existing suites | Component tests need updating anyway | |

**User's choice:** Unit tests plus a source guard

### Q39 — Where does formatting happen relative to the copy template?

| Option | Description | Selected |
|--------|-------------|----------|
| Format at the call site | Copy template stays strings-only; the helper stays the single owner | ✓ |
| Format inside the template | Puts presentation logic into the copy config | |
| You decide | Planner picks from consumer count | |

**User's choice:** Format at the call site

### Q40 — Should a boundary guarantee formatted dates never reach stored data?

| Option | Description | Selected |
|--------|-------------|----------|
| State it as an explicit boundary | Display-only; the date IS a join key in the unbound attendance path | ✓ |
| Note it in a code comment | Visible only to someone reading the helper | |
| Not needed | Direction is obvious from the signature | |

**User's choice:** State it as an explicit boundary

---

## Tab rename + presence labels (NAV-01, NAV-02, NAV-03)

### Q41 — How do the wire token and display label get decoupled?

| Option | Description | Selected |
|--------|-------------|----------|
| Token → label map, tokens frozen | `Tab` stays the wire vocabulary; a display map produces labels; allow-list untouched | ✓ |
| Keep tokens, label at each render site | Tab name decided in two places | |
| You decide | Planner shapes it from the copy config | |

**User's choice:** Token → label map, tokens frozen
**Notes:** `presenceActivity.ts:21-23` currently asserts the tokens ARE the display labels — that comment gets corrected.

### Q42 — What should a friend's presence label read?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate friend-facing wording | Tab voice and friend voice differ; "Alex is on Me" is nonsense | ✓ |
| One label everywhere | Perfectly consistent vocabulary, awkward sentences | |
| Keep brand names for presence | Zero presence change, but two names for the same place | |

**User's choice:** Separate friend-facing wording

### Q43 — What renders for an unrecognized token?

| Option | Description | Selected |
|--------|-------------|----------|
| Generic readable fallback | "in the app" or the dot alone — never blank, never a raw token | ✓ |
| Fall back to idle | Asserts something false | |
| Show nothing | NAV-03 forbids a blank | |

**User's choice:** Generic readable fallback
**Notes:** Tokens are frozen, so the live risk is a newer build sending a token an older build doesn't know. Adding the fallback now makes any future tab safe on today's builds.

### Q44 — How is the two-build test produced?

| Option | Description | Selected |
|--------|-------------|----------|
| Old build vs new build over the tunnel | Two devices, two identities, label checked in both directions | ✓ |
| Unit-test the token boundary instead | Unit-proven realtime is not verified realtime | |
| Both | Unit tests plus the device confirmation | |

**User's choice:** Old build vs new build over the tunnel

### Q45 — Do in-page headings follow the short names?

| Option | Description | Selected |
|--------|-------------|----------|
| Tab strip only, headings keep brand names | The short names are a thumb-space constraint, not a rebrand | ✓ |
| Rename headings to match | Widens the diff beyond NAV-01 | |
| Audit and decide per heading | Scope unknowable until the sweep | |

**User's choice:** Tab strip only, headings keep brand names

### Q46 — Does "Me" change what the tab contains?

| Option | Description | Selected |
|--------|-------------|----------|
| Name only, contents untouched | NAV-02 is display-labels-only; phase 24's NAV-04 badge depends on it staying the friends surface | ✓ |
| Reorder so the personal surface leads | A layout change, not a rename | |
| Note it for later | Capture as a deferred idea | |

**User's choice:** Name only, contents untouched

---

## Claude's Discretion

None. Every question in this discussion received an explicit selection — no "you decide" options were taken.

## Deferred Ideas

- Simultaneous bottom-overlay stacking (over-reserving is the safe failure; fixing the visual stacking is new layout behavior).
- Migrating the five hand-rolled sheet-tier surfaces onto the shared `<Sheet>` primitive — excluded so phase 22's animation blast radius stays at 11 surfaces.
- Reordering the "Me" tab so the personal/friends surface leads.
- Full landscape safe-area gutter treatment beyond the existing body-level left/right insets.
- Layer-2 of the tab rebrand (internal code identifiers) — deferred since quick task `260716-wwj`, and forbidden by NAV-02 for routes, file paths and storage keys.

## Corrections Made During Discussion

- **Q9 → Q17:** "Measure everything" was revised to exempt the SuggestionStrip after `SuggestionStrip.tsx:9` was found to document its fixed height as a deliberate no-jump design.
- **Q2 → Q14:** "One composed value" was refined into two named compositions after `AppShell.tsx:64-78` was found to diverge scroll vs non-scroll routes deliberately.
- **FOUND-02 wording:** the peek strip is named as a bottom-anchored surface but `BingoPeekStrip.tsx:3` states it is in-flow and never fixed. Recorded as a requirement overreach, not a phase omission.
