/**
 * Album-cover asset module (plan 06-05). The 29 committed 160×160 WebP thumbs
 * (fetched once at build time in plan 06-04) are resolved to their hashed
 * bundle URLs via `import.meta.glob` — the glob IS the source of truth, so this
 * stays manifest-agnostic: a slug with a committed `.webp` gets its URL, and any
 * slug WITHOUT one degrades to `null` so downstream renders the initials
 * placeholder (06-06) instead of a broken image (D-01/A2).
 *
 * The buckets (Covers / Miscellaneous) and any card album whose cover failed to
 * fetch carry no `.webp` by design → `null` → initials placeholder.
 */
const coverUrlBySlug: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("../assets/covers/*.webp", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([path, url]) => [
    // "../assets/covers/nonagon-infinity.webp" → "nonagon-infinity"
    path.slice(path.lastIndexOf("/") + 1).replace(/\.webp$/, ""),
    url,
  ]),
);

/**
 * `coverUrlFor(slug)` → the bundled cover URL for a slug with a committed
 * thumbnail, or `null` otherwise (the initials-placeholder signal). Never
 * throws.
 */
export function coverUrlFor(slug: string): string | null {
  return coverUrlBySlug[slug] ?? null;
}

/**
 * Every bundled cover URL (order = glob order). Used by the LiveGizz ambient
 * background (quick task 260717-02n) to pick a random cover without needing to
 * know slugs. Empty array if no covers are committed (background then no-ops).
 */
export function coverUrlList(): string[] {
  return Object.values(coverUrlBySlug);
}
