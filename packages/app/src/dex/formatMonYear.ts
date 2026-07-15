/**
 * Format an ISO date ("2025-01-15") as "Mon YYYY" ("Jan 2025") for the dex song
 * sublines and the WhyDetail corpus line (06-06, STAT-01/03). Parsed in UTC so a
 * "2025-01-01" never slips to "Dec 2024" in a negative-offset timezone. Shared by
 * SongRow + WhyDetail so the phrasing stays identical.
 */
const MON_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatMonYear(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : MON_YEAR.format(date);
}
