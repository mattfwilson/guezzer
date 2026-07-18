# Phase 9: Data Integrity & Restore UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 9-Data Integrity & Restore UX
**Areas discussed:** Shownotes carry policy, PWA-05 remaining scope, Corpus artifact & versioning

---

## Todo Cross-Reference (pre-discussion)

| Todo | Area | Folded? |
|------|------|---------|
| Bottom sheets animation/layering | ui | No — kept pending |
| Full-date format "Mon D, YYYY" app-wide | ui | No — kept pending |
| Recap share card show-scoped | ui | No — kept pending |

**User's choice:** "None — keep them pending" (all three are UI concerns; Phase 9 is core/data).

---

## Shownotes carry policy

### Q1: Within-show shownotes disagreement handling

| Option | Description | Selected |
|--------|-------------|----------|
| First-row-wins + count it in stats | Take position-1 row's prose, record disagreement in NormalizeStats; prose is non-structural (D-15 ethos) | ✓ |
| Hard-fail the build | Match the settype precedent — throw naming the show | |
| Longest-value-wins + stats | Prefer most complete prose if rows differ | |

**User's choice:** First-row-wins + count it in stats (recommended option).

### Q2: Meaning of "verbatim"

| Option | Description | Selected |
|--------|-------------|----------|
| Byte-for-byte, "" stays "" | Zero transformation — no trim, no HTML stripping, empty string carried as empty string | ✓ |
| Byte-for-byte, but "" → null | Same rule for prose, but normalize the no-notes case to null | |
| You decide | Claude picks during planning | |

**User's choice:** Byte-for-byte, "" stays "" (recommended option).

---

## PWA-05 remaining scope

### Q1: Scope beyond the missing automated test

| Option | Description | Selected |
|--------|-------------|----------|
| Tests only | Cover evicted DB + typed own name → merge, close the requirement; smallest, matches hardening bias | ✓ |
| Tests + prompt copy hint | Also add a helper line to the "Whose dex is this?" sheet | |
| Tests + copy + owner-name hint | Additionally surface the file's stamped owner name in the prompt | |

**User's choice:** Tests only (recommended option). The behavior itself already landed in commit `e08ceee`.

### Q2: Test shape for the isMine decision

| Option | Description | Selected |
|--------|-------------|----------|
| You decide | Claude picks during planning — likely pure helper extraction + one component wiring test | ✓ |
| Component-level only | Render SettingsView, simulate evicted-DB import, assert merge invoked | |
| Pure helper + component test | Extract name-match into a pure function, cover edge cases directly | |

**User's choice:** You decide (recommended option).

---

## Corpus artifact & versioning

### Q1: schemaVersion handling for the additive field

| Option | Description | Selected |
|--------|-------------|----------|
| Keep schemaVersion 1 | Additive field is non-breaking per the stated rule; zero consumer ripple | ✓ |
| Bump to 2 | Strict versioning; forces touching every consumer guard for a field none read | |

**User's choice:** Keep schemaVersion 1 (recommended option).

### Q2: Placement of the carried shownotes

| Option | Description | Selected |
|--------|-------------|----------|
| In corpus.json, accept growth | Field on NormalizedShow in the one canonical artifact; ~1 MB growth accepted, bundle unaffected | ✓ |
| Sibling artifact keyed by showId | Keep corpus.json diff-lean; future feature would join two files | |

**User's choice:** In corpus.json, accept growth (recommended option).

---

## Claude's Discretion

- PWA-05 test shape (pure helper extraction vs component-only).
- Whether to regenerate `corpus.json` + downstream builders inside this phase to prove byte-stable outputs.
- Test fixture strategy for the DATA-06 end-to-end assertion.

## Deferred Ideas

None raised during discussion beyond the three reviewed-but-not-folded UI todos above — discussion stayed within phase scope.
