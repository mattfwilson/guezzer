---
status: complete
phase: 19-shared-dex-progress
source: [19-04-PLAN.md]
started: 2026-07-23
updated: 2026-07-23
---

## Current Test

[complete — all checks passed]

## Tests

### 1. Live propagation (PROG-05, D-16)
expected: A catch logged on device A appears on device B's Friends list within a few seconds via postgres_changes, with completion %/caught count moving and the list re-ordering, no manual refresh (~5s debounce before the write).
result: pass — device B saw device A's row update and re-order live without refresh.

### 2. Head-to-head (PROG-06 live)
expected: Tapping device A's row on device B opens the full-screen "You vs A" head-to-head with populated columns, per-album/per-rarity breakdown, and A's rarest-catches showcase; numbers match A's own GizzDex.
result: pass — overlay opened with correct populated columns and matching numbers.

### 3. Reconnect flush (D-17)
expected: Going offline on device A shows dimmed cached rows + "Offline · as of {time}" with the "You" row live; catches logged offline flush the own row and re-pull friends on reconnect; marker clears, rows un-dim, and device B sees A's new numbers within a few seconds.
result: pass — offline marker shown, flush + re-pull worked on reconnect, device B updated.

### 4. Never-blank venue view (D-18)
expected: The Friends area is never blank or spinning during the offline window; cached rows + the live "You" row are always present.
result: pass — cached rows and live "You" row remained visible throughout.

### 5. RLS write-own (PROG-03, T-19-authz)
expected: An upsert to public.progress with a user_id that is not the signed-in user's is rejected server-side by `with check (auth.uid() = user_id)`.
result: pass — authenticated upsert of a foreign user_id returned HTTP 403, error code 42501 ("new row violates row-level security policy for table \"progress\""), data null. Signed-in uid 17318ba8-... could not write another user's row.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none)
