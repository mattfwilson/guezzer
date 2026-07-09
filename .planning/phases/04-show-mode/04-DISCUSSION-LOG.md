# Phase 4: Show Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 4-Show Mode
**Areas discussed:** Show lifecycle & attendance, What counts as a hit, Confidence shown on orbs, Fan & always-visible controls

---

## Show lifecycle & attendance

### How does a live show get started?
| Option | Description | Selected |
|--------|-------------|----------|
| Just start tapping | One 'Start Show' button opens orbit immediately, date auto-stamped, venue/show_id later, no network | ✓ |
| Pick from schedule first | Fetch upcoming/nearby shows, bind show_id + venue up front | |
| Optional pre-fill, skip-friendly | Offer date+venue/schedule but allow skip to tapping | |

**User's choice:** Just start tapping.

### When there's no show_id yet, how is attendance (DEX-01) credited?
| Option | Description | Selected |
|--------|-------------|----------|
| Provisional now, reconcile later | Local attendance record (session id + date) now; bind to real show_id in P5/P6 | ✓ |
| Require show_id up front | Only schedule-bound shows count | |
| Defer to planning | Researcher investigates kglw.net show-creation timing | |

**User's choice:** Provisional now, reconcile later.

### Concurrency + relaunch behavior?
| Option | Description | Selected |
|--------|-------------|----------|
| One active show, auto-resume | Single active show; relaunch resumes it; past shows read-only | ✓ |
| Multiple concurrent drafts | Several in-progress shows with a switcher | |
| Defer to planning | | |

**User's choice:** One active show, auto-resume.

### How does a show end?
| Option | Description | Selected |
|--------|-------------|----------|
| Explicit 'End show' action | Deliberate finalize to read-only; required before next night | ✓ |
| Encore mark ends it | Marking encore auto-finalizes | |
| Defer to planning | | |

**User's choice:** Explicit 'End show' action.

### Venue/date capture scope in Phase 4?
| Option | Description | Selected |
|--------|-------------|----------|
| Date only in P4; reconcile later | Date + local session id + provisional attend; show_id/venue in P5/P6 | ✓ |
| Optional venue note in P4 | Freeform venue label as a memory aid | |
| Defer to planning | | |

**User's choice:** Date only in P4; reconcile later.

---

## What counts as a hit

### Hit definition
| Option | Description | Selected |
|--------|-------------|----------|
| Any shown orb (top 5–8) | Hit if song was anywhere in the visible fan | ✓ |
| Top-5 (matches backtest) | Hit only if rank ≤ 5 | |
| Top-1 (strict) | Hit only if the #1 orb | |

**User's choice:** Any shown orb (top 5–8).

### Tally split?
| Option | Description | Selected |
|--------|-------------|----------|
| One combined number | Single 'X/Y hits' all night | ✓ |
| Combined, with segue detail on tap | Free-choice-only rate on tap | |
| Defer to planning | | |

**User's choice:** One combined number.

### Does '???' count against the tally?
| Option | Description | Selected |
|--------|-------------|----------|
| Counts as a miss | ??? / off-catalog = miss, denominator +1 | ✓ |
| Excluded from tally | ??? neutral, not scored | |
| Defer to planning | | |

**User's choice:** Counts as a miss.

---

## Confidence shown on orbs

### What percentage does an orb display?
| Option | Description | Selected |
|--------|-------------|----------|
| Model's own confidence | Absolute-ish score; ~100% only for hard segues | ✓ |
| Share of the shown fan | Renormalize so visible orbs sum ~100% | |
| Defer to planning | | |

**User's choice:** Model's own confidence.

### Signal lower confidence when the fan is weak?
| Option | Description | Selected |
|--------|-------------|----------|
| Soften the fan visually | Below threshold, dim orbs + 'uncertain' cue | ✓ |
| No special treatment | Always same rendering; numbers convey it | |
| Defer to planning | | |

**User's choice:** Soften the fan visually (top orb < ~15%).

### 'Why' line — always on orb or on tap?
| Option | Description | Selected |
|--------|-------------|----------|
| Tap orb for the why | Detail via separate affordance (tap logs the orb) | ✓ |
| Always-on one-liner | Render short why under each orb always | |
| Defer to planning | | |

**User's choice:** Tap orb for the why (via separate info/long-press affordance, since a plain tap logs).

---

## Fan & always-visible controls

### How many orbs?
| Option | Description | Selected |
|--------|-------------|----------|
| Adaptive 5–8 | At least 5, up to 8, drop negligible-score orbs | ✓ |
| Fixed 8 always | Always render 8 | |
| Defer to planning | | |

**User's choice:** Adaptive 5–8.

### Where do the always-visible controls live?
| Option | Description | Selected |
|--------|-------------|----------|
| Persistent bottom action bar | Search + ??? primary; set-break/encore/undo secondary | ✓ |
| Around the orbit | Controls float at screen corners | |
| Defer to planning | | |

**User's choice:** Persistent bottom action bar.

### What happens when you tap '???'
| Option | Description | Selected |
|--------|-------------|----------|
| Log placeholder immediately | One tap appends ??? node + recenters | ✓ |
| Quick-confirm first | Confirm before appending | |
| Defer to planning | | |

**User's choice:** Log placeholder immediately (rename later from trail).

### How does undo/edit work?
| Option | Description | Selected |
|--------|-------------|----------|
| Undo last + tap-node to edit | One-tap undo of last; tap older trail node to edit/delete | ✓ |
| Undo last only | Only the last entry | |
| Defer to planning | | |

**User's choice:** Undo last + tap-node to edit.

---

## Claude's Discretion

- Matrix-artifact offline loading (bundle vs `?url` + Workbox precache; `json` not a Workbox default).
- Set-structure serialization mirroring `docs/SCHEMA.md` (`setnumber`, `"e"` encore); local Dexie `version(2)` shape.
- Wake lock (SHOW-12) + fallback messaging; gesture suppression (SHOW-13).
- Radial layout math; comet-trail "+N" compression/expansion.
- Exact confidence threshold + orb-count bounds (config-driven).
- Component decomposition, migration wiring, app-level tests.

## Deferred Ideas

- Free-choice vs hard-segue tally split → Phase 6 recap (SHOW-14).
- Venue label + show_id binding UI → Phase 5/6.
- Richer "resolve unknown" flow → Phase 5.
- Suppress update toast during an active tracked show (carried from Phase 3 D-06 deferred).
- Post-show recap + rarity score → Phase 6.
