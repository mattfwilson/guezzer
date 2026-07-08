/**
 * D-12: post-fetch filter assertion.
 *
 * The kglw.net API silently ignores invalid filter paths — returning the
 * entire unfiltered table instead of an error or an empty result
 * (docs/SCHEMA.md §9). This is the only defense: after every filtered
 * fetch, assert that every returned row actually matches the requested
 * filter, or hard-fail naming the endpoint, field, expected/actual values,
 * and an example row.
 *
 * This error-message convention (endpoint/field, expected vs. actual, and
 * an example row) is the project-wide failure-UX convention every later
 * ingestion phase copies.
 */
export function assertFilterApplied<T>(
  rows: T[],
  endpoint: string,
  filter: { field: keyof T & string; expected: unknown },
): void {
  const bad = rows.find((r) => r[filter.field] !== filter.expected);
  if (bad !== undefined) {
    const actual = (bad as Record<string, unknown>)[filter.field];
    throw new Error(
      `FILTER NOT APPLIED by ${endpoint}: requested ${filter.field}=${String(filter.expected)} ` +
        `but got row with ${filter.field}=${String(actual)}. ` +
        `The kglw.net API silently ignores invalid filters — check the URL path. ` +
        `Example row: ${JSON.stringify(bad).slice(0, 200)}`,
    );
  }
}
