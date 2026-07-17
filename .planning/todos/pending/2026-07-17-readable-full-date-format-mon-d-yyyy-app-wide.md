---
created: 2026-07-17T04:53:38.732Z
title: Readable full-date format "Mon D, YYYY" app-wide
area: ui
files:
  - packages/app/src/dex/formatMonYear.ts
  - packages/app/src/show/ShowView.tsx
  - packages/app/src/dex/ShowsList.tsx
  - packages/app/src/dex/SetlistView.tsx
  - packages/app/src/dex/ArchiveBrowser.tsx
  - packages/app/src/dex/shareCard.ts
  - packages/app/src/dex/RecapView.tsx
---

## Problem

Full calendar dates render as raw ISO (`2026-07-17`) in several places. Owner
wants a readable **"Mon D, YYYY"** format (e.g. `Jan 2, 2026`) throughout.

## Solution

Add ONE shared helper mirroring the existing `formatMonYear.ts` (same
**UTC-safe** pattern — critical, see pitfall) and route every full-date render
through it:

```ts
// sibling of formatMonYear (or a shared date-format module)
const FULL_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});
export function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : FULL_DATE.format(d);
}
// "2026-01-02" -> "Jan 2, 2026"  ✓ matches the owner example
```

### Render sites to convert (raw ISO → formatFullDate)

- `show/ShowView.tsx` — the in-show sub-header show date (`session.active.date`,
  ~line 302).
- `dex/ShowsList.tsx:199` — `{row.date}` history rows.
- `dex/SetlistView.tsx:146` — `{resolved.date}` (and the `aria-label` at :128).
- `dex/ArchiveBrowser.tsx:190` — `{show.date}` (and the `aria-label` at :230).
- `dex/RecapView.tsx:110` — passes `show?.date` into `config.copy.dex.subline`
  (`config.ts:562`); format the date BEFORE passing it in (keep the copy fn
  taking a display string).
- `dex/shareCard.ts:117` — the share-card PNG date line (`data.latestShow.date`).
  Canvas draws a plain string, so the same helper works.

### ⚠️ Timezone pitfall (do NOT skip)

`new Date("2026-07-17")` parses as **UTC midnight**; formatting in local time can
slip to the previous day in negative-offset zones (`Jul 16`). The existing
`formatMonYear` already guards this with `timeZone: "UTC"` — the new helper MUST
do the same. Reuse the pattern, don't hand-roll.

### Scope decision — the coarse month/year displays

Leave these unless the owner says otherwise (they're intentionally coarse, no
specific day):
- `formatMonYear` usages: SongRow "last seen" subline + WhyDetail corpus line
  (`Jul 2026`) — a day would imply false precision for "last seen".
- ArchiveBrowser **year group headers** and any `groupShowsByYear` labels.

If the owner wants those switched to full dates too, that's a follow-up — the
owner's example ("Jan 2, 2026") has a day, which reads oddly for a "last seen
this month" stat, so default to leaving them.

## Acceptance

- Every full show/setlist/recap/share-card date reads `Mon D, YYYY`.
- No off-by-one-day shifts in any timezone (UTC formatting).
- One shared helper; no per-site `toLocaleDateString`/`Intl` re-rolls.
- Tests asserting raw-ISO date text updated; typecheck + tests + share-card render
  check pass.
