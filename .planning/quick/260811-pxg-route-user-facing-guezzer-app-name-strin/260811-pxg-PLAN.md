---
phase: quick-260811-pxg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/app/src/config.ts
  - packages/app/src/components/AppMenu.tsx
  - packages/app/src/components/AppShell.tsx
  - packages/app/src/auth/SignInScreen.tsx
  - packages/app/test/rebrand.test.ts
autonomous: true
requirements: [NAV-02]

must_haves:
  truths:
    - "Opening the top-right menu sheet shows the heading 'Gizz With Friends', not 'Guezzer'"
    - "Every user-visible error/warning line that names the app reads 'Gizz With Friends'"
    - "Existing installs keep their data — the Dexie database is still named `guezzer`"
    - "A future edit that hard-codes the app name anywhere under packages/app/src fails the test suite"
  artifacts:
    - path: "packages/app/src/config.ts"
      provides: "The single app-name owner: a module-private `APP_NAME` const exposed as `config.copy.appName`"
      contains: "appName"
    - path: "packages/app/test/rebrand.test.ts"
      provides: "Source-scan regression guard with an anti-vacuity half"
      contains: "readdirSync"
  key_links:
    - from: "packages/app/src/components/AppMenu.tsx"
      to: "config.copy.appName"
      via: "JSX text interpolation in the sheet heading"
      pattern: "config\\.copy\\.appName"
    - from: "packages/app/src/config.ts"
      to: "APP_NAME"
      via: "template literals inside the `copy` object"
      pattern: "\\$\\{APP_NAME\\}"
---

<objective>
Route every user-facing occurrence of the app name through ONE constant so the UI can never
again drift from the manifest name.

The product shipped as **"Gizz With Friends"** — that is the manifest `name`, the `<title>`, the
share-card wordmark, and all install copy. But seven user-facing strings still say **"Guezzer"**,
the loudest being the heading of the top-right menu sheet. The root cause is not a missed
find-and-replace: **there is no shared app-name constant**, so the name lives as scattered
literals, which is exactly the mechanism that let the manifest and the menu diverge.

Purpose: fix the seven strings AND remove the mechanism, so this defect class cannot recur.
Output: a `config.copy.appName` owner, every display site routed through it, and a source-scan
regression guard with a real anti-vacuity assertion.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/todos/pending/2026-08-10-app-name-still-says-guezzer-on-user-facing-surfaces.md
@packages/app/src/config.ts
@packages/app/src/components/AppMenu.tsx
@packages/app/test/rebrand.test.ts
@packages/app/test/bottomOverlayInset.test.tsx
</context>

<decisions>

**D-1 — the constant is module-private, exposed through `config.copy.appName`.**
`config.ts` is one `export const config = { ... } as const` literal spanning lines 20–1938. A
member of that literal cannot reference a sibling member, so `copy.appName` cannot be the thing the
other copy strings interpolate. The constant is therefore declared ABOVE the object as
`const APP_NAME = "Gizz With Friends";` and surfaced as `appName: APP_NAME` inside `copy`.
`APP_NAME` is deliberately NOT exported: the file's own header says "No other file under
packages/app/src should hardcode a copy string" — components read `config.copy.appName`, matching
every other copy consumer in the app. One owner, one read path.

**D-2 — display strings become template literals; the wordmark becomes a bare reference.**
`"Reopen Guezzer to try again."` becomes `` `Reopen ${APP_NAME} to try again.` ``.
`card.wordmark` is the whole name and nothing else, so it becomes `APP_NAME` with no template.
TypeScript infers template-literal *types* for template expressions inside a `as const` context, so
`config.copy.*` keeps its literal types and nothing downstream widens.

**D-3 — `storageNotProtected` is the one string whose WORDING changes, not just its name token.**
A mechanical swap yields "Your device may clear Gizz With Friends's data." — a possessive on a
three-word name, which reads badly. The string becomes
`` `Your device may clear your ${APP_NAME} data.` `` instead. Same meaning, no possessive. This is
the only reworded string; the other five wrong-name strings are pure token swaps.

**D-4 — the two already-correct component literals get routed too, and this is not scope creep.**
`AppShell.tsx:162` and `SignInScreen.tsx:128` render the bare JSX text `Gizz With Friends`. They are
the same defect class as `AppMenu.tsx:59` — a hard-coded app name in a component — and they are the
reason a "single owner" claim would otherwise be false. Task 3's single-owner assertion (the literal
appears in exactly one src file) is what makes this non-optional rather than a nice-to-have.

**D-5 — the guard extends `test/rebrand.test.ts`; it does not become a new file.**
That file already exists for exactly this discipline: it owns the `BRAND` constant, already asserts
the install copy does not say "Guezzer", and already carries the two `config.DB_NAME` "the rebrand
touched display strings only" assertions. A third `describe` block there is more discoverable than a
new file and keeps the test-file count at 140.

</decisions>

<do_not_touch>

Changing anything in this list is a failure of the task, not a judgement call.

| Site | Why it must not change |
|---|---|
| `packages/app/src/db/db.ts:324,462` — `GuezzerDB` class and the `db` instance | **NAV-02.** Routes, file paths and saved data keys stay untouched so no saved dex is orphaned. Renaming the Dexie class breaks every existing install. This is the whole reason NAV-02 exists. |
| `config.DB_NAME: "guezzer"` (config.ts:22) | Same. `rebrand.test.ts` already asserts this twice — leave both assertions standing. |
| `packages/app/vite.config.ts:93-95` (manifest `name`/`short_name`/`description`) | `rebrand.test.ts:35-36` asserts the **source text** `name: "Gizz With Friends"`. Routing it through an import breaks that test AND couples the build config to app source. It is already correct — leave it. |
| `packages/app/index.html:36` (`<title>`) | `rebrand.test.ts:30` asserts the **source text** of the tag. Already correct. |
| `packages/core/src/config.ts:31` — `userAgent: "Guezzer setlist tool (…)"` | An HTTP User-Agent for the volunteer-run kglw.net API (API-etiquette identity), not UI, and in `core` — outside this plan's scan root entirely. `packages/core/test/fetch.test.ts:67` pins it. |
| Comment-only mentions: `dex/shareCard.ts:133`, `settings/importPicker.ts:30`, `config.ts:519` | Prose, not UI. The guard strips comments before scanning, so they are invisible to it. |
| Repo name, directory names, package names | Out of scope. |

</do_not_touch>

<tasks>

<task type="auto">
  <name>Task 1: Give config.ts one app-name owner and route every name string through it</name>
  <files>packages/app/src/config.ts</files>
  <action>
Declare `const APP_NAME = "Gizz With Friends";` immediately above `export const config = {` (line
20), after the imports, with a short doc comment stating it is the single owner of the product name
in UI copy and naming the todo that created it. Do NOT export it (D-1). Keep the token `APP_NAME`
out of that comment's prose — the Done criteria below count occurrences and a comment mention
inflates them.

Add `appName: APP_NAME,` as the FIRST key inside the `copy: {` object (line 991), with a one-line
comment: every component that needs to render the product name reads `config.copy.appName`.

Then replace all fifteen name literals below with references to `APP_NAME`, per D-2. Six of them
currently say the WRONG name (the seventh reported occurrence is the `AppMenu` heading — Task 2);
nine already say the right one and are folded in so the constant is genuinely the single owner (D-4).

**Apply these by string match, not by line number** — inserting the const shifts every line below it.

Wrong name today (six of the seven the todo filed):

| Key | Becomes |
|---|---|
| `show.modelLoadFailureBody` | `` `Reopen ${APP_NAME} to try again.` `` |
| `settings.importErrorHeading` | `` `That's not a ${APP_NAME} backup.` `` |
| `settings.storageNotProtected` | `` `Your device may clear your ${APP_NAME} data.` `` — **reworded, see D-3** |
| `map.loadFailureBody` | `` `Reopen ${APP_NAME} to try again.` `` |
| `schedule.loadFailureBody` | `` `Reopen ${APP_NAME} to try again.` `` |
| `explore.errorBody` | `` `Reopen ${APP_NAME} to try again.` `` |

Note that "Reopen Guezzer to try again." is four distinct keys in four different copy blocks, not one
shared string — all four must be edited.

Already correct, folded into the constant:

| Key | Becomes |
|---|---|
| `auth.connectOnceBody` | `` `You're offline. Connect to Wi-Fi or data once to sign in — after that, ${APP_NAME} works fully offline.` `` |
| `installBanner.headline` | `` `Install ${APP_NAME}` `` |
| `installCta` | `` `Install ${APP_NAME}` `` |
| `installUnavailable` | `` `${APP_NAME} can't auto-install here — add it from your browser menu instead.` `` |
| `install.sectionBody` | `` `Install ${APP_NAME} on your home screen so it works offline at the show — and so your saved dex is safer.` `` |
| `install.androidCta` | `` `Install ${APP_NAME}` `` |
| `install.unavailable` | `` `${APP_NAME} can't auto-install here — add it from your browser menu instead.` `` |
| `iosInstall.heading` | `` `Add ${APP_NAME} to your Home Screen` `` |
| `share.card.wordmark` | `APP_NAME` — bare reference, no template (D-2) |

Preserve the surrounding punctuation **byte for byte**: these strings contain em dashes and
typographic apostrophes. Copy the existing text and swap only the name token; do not retype the
sentence and do not normalise `—` to `--` or `'` to `'`. Apostrophes need no escaping inside
backticks, and none of these strings contain a backtick or a `${` sequence.

Leave the deliberate `installCta`/`install.androidCta` duplication in place — the comment above
`install` (config.ts:1046-1061) explains that `InstallBanner` still reads both and that deleting
either breaks it. Routing both through `APP_NAME` is the whole point; collapsing them is not.

Do not touch `config.DB_NAME`, and do not touch the `Gizz With Friends` mention in the block comment
at config.ts:519 (it is prose about the wordmark colour).
  </action>
  <verify>
    <automated>npx tsc -b packages/core packages/app</automated>
  </verify>
  <done>
`tsc` exits 0, and these four greps over `packages/app/src/config.ts` hold:
`grep -c '\${APP_NAME}'` is **14** (every interpolated copy string);
`grep -c 'wordmark: APP_NAME'` is **1**;
`grep -c 'appName: APP_NAME'` is **1**;
`grep -c 'Guezzer'` is **0**.
  </done>
</task>

<task type="auto">
  <name>Task 2: Route the three component-level app-name literals through config.copy.appName</name>
  <files>packages/app/src/components/AppMenu.tsx, packages/app/src/components/AppShell.tsx, packages/app/src/auth/SignInScreen.tsx</files>
  <action>
Replace the hard-coded name in each component's JSX with `{config.copy.appName}`. **All three files
already import `config`** (`AppMenu.tsx:2`, `AppShell.tsx:6`, `SignInScreen.tsx:26`) — add no
imports.

- `AppMenu.tsx:59` — the bare text `Guezzer` inside the `<span className="text-[20px] font-semibold
  leading-tight text-text-primary">` that is the menu sheet's heading. This is the user-visible
  headline defect: the first line of a sheet the user opens deliberately.
- `AppShell.tsx:162` — the bare text `Gizz With Friends` inside the header `<span>`. Already
  correct; routed for single-ownership (D-4).
- `SignInScreen.tsx:128` — the bare text `Gizz With Friends` inside the `<h1>`. Already correct;
  routed for single-ownership. Note this file destructures `const copy = config.copy.auth;` at
  line 32 — `appName` lives on `config.copy`, NOT on `config.copy.auth`, so write
  `{config.copy.appName}` here, not `{copy.appName}`. Do not add an `appName` key to the `auth`
  block; that would recreate the duplication this plan exists to delete.

Change nothing else in these files — no className edits, no element restructuring, no comment
rewrites. Every one of these is a text-node swap.
  </action>
  <verify>
    <automated>npx tsc -b packages/core packages/app && npx vitest run rebrand.test</automated>
  </verify>
  <done>`tsc` exits 0 and the existing `rebrand.test.ts` suite is green. `grep -rn 'Guezzer' packages/app/src --include=*.tsx` returns nothing. Each of the three files contains exactly one `config.copy.appName`.</done>
</task>

<task type="auto">
  <name>Task 3: Add the single-owner source-scan guard and run the full gates</name>
  <files>packages/app/test/rebrand.test.ts</files>
  <action>
Append a third `describe` block to `packages/app/test/rebrand.test.ts` (D-5) named for the todo it
closes, e.g. `describe("App name has exactly one owner (todo 2026-08-10 / NAV-02)", ...)`.

**Copy the two source-walk helpers from `test/bottomOverlayInset.test.tsx:603-628` verbatim** —
`stripComments(source)` and `sourceFiles(dir, prefix)` — along with the `SRC_DIR` /
`SCANNED_EXTENSIONS` constants at lines 599-601. Copying is the established repo idiom here:
`bottomSpace.test.ts` and `bottomOverlayInset.test.tsx` each carry their own copy with an
attribution comment naming the source. Do the same; do NOT extract a shared helper module (that
would touch three files to save nine lines and is outside this plan's scope). Add
`readdirSync, statSync` to the existing `node:fs` import at line 1.

Two facts about those helpers that the assertions depend on:
- `sourceFiles` builds its relative paths with a literal `/` separator, so `"db/db.ts"` and
  `"components/AppMenu.tsx"` are the correct keys **on Windows too**.
- `stripComments` blanks `/* */` blocks and `//` lines, which is precisely what makes the four
  comment-only mentions (`shareCard.ts`, `importPicker.ts`, `config.ts:519`, and the new `APP_NAME`
  doc comment) invisible to the scan.

Write a `scanSrc(token)` helper returning `{ files, hits }` where `files` is the full walked list
and `hits` is a `Map<string, number>` of relative path to occurrence count of `token` in the
comment-stripped source. Then four `it` blocks:

1. **Anti-vacuity — the scan actually walked and actually matched.** This must come FIRST and its
   comment must say why: without it, a broken walk or a swallowed read empties `hits` and turns
   every assertion below into a permanently-green, permanently-meaningless tautology. Assert
   `files.length` is greater than 100 (the same threshold the shipped
   `bottomOverlayInset.test.tsx:664` guard uses, so it is known-satisfiable); assert `files` contains
   `"config.ts"`, `"components/AppMenu.tsx"`, `"components/AppShell.tsx"`, `"auth/SignInScreen.tsx"`
   and `"db/db.ts"` — the five files this change touches or exempts, proving the walk reached them;
   and assert `scanSrc("Guezzer").hits.get("db/db.ts")` is at least 2, which proves the **token
   matcher itself fires** (not merely that files were read). That last assertion is the load-bearing
   one: a file count alone cannot catch a matcher that never matches.

2. **No "Guezzer" outside the Dexie class.** Assert the sorted key list of `scanSrc("Guezzer").hits`
   equals exactly `["db/db.ts"]`. Comment it with the NAV-02 reason `db/db.ts` is exempt — renaming
   the persisted DB orphans every friend's saved dex — so a future reader cannot mistake the
   exemption for an oversight.

3. **The brand literal has exactly one owner.** Assert the sorted key list of
   `scanSrc(BRAND).hits` equals exactly `["config.ts"]`, and that `hits.get("config.ts")` is exactly
   1 — the `APP_NAME` declaration and nothing else. This is the assertion that guards the ROOT
   CAUSE: it makes re-introducing a hard-coded app name anywhere in `src/` unmergeable.

4. **The owner is wired to the surfaces.** Assert `config.copy.appName` is `BRAND`, then read the
   source of `AppMenu.tsx`, `AppShell.tsx` and `SignInScreen.tsx` and assert each contains
   `config.copy.appName`. Assertion 3 proves nobody hard-codes the name; only this one proves the
   surfaces still RENDER it rather than rendering nothing. Use the same `readFileSync` source-read
   idiom the file already uses for its D-44 `DexView.tsx` assertion (lines 128-145).

Leave all existing assertions in `rebrand.test.ts` untouched — in particular both
`expect(config.DB_NAME).toBe("guezzer")` assertions (lines 55 and 119) stay exactly as they are.

Finally, run the full gates and then produce a fresh verification build per CLAUDE.md's standing
convention: `rm -rf packages/app/dist`, `npm run build -w @guezzer/app`, then
`npm run preview -w @guezzer/app -- --port 4179 --strictPort` in the background — **a port not used
before in this session**, because the app ships `registerType: 'prompt'` and a reused port serves
whatever shell its service worker already cached. Prove the served build is the new one before
handing over the URL: `curl -s http://localhost:4179/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'`
must match a file in `ls packages/app/dist/assets/`.
  </action>
  <verify>
    <automated>npx vitest run && npx tsc -b packages/core packages/app</automated>
  </verify>
  <done>
Full suite green at **140 test files** (unchanged — the guard extends an existing file) and
**1227 + N tests** where N is the number of `it` blocks added (4 if written as described, so 1231),
zero failures. `tsc` exits 0.
`grep -rn "Guezzer" packages/app/src --include=*.ts --include=*.tsx` returns only `db/db.ts:324`,
`db/db.ts:462`, `shareCard.ts:133` and `importPicker.ts:30` — the Dexie class plus two comments.
Preview server answers on 4179 with an asset hash matching `packages/app/dist/assets/`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Every changed value is a static UI copy string. No changed string interpolates user, friend, or API input — the only interpolated value is a module-private compile-time constant. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-PXG-01 | Tampering | `config.DB_NAME` / `GuezzerDB` (persisted IndexedDB identity) | mitigate | The real hazard in an app-name change is a rename that reaches storage and orphans every install's dex (NAV-02). Mitigated three ways: the `<do_not_touch>` table names both sites; the two shipped `expect(config.DB_NAME).toBe("guezzer")` assertions stay standing; and Task 3's guard allow-lists `db/db.ts` as the sole permitted "Guezzer" site, so removing the exemption fails loudly instead of silently. |
| T-PXG-02 | Injection / Information disclosure | new template literals in `config.ts` | accept | `${APP_NAME}` resolves at build time from a module-private const. No runtime value, no friend-crossing string, and no HTML — these render as React text and canvas `fillText` exactly as the string literals they replace did. No new surface. |
| T-PXG-SC | Tampering | npm / pip / cargo installs | accept | Zero package installs in this plan. No Package Legitimacy Gate applies; no `[ASSUMED]`/`[SUS]` packages exist to check. |
</threat_model>

<verification>

**Automated (blocking, run by the executor):**
- `npx vitest run` — 140 files, 1227 + N tests, zero failures. Baseline was 140/1227.
- `npx tsc -b packages/core packages/app` — exit 0. **Use the scoped form**; a bare `npx tsc -b`
  fails in this repo and is not evidence of anything.
- `grep -rn "Guezzer" packages/app/src --include=*.ts --include=*.tsx` — only `db/db.ts` (×2) and
  the two comment lines.

**Human check (non-blocking, one look):**

<verify>
  <human-check>
    Open the preview URL on 4179 and confirm the tab strip reads **Live · GizzVerse · Map · Sched ·
    Me · Games** (six tabs — this proves you are looking at the current build, not a cached shell).
    Then tap the top-right Menu button. The sheet's first line must read **Gizz With Friends**.
  </human-check>
</verify>

</verification>

<success_criteria>
- No user-facing surface under `packages/app/src` renders the string "Guezzer".
- The product name exists as exactly ONE literal in `packages/app/src`: the `APP_NAME` declaration
  in `config.ts`. Every display site reads `config.copy.appName` or interpolates `APP_NAME`.
- `config.DB_NAME` is still `"guezzer"` and `GuezzerDB` is unrenamed — no existing install's dex is
  orphaned (NAV-02).
- `test/rebrand.test.ts` fails if either literal is re-introduced anywhere in `src/`, and its
  anti-vacuity assertion proves the scan walked >100 files AND that its token matcher fires.
- Full suite green, `tsc` exit 0.
</success_criteria>

<output>
Create `.planning/quick/260811-pxg-route-user-facing-guezzer-app-name-strin/260811-pxg-SUMMARY.md` when done.
Move `.planning/todos/pending/2026-08-10-app-name-still-says-guezzer-on-user-facing-surfaces.md` to
`.planning/todos/done/` as part of the closing commit.
</output>
</content>
