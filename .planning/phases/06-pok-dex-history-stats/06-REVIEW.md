---
phase: 06-pok-dex-history-stats
reviewed: 2026-07-16T19:30:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - packages/app/src/dex/CoverThumb.tsx
  - packages/app/src/dex/AlbumGrid.tsx
  - packages/app/src/dex/AlbumDetail.tsx
  - packages/app/vite.config.ts
  - packages/app/scripts/fetch-covers.ts
  - packages/app/src/assets/covers/covers-manifest.json
  - packages/app/test/dexView.test.tsx
  - packages/app/test/fetchCovers.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 6: Code Review Report (incremental — 06-12 gap closure)

**Reviewed:** 2026-07-16T19:30:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

> Supersedes the 2026-07-15 full-phase review (56 files, all findings resolved). This
> incremental pass covers only the 06-12 gap-closure changes since `0fa4f40`.

## Narrative Findings (AI reviewer)

## Summary

Incremental review of the 06-12 gap-closure changes: the shared `CoverThumb` img-or-initials component and its integration into `AlbumGrid`/`AlbumDetail`, the `webp` workbox glob addition, the `findReleaseGroupMbid` Album-preference fix, the refreshed `phantom-island` manifest entry, and the two new test suites.

Verified clean:

- **vite.config.ts** — `registerType: "prompt"` is preserved (CLAUDE.md hard rule). The `webp` glob claim checks out: 29 committed `.webp` files totaling 202,604 bytes (~198 KB), matching the "~195 KB / 29 assets" comment, and the referenced budget guard `packages/app/test/coversManifest.test.ts` exists with the 25 KB per-file and 350 KB total assertions. `json` remains correctly excluded.
- **CoverThumb integration** — both call sites source `px` from `config.dex.ALBUM_ART_DISPLAY_PX` (config single-source rule); the `data-testid="album-cover"` contract is preserved across the img and placeholder branches; the §B4 dim classes ride the passthrough onto whichever branch renders (pinned by the new dexView tests). Album/title strings render as React text only.
- **covers-manifest.json** — well-formed, key-sorted, trailing newline, all 29 entries carry coverartarchive.org provenance; the only content change is the refreshed `phantom-island` entry (new MBID, 2026-07-16 fetchedAt) matching the re-encoded 7,918-byte `.webp` (under the 25 KB budget).
- **fetch-covers.ts etiquette** — the change does not alter pacing, User-Agent, or the no-auto-retry contract; the script remains manual-only.

Two Warnings: the Album-preference fix over-corrects (it prefers an Album-typed group at *any* score over a top-scored exact match, which can regress EP covers on a `--force` re-run), and the shared `CoverThumb` carries a sticky `failed` state that renders the wrong branch if any future call site reuses the component across slug changes.

## Warnings

### WR-01: Album preference in `findReleaseGroupMbid` is unbounded by score — a low-scored Album can beat a top-scored exact-match EP

**File:** `packages/app/scripts/fetch-covers.ts:134-135`
**Issue:** The Phantom Island bug was a score-100 *tie* (Single listed before Album). The fix, however, scans the entire result list:

```ts
const album = groups.find((group) => group["primary-type"] === "Album");
return (album ?? groups[0]).id;
```

MusicBrainz returns every release group whose title matches the phrase query, ordered by descending score — including low-scored partial matches. In MB taxonomy, `primary-type: "Album"` also covers live albums and compilations (those are *secondary* types), and King Gizzard has dozens of them. If a search for an EP-typed card (e.g., "Willoughby's Beach", "Teenage Gizzard" — the code's own comment notes several committed covers are intentionally non-Album release groups) ever returns *any* Album-typed group lower in the list (e.g., a live album or compilation whose title contains the phrase), this code silently fetches that wrong art instead of the top-scored exact match. The doc comment's claim that the `groups[0]` fallback protects EPs only holds when *no* Album-typed group appears anywhere in the results — a weaker guarantee than intended. Triggerable today via `--force` and for every future EP added to the shelf.

The new regression suite pins `[EP:100, Single:97] → EP` but never tests `[EP:100, Album:<100]`, which is exactly the case this implementation gets wrong.

**Fix:** Restrict the Album preference to groups tied at the top score — this still fixes Phantom Island (a 100/100 tie) and cannot demote a strictly better match:

```ts
const topScore = groups[0].score;
const album = groups.find(
  (group) => group["primary-type"] === "Album" && group.score === topScore,
);
return (album ?? groups[0]).id;
```

Add a regression test in `fetchCovers.test.ts`: `[{ id: "ep-mbid", score: 100, "primary-type": "EP" }, { id: "album-mbid", score: 55, "primary-type": "Album" }]` must resolve to `ep-mbid`.

### WR-02: `CoverThumb.failed` state is sticky across `slug` changes — latent wrong-render in the shared component

**File:** `packages/app/src/dex/CoverThumb.tsx:43-44`
**Issue:** `failed` is set once on `onError` and never reset. If a mounted `CoverThumb` instance receives a *different* `slug` prop (React reuses the instance when position and key are unchanged), a prior load failure permanently forces the initials placeholder for a slug whose image would load fine — the exact broken-visual class of bug this component was extracted to prevent. Today's two call sites dodge it by accident: `AlbumGrid` keys each `AlbumCard` by stable `item.key`, and `AlbumDetail` fully unmounts between opens (`openAlbumKey` returns to `null` via `onBack` in DexView). Nothing in the component itself enforces that contract, and it is explicitly documented as "the SINGLE img-or-placeholder block" for future reuse.
**Fix:** Reset the flag when the slug changes (render-time state reset — no effect needed):

```tsx
const [failedSlug, setFailedSlug] = useState<string | null>(null);
const failed = failedSlug === slug && slug != null;
// ...
onError={() => setFailedSlug(slug)}
```

Alternatively, require `key={slug}` at call sites — but the in-component reset is self-contained and cannot be forgotten by the next consumer.

## Info

### IN-01: `dimClass` prop name is misleading — AlbumDetail passes a layout class through it

**File:** `packages/app/src/dex/CoverThumb.tsx:39`, `packages/app/src/dex/AlbumDetail.tsx:65`
**Issue:** The prop is named and documented as "§B4 dimming," but `AlbumDetail` passes `shrink-0` (flex layout) through it. The header comment papers over this ("dimClass is a className passthrough"), but the name actively misdirects the next reader.
**Fix:** Rename the prop to `className` — it is a generic passthrough applied to whichever branch renders.

### IN-02: `initialsFor` produces empty/degenerate initials for whitespace-leading or symbol-only words

**File:** `packages/app/src/dex/CoverThumb.tsx:24-30`
**Issue:** `title.split(/\s+/)` yields a leading `""` element for a title with leading whitespace (`"".charAt(0)` → `""`). Titles are build-frozen kglw-derived strings and currently all safe, but the helper is one `.filter` away from robust.
**Fix:** `title.split(/\s+/).filter(Boolean).slice(0, 2)...`

### IN-03: Unescaped double quote in title would corrupt the Lucene query (pre-existing; function touched this change)

**File:** `packages/app/scripts/fetch-covers.ts:115`
**Issue:** `releasegroup:"${title}"` — a title containing `"` would break out of the quoted phrase and produce an invalid/altered Lucene query. No current dex-albums title contains a double quote, and the failure mode is a loud HTTP-error throw rather than silent wrong art, so this is informational.
**Fix:** Escape before interpolating: `const safe = title.replace(/(["\\])/g, "\\$1");`

### IN-04: albumUrl → slug derivation duplicated in three places

**File:** `packages/app/src/dex/AlbumGrid.tsx:37-39`, `packages/app/src/dex/DexView.tsx:58`, `packages/app/scripts/fetch-covers.ts:92-94`
**Issue:** The "last path segment of albumUrl is the cover-asset slug" contract is implemented independently in `AlbumGrid.slugForAlbumUrl`, inline in `DexView.resolveOpenAlbum`, and via `basename()` in the fetch script. A divergence between any two copies silently degrades covers to initials placeholders — no error surfaces, per the `coverUrlFor` null contract.
**Fix:** Export a single `slugForAlbumUrl` from `covers.ts` (already the cover-asset source-of-truth module) and use it in both UI files; the Node script may keep `basename` (different runtime), but the two app-side copies should collapse to one.

---

_Reviewed: 2026-07-16T19:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
