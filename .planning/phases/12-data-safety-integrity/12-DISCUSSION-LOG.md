# Phase 12: Data Safety & Integrity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 12-Data Safety & Integrity
**Areas discussed:** Doubleheader identity (SAFE-04), End-Show backup sequencing (SAFE-01+03), iOS download-abort fix (SAFE-02), Regression-proof strategy

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Doubleheader identity (SAFE-04) | Keep same-date shows distinct without re-breaking multi-device dedup | ✓ |
| End-Show backup sequencing (SAFE-01+03) | Finalize before snapshot; honest confirmation surface | ✓ |
| iOS download-abort fix (SAFE-02) | Deferred-revoke pattern + centralize download helper | ✓ |
| Regression-proof strategy | Test bar for re-fixes of prior-phase behavior | ✓ |

**User's choice:** All four areas.

---

## Doubleheader identity (SAFE-04) — core keying

| Option | Description | Selected |
|--------|-------------|----------|
| Dedup only by show_id; unbound = always distinct | Key unbound by sessionId; multi-device dedup relies on live-sync binding; residual risk = both-offline night counts twice (safe direction) | |
| Keep date-collapse, add a 'which show' discriminator | Preserve collapse but split with an extra signal (set/start-time or manual toggle); more machinery, needs a signal not currently captured | |
| You decide the mechanism | Lock the priority (doubleheaders survive), let planning pick keying as long as multi-device dedup degrades gracefully | ✓ |

**User's choice:** You decide the mechanism.
**Notes:** Priority is locked — doubleheaders MUST survive; the safe direction is over-counting your own attendance rather than losing a caught show. Exact keying is Claude's discretion.

## Doubleheader identity (SAFE-04) — derive-dex date-join

| Option | Description | Selected |
|--------|-------------|----------|
| Flag it for research — this is the real subtlety | The dex date-join and the doubleheader-split are the same code path; research/planning must solve both together | ✓ |
| Accept unbound tracked nights may miss archive setlist | Prioritize doubleheader correctness; a missed archive-setlist join is an acceptable edge | |
| You decide | Trust planning to preserve both | |

**User's choice:** Flag it for research.
**Notes:** The derive-dex date-join (unbound tracked night ↔ retro/archive setlist) shares the exact key being changed for the doubleheader split. Named the #1 thing for the researcher to dig into.

---

## End-Show backup sequencing (SAFE-01+03) — confirmation surface

| Option | Description | Selected |
|--------|-------------|----------|
| Post-close toast after success | Dialog closes on confirm; non-blocking toast only once backup resolves ok; recap opens in parallel | ✓ |
| Show it in the recap view | Put 'Backup saved ✓' / failure line in the recap the onEnded seam opens | |
| You decide | Lock behavior, let UI pick surface | |

**User's choice:** Post-close toast after success.
**Notes:** Paired with the locked sequencing fix (await endShow → await backup → confirm). Removes the static "backup saved" line shown while the dialog is open.

---

## iOS download-abort fix (SAFE-02) — revoke mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Defer revoke with a timeout | setTimeout revoke after a config-driven delay long enough for the download to start | ✓ |
| Don't revoke at all | Skip revoke; blob reclaimed on unload; zero abort risk but a small per-export leak | |
| You decide | Trust planning | |

**User's choice:** Defer revoke with a timeout.
**Notes:** Delay constant belongs in the single app config file.

## iOS download-abort fix (SAFE-02) — refactor

| Option | Description | Selected |
|--------|-------------|----------|
| Centralize into one helper | Extract a single triggerDownload() so the fix lives in one place; also address shareCard previewUrl leak | ✓ |
| Fix each in place | Patch both files separately; smallest diff but duplication persists | |
| You decide | Planner's call | |

**User's choice:** Centralize into one helper.
**Notes:** The duplication is what produced two copies of the same bug.

---

## Regression-proof strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Unit + component + documented iOS UAT | Unit on the pure doubleheader path, component on the End-Show ordering, manual iOS UAT for the download-abort fix | ✓ |
| Unit where possible, rest as UAT | Automate core paths, track iOS + confirmation timing as manual UAT | |
| You decide | Let planning set per-fix coverage | |

**User's choice:** Unit + component + documented iOS UAT.

---

## Claude's Discretion

- SAFE-04 exact keying/grouping mechanism and the derive-dex join solution (within the locked priority + constraints).
- The revoke defer-delay value and the shape/placement/copy of the post-close success toast.
- Location and signature of the centralized `triggerDownload` helper (app, not core).
- Test fixture strategy for the doubleheader assertions.

## Deferred Ideas

None raised beyond phase scope. Phase-13 UX bug todos (safe-area, wake-lock, fill-hint, constellation) and UI-polish todos were reviewed against this phase and deliberately not folded (see CONTEXT.md Deferred Ideas).
</content>
