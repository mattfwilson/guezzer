---
created: 2026-08-10T00:00:00.000Z
title: App name still reads "Guezzer" on user-facing surfaces after the rename
area: copy
resolves_phase:
files:
  - packages/app/src/components/AppMenu.tsx
  - packages/app/src/config.ts
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
