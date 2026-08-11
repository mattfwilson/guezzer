---
created: 2026-08-10T00:00:00.000Z
title: App name still reads "Guezzer" on user-facing surfaces after the rename
area: copy
resolves_phase:
resolved: 2026-08-11
resolved_by: 260811-pxg
files:
  - packages/app/src/components/AppMenu.tsx
  - packages/app/src/config.ts
  - packages/app/src/components/AppShell.tsx
  - packages/app/src/auth/SignInScreen.tsx
  - packages/app/test/rebrand.test.ts
---

## Problem

The product is called **"Gizz With Friends"** — that is what the manifest `name`, the share-card
wordmark, and every install string say. But seven user-facing places still say **"Guezzer"**:

| Location | String |
|---|---|
| `AppMenu.tsx:59` | `Guezzer` — hard-coded, the **heading of the top-right menu sheet** |
| `config.ts:1178` | "Reopen Guezzer to try again." |
| `config.ts:1236` | "That's not a Guezzer backup." |
| `config.ts:1241` | "Your device may clear Guezzer's data." |
| `config.ts:1854` | "Reopen Guezzer to try again." |
| `config.ts:1875` | "Reopen Guezzer to try again." |
| `config.ts:1935` | "Reopen Guezzer to try again." |

The `AppMenu` one is the most visible: it is the first line of a sheet users open deliberately.

**These were never in scope for the rename that shipped.** Phase 21's NAV-01/NAV-02 renamed the
**bottom tabs** ("The bottom tabs read Live · GizzVerse · Map · Me · Games"), not the app name, so
nothing swept these. No planning decision retaining "Guezzer" in the UI was found.

**Root cause: there is no shared app-name constant.** The name is scattered as literals, which is
exactly how the manifest and the menu drifted apart. Grep for `appName`/`APP_NAME`/`productName` in
`packages/app/src/config.ts` returns nothing.

## Evidence

- `grep -rn "Guezzer" packages/app/src --include=*.ts --include=*.tsx` — the seven above, plus the
  non-UI hits listed under "Do not change".
- `packages/app/src/config.ts:1039,1043,1069` — `"Install Gizz With Friends"`, the shipped name.
- `packages/app/dist/manifest.webmanifest` — `"name": "Gizz With Friends"`.

## Do NOT change

- **`GuezzerDB` in `packages/app/src/db/db.ts:324,462`.** NAV-02 requires routes, file paths and
  saved data keys stay untouched so no saved dex is orphaned. Renaming the Dexie class would break
  every existing install. This is the whole reason NAV-02 exists.
- Comments and internal identifiers (`shareCard.ts:133`, `importPicker.ts:30`) — prose only.

## Solution

Add one exported constant (e.g. `config.copy.appName = "Gizz With Friends"`) and route all seven
display strings through it, so the manifest and the UI can never drift again. Roughly a 2-minute
change plus a test that the literal `"Guezzer"` appears nowhere under `src/` except `db.ts`.

Severity is **cosmetic** — it was deliberately not fixed during the 2026-08-10 deploy prep, since
it is copy-only and the deploy was time-boxed.

## Resolution (quick task 260811-pxg)

Delivered by quick task `260811-pxg` in three commits: `4781203` (the constant + fifteen config
strings), `afc493c` (the three component literals), `94897c0` (the guard).

The fix took the **root cause**, not just the seven strings. `packages/app/src/config.ts` now
declares one module-private `APP_NAME` const above the config literal, surfaced as
`config.copy.appName`. All fifteen name-bearing copy strings interpolate it — the six that said the
old name **and** the nine that already said the right one, because a "single owner" claim is false
while any correct copy is still an independent literal. `AppMenu.tsx` (the headline defect),
`AppShell.tsx` and `SignInScreen.tsx` render `{config.copy.appName}`.

One wording change beyond a token swap: `settings.storageNotProtected` became "Your device may
clear your Gizz With Friends data." A mechanical swap would have produced a possessive on a
three-word name.

`test/rebrand.test.ts` gained a third `describe` block that walks comment-stripped `src/` and
asserts the brand literal appears in **exactly one** file, exactly once — so re-introducing a
hard-coded app name anywhere under `src/` is unmergeable — plus that the three surfaces still read
`config.copy.appName` (deleting the text node cannot satisfy the count assertion alone). Its
anti-vacuity half was proven discriminating by two temporary probes, not assumed green.

`config.DB_NAME` is still `"guezzer"` and `GuezzerDB` is unrenamed — the "Do NOT change" list above
was honoured, and the guard now allow-lists `db/db.ts` as the sole permitted site so removing that
exemption fails loudly instead of silently orphaning saved dexes.
