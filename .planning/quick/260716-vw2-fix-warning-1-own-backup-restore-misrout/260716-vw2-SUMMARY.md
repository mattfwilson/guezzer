---
quick_id: 260716-vw2
description: "Fix WARNING-1: own-backup restore misroutes to friend-compare on evicted DB"
date: 2026-07-17
status: complete
requirements: [PWA-04, DEX-04]
commit: fcbfbdc
---

# Quick Task 260716-vw2 — Summary

**Fixed the milestone-audit WARNING-1:** an own-backup restore on a fresh/evicted
DB no longer silently misroutes to read-only friend-compare.

## What changed

- `packages/app/src/settings/importPicker.ts` — `classifyImport` now returns
  `kind: "unowned"` when a file is owned but the local owner name is null/blank
  (an evicted DB), so SettingsView's existing "Whose dex is this?" prompt handles
  it. The prompt's "It's mine, restore it" button (`confirmPromptMine` →
  `mergeFile`) reaches the merge/restore path. `"friend"` now only fires when a
  local owner IS set and differs. Doc-comment updated.
- `packages/app/test/importFork.test.ts` — the stale assertion (owned + null local
  → `friend`) now asserts `unowned`, verifies the envelope carries through, and
  covers a whitespace-only local owner.

No UI change was needed — the prompt machinery already existed for the `unowned`
(v1/unstamped) case; this widens which files reach it.

## Verification

- `importFork.test.ts` — 8/8 green
- Full suite — **481/481 green** (66 files)
- App typecheck (`tsc --noEmit -p packages/app/tsconfig.json`) — clean

## Notes

- Recoverability was already possible (set owner name, re-import), so this was a
  WARNING not a blocker — but it undercut PWA-04's headline phone-loss recovery,
  hence fixed before the v1.0 milestone close.
- Residual UX nicety (not done, not needed): `resolveNamePrompt` compares the
  typed name against the local owner (still null here), so typing your own name
  routes to compare; the dedicated "It's mine, restore it" button is the correct
  affordance and works. No further change required.
