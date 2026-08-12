---
phase: quick-260811-uxw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/core/test/schedule/schedule.test.ts
  - data/schedule/fov-2026.json
  - packages/core/src/schedule/schedule.ts
autonomous: true
requirements: [SCHED-DATA]

must_haves:
  truths:
    - "The Sched tab's Friday Castle column shows 'Stu Mackenzie' at 12:30 PM – 1:40 PM (no '?????????' placeholder)"
    - "The Friday 1:30 AM Castle slot shows 'Nikki Nair', not 'Moktar'"
    - "The Saturday 1:00 PM Castle slot shows 'Cavs Gong Bath'"
    - "The Sunday 11:30 PM Castle slot shows 'Bullant'"
    - "Buena Vista High School Red Hots Jazz Band appears once, on Sunday at 11:00 AM, and is gone from Saturday"
    - "Every other event id in the artifact is byte-identical, so no friend's already-saved pick is silently dropped"
    - "A future re-transcription that renames `fri-castle-1300` to match its new start time fails the test suite"
  artifacts:
    - path: "data/schedule/fov-2026.json"
      provides: "The committed FOV 2026 schedule matching the final poster"
      contains: "sun-castle-1100"
    - path: "packages/core/test/schedule/schedule.test.ts"
      provides: "Pinning assertions for the six 2026-08-11 poster deltas + an id-permanence guard"
      contains: "re-transcription"
  key_links:
    - from: "data/schedule/fov-2026.json"
      to: "parseScheduleArtifact"
      via: "strict zod schema + unique-id gate (a malformed edit returns null and blanks the tab)"
      pattern: "parseScheduleArtifact"
    - from: "data/schedule/fov-2026.json"
      to: "sanitizeEventIds"
      via: "scheduleEventIds() allow-list — ids absent from the artifact are silently dropped from picks"
      pattern: "scheduleEventIds"
---

<objective>
Bring the committed FOV 2026 schedule artifact in line with the final official poster
(`fieldofvision.meadowcreekco.com/KBYG`, re-transcribed 2026-08-11).

Six deltas, all in The Castle: three mystery `?????????` sets are now named, one Friday
late-night headliner was swapped, one Friday set moved 30 minutes earlier, and the high
school jazz band moved from Saturday to Sunday. Everything else on all three days was
checked against the poster and already matches.

The delicate part is **not** the data — it is the ids. `sanitizeEventIds` silently DROPS
unknown ids at the Supabase read boundary (a friend on a newer artifact may legitimately
reference events this build doesn't know), so renaming an id silently deletes everyone's
saved pick for that set. Four of the five changed events keep their original id even though
the title — and in one case the start time — no longer matches the slug.

Purpose: the schedule friends open at the festival is correct, and existing picks survive.
Output: the corrected artifact, plus a test that pins all six deltas AND fails loudly if a
future edit "tidies up" `fri-castle-1300` into `fri-castle-1230`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@data/schedule/fov-2026.json
@packages/core/src/schedule/schedule.ts
@packages/core/test/schedule/schedule.test.ts
</context>

<source_of_truth>

The orchestrator visually transcribed the official poster (the user downloaded it to the repo
root as `FOV2026_SCHEDULE_FINAL.jpg`; same image as `fieldofvision.meadowcreekco.com/KBYG`).
**This transcription is AUTHORITATIVE.** Do not re-derive it. Do not try to fetch the website
— it is behind a Cloudflare JS challenge. Do not open the JPG to "double check"; the reading
below is the finding of record.

| # | Event id | Field | From | To |
|---|---|---|---|---|
| 1 | `fri-castle-1300` | `title` | `?????????` | `Stu Mackenzie` |
| 1 | `fri-castle-1300` | `startMin` | `780` | `750` (poster: 12:30PM–1:40PM; `endMin` stays `820`) |
| 2 | `fri-castle-0130` | `title` | `Moktar` | `Nikki Nair` (times unchanged, 1530–1620 = 1:30AM–3:00AM) |
| 3 | `sat-castle-1300` | `title` | `?????????` | `Cavs Gong Bath` (times unchanged, 780–820 = 1:00PM–1:40PM) |
| 4 | `sun-castle-2330` | `title` | `?????????` | `Bullant` (times unchanged, 1410–1560 = 11:30PM–2:00AM) |
| 5 | `sat-castle-1200` | — | exists | **DELETED** |
| 5 | `sun-castle-1100` | — | absent | **ADDED** (see below) |
| 6 | `source` | string | `FOV2026_SCHEDULE_FINAL 7.26 poster + Timeland Workshops panel (owner-supplied 2026-07-30)` | `FOV2026_SCHEDULE_FINAL poster (fieldofvision.meadowcreekco.com/KBYG) + Timeland Workshops panel; poster re-transcribed 2026-08-11` |

Change 5 in full — the high school jazz band moved days, so this is the ONE case where an id
legitimately churns. Delete:

`{ "id": "sat-castle-1200", "date": "2026-08-15", "venue": "The Castle", "title": "Buena Vista High School Red Hots Jazz Band", "startMin": 720, "endMin": 760 },`

and add, in the Sunday block immediately BEFORE `sun-castle-1200` (Spacemoth) — it is the
earliest Sunday Castle event:

`{ "id": "sun-castle-1100", "date": "2026-08-16", "venue": "The Castle", "title": "Buena Vista High School Red Hots Jazz Band", "startMin": 660, "endMin": 700 },`

(poster: Sunday, The Castle, "BUENA VISTA HIGH SCHOOL RED HOTS JAZZ BAND 11:00AM–11:40AM")

</source_of_truth>

<decisions>

**D-1 — ids are permanent keys; four events keep a slug that no longer describes them.**
Friends' picks are stored in Supabase as arrays of these id strings and validated by
`sanitizeEventIds` at the read boundary, which drops unknown ids **silently** (by design —
see its doc comment). So `fri-castle-1300` keeps its id even though it now starts at 12:30,
and `fri-castle-0130` keeps its id under a different artist. The slug is an opaque key, not a
description. Renaming it to `fri-castle-1230` would be a silent data deletion, not a cleanup.

**D-2 — the jazz band is a delete + add, NOT a re-dated id.** It is the one event that
genuinely changed days. Do not "preserve" the pick by keeping id `sat-castle-1200` with a
Sunday date — that leaves a Saturday-named id in a Sunday column and confuses the next
transcriber. Accepted consequence: anyone who had already picked the Saturday jazz band loses
that pick and must re-pick it on Sunday. The set moved; the pick was for a slot that no longer
exists. Do not add migration code for this — there are fewer than 10 users and the picks UI is
one tap.

**D-3 — the test goes in FIRST, written from the table above, and must go RED.** Writing the
pinning test after the edit would be a tautology (assertions reverse-engineered from the file
you just wrote). Task 1 writes it from the transcription and proves it fails on the current
artifact; Task 2 makes it pass. This also proves each of the six deltas is real rather than
already-satisfied.

**D-4 — the two stale `Moktar` prose comments get refreshed.** `schedule.ts:8` uses Moktar as
its worked example of the past-midnight `>1440` convention and `schedule.test.ts:91` repeats
it next to `minToClock(1530)`. Same slot, new artist: both become `Nikki Nair`. Comments only —
no behavior, no event data.

**D-5 — `source` is pinned by a `toContain("re-transcribed 2026-08-11")` assertion.** Change 6
is a real requirement (provenance for the next person to open this file), and an unpinned
string change is an unverified one. Use the exact suggested value so the assertion holds.

</decisions>

<do_not_touch>

Changing anything in this list is a failure of the task, not a judgement call.

| Item | Why it must not change |
|---|---|
| Every event id except the `sat-castle-1200` delete / `sun-castle-1100` add | **D-1.** `sanitizeEventIds` silently drops unknown ids — an id rename is a silent deletion of every friend's pick for that set. |
| All `*-timeland-*` events | The poster does not cover the Timeland stage; that panel was NOT re-verified this session. Leave those lines byte-identical. |
| The `days` and `venues` arrays | Unchanged by the poster. `venues` already contains `The Castle`, so the added event needs no new venue. |
| Every event not named in the change table | All three days were checked against the poster and match. This is a surgical 6-line edit. |
| `FOV2026_SCHEDULE_FINAL.jpg` at the repo root | Untracked scratch download. Do NOT `git add` it and do NOT delete it. Stage the three files in `files_modified` **by path** — never `git add -A` / `git add .` in this task. |
| `packages/core/src/schedule/schedule.ts` logic (schema, `sanitizeEventIds`, `attendeesByEvent`, formatters) | Only the one prose comment on line 8 changes (D-4). No code. |
| The existing four `describe` blocks in `schedule.test.ts` | Add a new block; leave the shipped 7 assertions standing. |
| The file's formatting convention | One event object per line, blank line between day blocks. Do not reformat, re-indent, or re-sort the file. |

</do_not_touch>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pin the six poster deltas with a RED test, and refresh the stale Moktar comments</name>
  <files>packages/core/test/schedule/schedule.test.ts</files>
  <behavior>
    Written from the change table above, NOT from the artifact (D-3). Against the CURRENT
    artifact all three new `it` blocks must FAIL:
    - `fri-castle-1300` → title "Stu Mackenzie", startMin 750, endMin 820, date "2026-08-14", venue "The Castle"
    - `fri-castle-0130` → title "Nikki Nair", startMin 1530, endMin 1620
    - `sat-castle-1300` → title "Cavs Gong Bath", startMin 780, endMin 820
    - `sun-castle-2330` → title "Bullant", startMin 1410, endMin 1560
    - id-permanence guard: no event with id `fri-castle-1230` exists (the tempting rename)
    - no event with id `sat-castle-1200` exists
    - `sun-castle-1100` → date "2026-08-16", venue "The Castle", title "Buena Vista High School Red Hots Jazz Band", startMin 660, endMin 700
    - exactly ONE event titled "Buena Vista High School Red Hots Jazz Band" in the whole artifact
    - `artifact.source` contains "re-transcribed 2026-08-11"
  </behavior>
  <action>
Append one `describe("poster re-transcription 2026-08-11", ...)` block to
`packages/core/test/schedule/schedule.test.ts`, after the existing `fov-2026 schedule artifact`
block. Follow the file's existing idiom: the module-level `artifact` const is already parsed at
import; guard with `if (!artifact) throw new Error("artifact failed to parse")` the way the
duplicate-id test does, rather than non-null assertions.

Declare a local lookup helper inside the describe — `const eventById = (id: string) =>
artifact?.events.find((e) => e.id === id);` — and assert with `toMatchObject` so a missing
event fails cleanly instead of throwing on a property access.

Split into three `it` blocks so the RED run reports more than the first mismatch:
1. the four named/retimed Castle sets, plus the `fri-castle-1230` id-permanence guard;
2. the jazz band's Saturday→Sunday move (absent old id, present new id with all five fields,
   and exactly one event carrying that title);
3. the `source` provenance string.

Carry a short comment on the id-permanence guard stating WHY: `sanitizeEventIds` drops unknown
ids silently, so renaming `fri-castle-1300` to match its new 12:30 start would delete every
saved pick for that set (D-1). That comment is the reason this assertion survives the next
person's tidy-up instinct.

Also apply D-4 in this file: line 91's trailing comment
`// Moktar — Friday column, Saturday clock` becomes `// Nikki Nair — Friday column, Saturday
clock`. The 1530 value and the assertion itself do not change.

Do NOT touch the artifact JSON in this task.
  </action>
  <verify>
    <automated>npx vitest run --project @guezzer/core schedule</automated>
  </verify>
  <done>
Exit code is NON-ZERO. The three new `it` blocks fail; the 7 pre-existing assertions still
pass. Each failure message names a real delta from the change table (a "cannot read property
of undefined" crash means the helper is wrong, not that the test is RED for the right reason —
fix the helper).
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply the six poster deltas to the artifact and turn the suite GREEN</name>
  <files>data/schedule/fov-2026.json, packages/core/src/schedule/schedule.ts</files>
  <action>
Edit `data/schedule/fov-2026.json` with targeted per-line edits — six changes, exactly as the
change table specifies. Do not rewrite the file, do not reformat it, do not re-sort it, and do
not run it through a JSON formatter (one event object per line, blank line between day blocks,
is a deliberate convention that makes poster diffs readable).

1. Line 16 `fri-castle-1300`: `"title": "?????????"` → `"title": "Stu Mackenzie"`, and
   `"startMin": 780` → `"startMin": 750`. Leave `endMin: 820`, the date, the venue, and the id
   alone — especially the id (D-1).
2. Line 21 `fri-castle-0130`: `"title": "Moktar"` → `"title": "Nikki Nair"`. Times unchanged.
3. Line 42 `sat-castle-1300`: `"title": "?????????"` → `"title": "Cavs Gong Bath"`.
4. Line 69 `sun-castle-2330`: `"title": "?????????"` → `"title": "Bullant"`.
5. Delete line 41 entirely (`sat-castle-1200`, the jazz band) and insert the new
   `sun-castle-1100` line immediately before `sun-castle-1200` (Spacemoth, currently line 65)
   so it leads the Sunday Castle group — verbatim from the change table, trailing comma
   included. The Sched tab sorts by `startMin` at render (`ScheduleView.tsx:164`), so
   placement is for the next human reader, not for correctness — but get it right anyway.
6. Line 4 `source`: replace with
   `FOV2026_SCHEDULE_FINAL poster (fieldofvision.meadowcreekco.com/KBYG) + Timeland Workshops panel; poster re-transcribed 2026-08-11`
   exactly (Task 1's assertion pins the `re-transcribed 2026-08-11` substring).

Then apply the second half of D-4: in `packages/core/src/schedule/schedule.ts`, the module doc
comment on line 8 reads `(Moktar "Friday 1:30AM" → 1530)`. Change `Moktar` to `Nikki Nair`.
That is the only edit to this file — no code, no schema.

When staging, add the three files in `files_modified` by explicit path. `FOV2026_SCHEDULE_FINAL.jpg`
is an untracked scratch download that must stay untracked and must not be deleted, so `git add -A`
is forbidden here.
  </action>
  <verify>
    <automated>npx vitest run --project @guezzer/core schedule && npx tsc -p packages/core --noEmit</automated>
  </verify>
  <done>
All 10 assertions in the schedule test file pass (7 pre-existing + 3 new), core `tsc` is clean,
and `git status --short --untracked-files=all` still shows `?? FOV2026_SCHEDULE_FINAL.jpg`
untracked with only the three intended files modified.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Supabase `schedule_picks.event_ids` → app | A friend fully controls their own row under write-own RLS; every other signed-in user reads it. |
| Committed artifact → bundle | Build-time data, no runtime fetch; a malformed edit ships to every phone. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-UXW-01 | Tampering (self-inflicted) | `data/schedule/fov-2026.json` event ids | mitigate | Task 1's `fri-castle-1230` id-permanence assertion + D-1 comment; the only sanctioned id churn is the jazz band's day move. |
| T-UXW-02 | Denial of Service | `parseScheduleArtifact` | mitigate | A malformed/duplicate-id edit returns `null` and blanks the Sched tab for everyone. Already gated by the shipped parse + unique-id test, which Task 2's verify runs. |
| T-UXW-03 | Tampering | hostile `event_ids` payload referencing `sat-castle-1200` | accept | `sanitizeEventIds` drops unknown ids by design; a stale id is a no-op, not a fault. |
| T-UXW-SC | Tampering | supply chain | n/a | Zero package installs in this plan — no new dependency, no lockfile change. |
</threat_model>

<verification>
Run from the repo root (npm workspaces — **not** pnpm):

1. `npx vitest run --project @guezzer/core schedule` → 10 passed.
2. `npx tsc -p packages/core --noEmit` → clean, silent.
3. `npx tsc -p packages/app --noEmit` → clean (the app bundle-imports this artifact through the
   `@schedule` Vite alias).
4. `npm test` → full repo suite green (the app's `scheduleSync.test.ts` builds its allow-list
   from the real artifact via `scheduleEventIds()`).
5. `git status --short --untracked-files=all` → exactly three modified files plus the still-untracked
   `?? FOV2026_SCHEDULE_FINAL.jpg`.
</verification>

<success_criteria>
- The four Castle sets read Stu Mackenzie (12:30 start), Nikki Nair, Cavs Gong Bath, and Bullant.
- Zero `?????????` titles remain in the artifact.
- The jazz band exists exactly once, as `sun-castle-1100` on Sunday 11:00–11:40 AM.
- Every other event id in the file is unchanged from HEAD (`git diff` on the artifact shows six
  changed lines, one deletion, one insertion, and nothing else).
- No `days`, `venues`, or `*-timeland-*` line appears in the diff.
- Full suite green; `FOV2026_SCHEDULE_FINAL.jpg` neither committed nor deleted.
</success_criteria>

<output>
Create `.planning/quick/260811-uxw-update-fov-2026-schedule-artifact-from-o/260811-uxw-SUMMARY.md` when done.
</output>
