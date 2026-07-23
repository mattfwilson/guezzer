# Phase 19: Shared Dex Progress - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 13 (7 new, 3 modified, 3 new tests/tables counted with their module)
**Analogs found:** 13 / 13 (every surface echoes a shipped file — this is a "reuse, don't reinvent" phase)

> **HARD CONSTRAINT (repeated up top so no plan misses it):** `FriendDetail` must reach the **UNCHANGED** `compareDexes` (`packages/core/src/dex/compare.ts`) by feeding it a `theirs: DexStats` built by the new `reconstructDexStats`. `CompareView.tsx` stays byte-for-byte untouched (D-09). `packages/core` must import **zero** Supabase/DOM — guarded by `packages/core/test/purity.test.ts` (static scan for `@supabase/`, `createClient`, `document.`, `localStorage`, `navigator.`, etc.). The new core projector must also carry **no `Date.now()`** — it is a pure fn of `DexStats`; the app stamps `updated_at`/`fetchedAt`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/dex/shared-progress.ts` | core projector + schema | transform (pure) | `packages/core/src/dex/share-stats.ts` (`buildShareStats`) + `compare.ts` (read-set) + `derive-dex.ts` (`DexStats` target) + `dex/archive-types.ts` (zod idiom) | exact |
| `packages/core/src/index.ts` (MODIFY) | barrel export | — | existing `compareDexes` / `deriveDex` export blocks (lines 199–229) | exact |
| `packages/core/test/dex/shared-progress.test.ts` | test | — | `packages/core/test/dex/share-stats.test.ts` + fixtures `test/fixtures/dex/synthetic.ts` | exact |
| `packages/app/src/sync/progressSync.ts` | service (sync fence) | pub-sub + CRUD | `db/supabase.ts` singleton + blueprint `multi-user-supabase.md` §"Durable shared progress" | role-match (first data consumer) |
| `packages/app/src/sync/useFriendsProgress.ts` | hook | event-driven | `dex/useDexStats.ts` (liveQuery→derive hook shape) + `live/useOnlineStatus.ts` (external-store) | role-match |
| `packages/app/src/sync/friendCache.ts` | Dexie table + helpers | file-I/O (IndexedDB) | `db/db.ts` (versioned additive store + module write helpers) | exact |
| `packages/app/src/dex/DexView.tsx` (MODIFY) | view host | — | its own `Albums \| Shows` segment toggle (lines 96–114) | exact (self) |
| `packages/app/src/dex/FriendsList.tsx` | component (list) | request-response | `dex/ShowsList.tsx` (list + pure row-builder + empty state) | exact |
| `packages/app/src/dex/FriendRow.tsx` | component (row) | — | `dex/ShowsList.tsx` row `<button>` (lines 221–255) + `TierBadge` + `IdentityAvatar` glyph | role-match |
| `packages/app/src/dex/SelfRow.tsx` | component (row) | — | `FriendRow` shape, sourced from `useDexStats` (D-02) | role-match |
| `packages/app/src/dex/FriendDetail.tsx` | component (overlay) | request-response | `dex/CompareView.tsx` (Sheet + StatColumn + DiffSection) — **echo, never import/edit** | exact |
| `packages/app/src/dex/RarestShowcase.tsx` | component | — | `dex/DexHeader.tsx` rarest subline (lines 30–68) + `TierBadge` | role-match |
| `packages/app/src/config.ts` (MODIFY) | config | — | existing `config.copy.compare` (lines 1315–1346) + `config.dex.tierColors` + `config.auth.IDENTITY_COLORS` | exact (self) |

---

## Pattern Assignments

### `packages/core/src/dex/shared-progress.ts` (core projector, transform)

**Analog:** `packages/core/src/dex/share-stats.ts` (`buildShareStats`), `compare.ts` (the read-set contract), `derive-dex.ts` (reconstruction target), `archive-types.ts` (zod idiom).

**Projector idiom to mirror** — `buildShareStats` (share-stats.ts:121–159) is a pure projection of `DexStats`, iterating `dex.perSong`, reading `dex.completion` / `dex.showCount` / `dex.rarestCatch` straight through. Copy this shape exactly (no I/O, no `Date.now()`, `cfg` default param only if needed):
```ts
export function buildShareStats(dex: DexStats, archive: ArchiveArtifact): CollectionShareCard {
  const counts = new Map<ShareTier, number>();
  for (const stat of dex.perSong.values()) {
    const tier: ShareTier = stat.tier ?? "debut";
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }
  return {
    scope: "collection",
    completionPct: dex.completion.pct,
    caught: dex.completion.caught,
    total: dex.completion.total,
    showCount: dex.showCount,
    rarestCatch,
    tierBreakdown: orderedTierRows(counts),
    latestShow,
  };
}
```

**The exact read-set `compareDexes` touches** (compare.ts — the reconstruction contract). The caught rule is `sightings > 0` (line 58); tier counts read `perSong.get(id)?.tier ?? null` (line 73); column reads only `completion.pct` / `completion.caught` / `showCount` (lines 79–84):
```ts
function caughtSongIds(dex: DexStats): Set<number> {
  const ids = new Set<number>();
  for (const [songId, stats] of dex.perSong) {
    if (stats.sightings > 0) ids.add(songId);   // ONLY tested as > 0
  }
  return ids;
}
function column(dex: DexStats, ids: Set<number>): CompareColumn {
  return {
    completion: dex.completion.pct,
    caught: dex.completion.caught,
    shows: dex.showCount,
    tierCounts: tierCounts(dex, ids),
  };
}
```
→ `deriveSharedProgress` must emit exactly `{caughtSongIds (sightings>0 set), completion, showCount, rarest, tierCounts, perAlbum[]}`. `reconstructDexStats` sets `sightings: 1` per caught id, `tier: rarity.get(id)?.tier ?? null`, and stubs everything `compareDexes` never reads.

**Reconstruction target shape** — `DexStats` / `SongDexStats` (derive-dex.ts:45–60). Note `perSong` and `perAlbum` are **`Map`s** (must be rebuilt from serialized arrays — Pitfall 6):
```ts
export interface SongDexStats {
  songId: number; sightings: number;
  lastSeenDate: string | null; personalGap: number | null;
  tier: RarityTier | null;
}
export interface DexStats {
  completion: { caught: number; total: number; pct: number };
  perSong: Map<number, SongDexStats>;
  neverSeen: number[];
  rarestCatch: { songId: number; tier: RarityTier } | null;
  showCount: number;
  perAlbum: Map<string, { caught: number; total: number }>;
}
```

**`RarityTier` is exactly 5 tiers (no `"debut"`)** — rarity.ts:17. The `tierCounts` record uses these five keys only (compare.ts:64–69 seeds `{common,uncommon,rare,epic,legendary}`). Do NOT add `"debut"` to `SharedProgress.tierCounts`:
```ts
export type RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary";
```

**Tier reconstruction fidelity (D-13)** — `buildRarityIndex` (rarity.ts:51–107) is a pure fn of the static bundled archive; tier is a tie-inclusive `playCount` band lookup with **no songId tie-break** (line 87–92), so every client assigns the same tier to a given song. That is why per-song tiers are redundant on the wire and `rarity.get(songId)?.tier` faithfully reproduces `deriveDex(theirs)`.

**Zod schema idiom (D-19)** — mirror `archive-types.ts:19–48`: `import { z } from "zod"`, `z.strictObject`, `z.number().int()`, `z.literal(1)` for the `v` version guard. Add bounds per §Untrusted-Data (pct `[0,100]`, non-negative counts, int ids, array-length ceiling). Wrap in `parseSharedProgress(raw): SharedProgress | null` via `safeParse` (returns `null`, never throws — matches the file-import discipline). zod is already a core dep and the purity scan permits it.

---

### `packages/core/src/index.ts` (MODIFY — barrel export)

**Analog:** the existing `compareDexes` export block (index.ts:219–229) and `deriveDex` block (206–211). Add a new documented block beside them exporting `deriveSharedProgress`, `reconstructDexStats`, `parseSharedProgress`, `sharedProgressSchema`, and `type SharedProgress`:
```ts
export {
  compareDexes,
  type CompareResult,
  type CompareColumn,
} from "./dex/compare.ts";
```

---

### `packages/core/test/dex/shared-progress.test.ts` (test)

**Analog:** `packages/core/test/dex/share-stats.test.ts` (imports the shared fixtures, `buildRarityIndex`, `deriveDex`) and `test/fixtures/dex/synthetic.ts` (override-spread factories `archiveShow`/`syntheticArchive`/`dexSnapshot`/`syntheticAlbums`).

**Fixture wiring to copy** (share-stats.test.ts:1–53) — reuse the SAME base archive + `derive()` helper so the round-trip test has a real `DexStats`:
```ts
const archive = baseArchive();
const rarity = buildRarityIndex(archive);
const albums = syntheticAlbums();
function derive(snapshot: Parameters<typeof deriveDex>[0]) {
  return deriveDex(snapshot, archive, albums, rarity);
}
```

**The load-bearing test (PROG-06 round-trip invariant)** — assert deep-equality of the diff produced via `deriveDex` vs via projector→reconstruct:
```ts
const mine = derive(mineSnapshot);
const theirs = derive(theirsSnapshot);
expect(
  compareDexes(mine, reconstructDexStats(deriveSharedProgress(theirs), rarity)),
).toEqual(compareDexes(mine, theirs));
```
Plus: `deriveSharedProgress` deep-equals a known `SharedProgress`; `parseSharedProgress` returns `null` on malformed/out-of-range rows; `perAlbum` array↔Map round-trips; top-5 rarest selection order. Purity is already covered by the existing `purity.test.ts` (no change needed there — it auto-scans the new file).

---

### `packages/app/src/sync/progressSync.ts` (NEW — service, sync fence)

**Analog:** `packages/app/src/db/supabase.ts` (the singleton — this phase is its **first data consumer**) + the VALIDATED blueprint `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` §"Durable shared progress".

**Import the singleton (never `createClient` again)** — supabase.ts:17,33 is the ONLY `createClient` in the repo:
```ts
import { supabase } from "../db/supabase.ts";
```

**Write path (D-15, identity-safe)** — blueprint lines 71–77 + RESEARCH §Sync Mechanics. Content write includes a full fresh `summary`; identity-only write touches identity columns ONLY so counts are never reset (Pitfall 4):
```ts
// content write (debounced ~5s after a dex change)
await supabase.from("progress").upsert(
  { user_id, display_name, summary: deriveSharedProgress(dex), updated_at: new Date().toISOString() },
  { onConflict: "user_id" },
);
// identity-only write (never clobbers summary counts)
await supabase.from("progress").upsert({ user_id, display_name }, { onConflict: "user_id" });
```

**Read path (D-16 app-wide subscription)** — blueprint lines 73–76. Subscribe while signed in (not gated on the Friends toggle); full ~5-row re-pull on any change:
```ts
const ch = supabase
  .channel("progress-feed")
  .on("postgres_changes", { event: "*", schema: "public", table: "progress" }, () => refreshAll())
  .subscribe();
```

**Validated re-pull (D-19)** — RESEARCH §Code Examples: `parseSharedProgress` each row → drop malformed → exclude own `user_id` → write cache → set state:
```ts
const { data } = await supabase.from("progress").select("user_id, display_name, summary, updated_at");
const rows = (data ?? [])
  .map((r) => {
    const summary = parseSharedProgress(r.summary);
    return summary && r.user_id !== myUserId ? { userId: r.user_id, displayName: r.display_name, summary, updatedAt: r.updated_at } : null;
  })
  .filter((r): r is FriendRowData => r != null);
```

**`user_id` source** — `useAuthIdentity()?.userId` (useAuthIdentity.ts:56, returns `{userId, displayName}`).

**Reconnect flush (D-17)** — tie into `useOnlineStatus()` (live/useOnlineStatus.ts) offline→online transition + the `ReconnectContext` seam (auth/reconnectContext.ts:19). On reconnect: flush own row + re-pull once + resubscribe. Gotcha (Pitfall 2, blueprint line 96): `alter publication supabase_realtime add table public.progress` is ALREADY provisioned (Phase 17) — do not remove; failure is silent.

---

### `packages/app/src/sync/useFriendsProgress.ts` (NEW — hook, event-driven)

**Analog:** `dex/useDexStats.ts` (the reactive hook shape — liveQuery + memo + loading-safe result object) and `live/useOnlineStatus.ts` (external-store subscription idiom).

**Loading-safe result-object shape to mirror** (useDexStats.ts:31–44) — expose `{ friends[], offline, asOf, error }` in the same calm-shape style (never throw, never NaN):
```ts
export interface DexStatsResult {
  ready: boolean; error: string | null;
  dex: DexStats | null; rarity: RarityIndex | null;
  archive: ArchiveArtifact | null; albums: DexAlbumsArtifact | null;
}
```

**Gate the upsert on `ready` + non-null dex (Pitfall 5)** — reuse `useDexStats()`'s `ready` flag (useDexStats.ts:119–123) as the change trigger; skip the debounced write while `!ready` or `dex == null` so an empty-table first-paint never upserts a 0% summary.

**External-store subscription pattern** (useOnlineStatus.ts:16–31) — the `subscribe`/`getSnapshot` shape if a reactive read of the cache table is wanted (or use `useLiveQuery` over the cache table, dexie-react-hooks is installed).

---

### `packages/app/src/sync/friendCache.ts` (NEW — Dexie table, offline backstop D-18)

**Analog:** `packages/app/src/db/db.ts` — the versioned additive-migration discipline + module-level async write helpers.

**Additive version bump (never rewrite prior versions)** — db.ts:374 is currently `version(7)`. Add a **`version(8)`** ADDITIVE store for the friend-pull cache (new table → no `.upgrade()` needed, per the v4/v5/v6 precedent at db.ts:334–354):
```ts
this.version(8).stores({
  friendProgressCache: "&userId",   // one row per friend, or a single snapshot row keyed by a constant
});
```
Recommended row shape (RESEARCH §Offline Backstop): `{ userId, displayName, summary, updatedAt, fetchedAt }`. The `asOf` stamp derives from `fetchedAt` (client wall-clock of the last successful pull).

**Write-helper idiom** (db.ts:443–449 `setMeta`/`getMeta`, and the `friendBeacons` presence-cache precedent at db.ts:242–253, which is a "last-known, never a history" upsert table — the closest structural twin). Do NOT register `userId`-stamping hooks on this table (it is friend data, not the local identity's namespaced rows — db.ts:432 excludes `friendBeacons`/`mapPins` for the same reason). Exclude it from `DbSnapshot`/export exactly like `FriendBeaconRow` (db.ts:238–241 "Deliberately EXCLUDED from DbSnapshot/export").

---

### `packages/app/src/dex/DexView.tsx` (MODIFY — add Friends segment, D-01)

**Analog:** its own `Albums | Shows` segment toggle (DexView.tsx:96–114). Extend the `Segment` type (line 27) to `"albums" | "shows" | "friends"` and add `"friends"` to the mapped array. The active-fill class `bg-accent text-surface` is the single accent use this phase adds (UI-SPEC §Color):
```ts
{(["albums", "shows"] as const).map((seg) => {
  const active = segment === seg;
  const label = seg === "albums" ? copy.segmentAlbums : copy.segmentShows;
  return (
    <button key={seg} type="button" aria-pressed={active} onClick={() => setSegment(seg)}
      className={`flex min-h-11 flex-1 items-center justify-center rounded text-[14px] font-semibold touch-manipulation ${
        active ? "bg-accent text-surface" : "text-text-muted"}`}>
      {label}
    </button>
  );
})}
```
Then a `segment === "friends"` branch renders `<FriendsList />`, and `FriendDetail` opens as **component view-state within `#/dex`** (mirror the existing `openAlbum`/`openShow` `useState` overlays at DexView.tsx:68–70,142–166 — **never a new hash route**, D-07).

---

### `packages/app/src/dex/FriendsList.tsx` (NEW — list, D-02/03/04/05)

**Analog:** `dex/ShowsList.tsx` — pure row-builder + sorted list + empty state + loading frame.

**Pure sort/build idiom** (ShowsList.tsx:78–140 `buildShowRows`) — build a pure `buildFriendRows(friends)` sorted completion% desc → caught → displayName (D-03), 0-catch friends last (D-05). The newest-first sort comparator at ShowsList.tsx:137–139 is the tie-break pattern to echo.

**Loading + empty-state shape** (ShowsList.tsx:204–217):
```ts
if (rows == null) return <div className="mx-auto w-full max-w-md" aria-hidden="true" />;
if (rows.length === 0) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 pt-16 pb-16 text-center">
      <p className="text-[20px] font-semibold leading-tight text-text-primary">{copy.showsEmptyHeading}</p>
      <p className="text-base leading-normal text-text-muted">{copy.showsEmptyBody}</p>
    </div>
  );
}
```
→ use `config.copy.friends` empty heading/body (`No friends yet` / the sign-in note). Render the pinned `<SelfRow>` (from `useDexStats`) **above** the friend rows always; the empty state sits below the SelfRow (D-14).

**Offline marker (D-18)** — render `Offline · as of {time}` as a muted chip reusing the `SyncDot` connection vocabulary (SyncDot.tsx — the `#A1A1AA` muted / hollow-ring semantics); dim friend rows (never a spinner, never blank). SelfRow stays live.

---

### `packages/app/src/dex/FriendRow.tsx` (NEW — row, D-04)

**Analog:** the `ShowsList` row `<button>` (ShowsList.tsx:221–255) for the 44px tap-target row layout + trailing `ChevronRight`, and `IdentityAvatar` for the identity glyph.

**Row `<button>` skeleton** (ShowsList.tsx:222–254) — `min-h-11 … px-4 py-3 text-left touch-manipulation`, `tabular-nums` on figures, trailing chevron:
```tsx
<button type="button" onClick={...}
  className="flex min-h-11 items-center gap-2 border-b border-hairline px-4 py-3 text-left touch-manipulation">
  <span className="flex min-w-0 flex-1 flex-col"> {/* name (truncate) + {pct}% · {n} caught */} </span>
  {/* single rarest TierBadge */}
  <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden="true" />
</button>
```

**Identity glyph (deterministic per-user color)** (IdentityAvatar.tsx:31–74) — copy the exact fill/initials pattern (`identityColorIndex(userId, len)` → `config.auth.IDENTITY_COLORS[i]`, initials in `#0C0C10`, 32px `h-8 w-8`):
```tsx
const fill = config.auth.IDENTITY_COLORS[identityColorIndex(userId, config.auth.IDENTITY_COLORS.length)];
<span className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold leading-none"
  style={{ backgroundColor: fill, color: "#0C0C10" }}>{initials}</span>
```

**Rarest badge** — `<TierBadge tier={rarest.tier} />` (TierBadge.tsx). Names are untrusted: escaped React text, `truncate`/`min-w-0` (D-19).

**Phase-20 forward-compat (PRES-07):** leave a **leading slot** (online dot) and a **trailing slot** (coarse activity label) in the row structure so presence fuses in without a rebuild (UI-SPEC §Component Inventory).

---

### `packages/app/src/dex/SelfRow.tsx` (NEW — pinned "You" row, D-02/06)

**Analog:** `FriendRow` shape, but sourced from **live local `useDexStats()`** (useDexStats.ts) — NOT the Supabase read, so it is always current and works fully offline. Label `You` (`config.copy.friends`). Tap opens the own trophy case = `<RarestShowcase>` only, **no head-to-head columns** (D-06). Reuse the same identity glyph via `useAuthIdentity()` for the signed-in user's color.

---

### `packages/app/src/dex/FriendDetail.tsx` (NEW — full-screen overlay, D-07/08/09)

**Analog:** `dex/CompareView.tsx` — **echo its layout, do NOT import or modify it** (D-09 zero-coupling).

**The one difference that satisfies PROG-06** — CompareView runs `deriveDex(envelope, …)` (CompareView.tsx:50); `FriendDetail` instead runs the new `reconstructDexStats` and feeds the SAME `compareDexes`:
```ts
// CompareView.tsx:46–52 (the pattern to ECHO, with reconstruct swapped in):
const compare = useMemo<CompareResult | null>(() => {
  if (stats.dex == null || stats.rarity == null) return null;
  const theirs = reconstructDexStats(friendSummary, stats.rarity);  // NEW core fn (not deriveDex)
  return compareDexes(stats.dex, theirs);                            // UNCHANGED core
}, [friendSummary, stats.dex, stats.rarity]);
```

**Overlay shell (Sheet fullscreen + safe-area header)** — CompareView.tsx:99–107 + 54–72. Use `Sheet variant="fullscreen"` (z-tier `config.ui.z.sheet` = 50, UI-SPEC §Layering), the `calc(env(safe-area-inset-top) + 12px)` header inset, and a ≥44px close/back control:
```tsx
<Sheet open onClose={onClose} modal variant="fullscreen" ariaLabel={...}>
  <div className="flex items-center gap-3 border-b border-hairline bg-elevated px-4 py-3"
       style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
    <button type="button" aria-label={copy.close} onClick={onClose}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-text-muted touch-manipulation">
      <X size={24} />
    </button>
  </div>
  {/* ... */}
</Sheet>
```

**StatColumn (head-to-head, leads the detail — D-08)** — copy CompareView.tsx:146–178 verbatim in a private local component (echo, not import). It reads `compare.columns.mine`/`.theirs` and reuses `config.copy.compare` strings (`columnYou`, `statCompletion`, `statCaught`, `statShows`) — UI-SPEC mandates reusing these so live + file-import never disagree:
```tsx
const rows: Array<[string, string | number]> = [
  [copy.statCompletion, `${column.completion}%`],
  [copy.statCaught, column.caught],
  [copy.statShows, column.shows],
];
```

**DiffSection (per-rarity breakdown, expandable)** — copy CompareView.tsx:180–224: `ChevronDown`/`ChevronRight` collapse, `min-h-11` header, tier-sorted `songId[]` rendered with `nameOf(songId)` (from `archive.songs[String(id)]`, CompareView.tsx:97) + `<TierBadge>`. Set arithmetic is songId-only (D-19).

**Per-album breakdown (PROG-07, "By album")** — reconstructed `perAlbum` Map; resolve album titles via the same `resolveOpenAlbum` idiom DexView uses (DexView.tsx:43–61) if album labels are needed.

**Then `<RarestShowcase>`** (their top-5) below (D-08/D-10).

---

### `packages/app/src/dex/RarestShowcase.tsx` (NEW — top-5 rarest, D-10, PROG-08)

**Analog:** `dex/DexHeader.tsx` rarest subline (DexHeader.tsx:30–68) + `TierBadge`.

**Rarest subline pattern to echo** (DexHeader.tsx:30–67) — resolve name from `archive.songs`, render name as React text + `<TierBadge>`:
```tsx
const rarestName = dex.rarestCatch != null ? (archive.songs[String(dex.rarestCatch.songId)] ?? null) : null;
{dex.rarestCatch != null && rarestName != null && (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-base leading-normal text-text-muted">{copy.rarestCatchLabel(rarestName)}</span>
    <TierBadge tier={dex.rarestCatch.tier} />
  </div>
)}
```
Extend to a top-5 list: sort `caughtSongIds` by local rarity (rarest-first, songId tie-break — mirror `sortByTierThenId` in compare.ts:88–94), take `config.friends.showcaseCount` (default 5). Shared by `FriendDetail` (friend) and `SelfRow`'s You trophy case. Headings from `config.copy.friends` (`{name}'s rarest catches` / `Your rarest catches` / `No catches yet`). Showcase-on-fill text uses `RARITY_ORB_TEXT_COLOR` `#0C0C10` (rarityStyle.ts:48) if rendering on a filled orb.

---

### `packages/app/src/config.ts` (MODIFY — `config.friends` + `config.copy.friends`)

**Analog:** `config.copy.compare` block (config.ts:1315–1346) for the copy-block idiom, `config.dex.tierColors` (393–405) + `config.auth.IDENTITY_COLORS` (775) for the data-semantic palettes (reused verbatim, NOT recolored).

**Add a `config.friends` block** (debounce ms ~5000, `showcaseCount: 5`, D-10) and a `config.copy.friends` block (segment label `Friends`, `You`, `{pct}%`, `{n} caught`, `0% · 0 caught`, `No friends yet` + body, `Offline · as of {time}`, `Can't reach friends right now — showing the last sync.`, `You vs {name}`, `By album`, `By rarity`, `{name}'s rarest catches`, `Your rarest catches`, `No catches yet`). **Head-to-head column strings REUSE `config.copy.compare`** (UI-SPEC §Copywriting) — do not duplicate `columnYou`/`statCompletion`/`statCaught`/`statShows`. Single-config-file rule (CLAUDE.md): if any debounce/showcase constant is mirrored into core, keep the values equal.

---

## Shared Patterns

### Untrusted external data (D-19)
**Source:** `packages/core/src/dex/archive-types.ts` (zod `strictObject` idiom, lines 19–48) + `CompareView.tsx` (escaped-text/clamp) + the identity-by-songId discipline in `compare.ts:1–14`.
**Apply to:** `shared-progress.ts` (`parseSharedProgress` at the read boundary), `progressSync.ts` (validate each row → skip malformed), every friend-string render in `FriendRow`/`FriendDetail`/`RarestShowcase` (escaped React text, `truncate`/`min-w-0`, never `dangerouslySetInnerHTML`). All set arithmetic by songId (duplicate names in the matrix).

### Core purity guard
**Source:** `packages/core/test/purity.test.ts` (static scan, lines 37–49).
**Apply to:** `shared-progress.ts` — import only `zod` + core-internal types; no `@supabase/`, no DOM globals, no `Date.now()` in the projector. Passes by construction; no test change needed (the scan auto-picks up the new file).

### Deterministic identity color
**Source:** `packages/core/src/identity/color.ts` (`identityColorIndex`, pure, palette-agnostic) + `config.auth.IDENTITY_COLORS` (config.ts:775) + `IdentityAvatar.tsx:50` render.
**Apply to:** `FriendRow`, `SelfRow` — stable per-user hue across devices; initials always in `#0C0C10` (identity never color alone, D-12).

### Rarity badge + colors
**Source:** `TierBadge.tsx` + `rarityStyle.ts` (`rarityColor`, single index into `config.dex.tierColors`) — reuse VERBATIM.
**Apply to:** `FriendRow` (single rarest badge), `RarestShowcase`, `FriendDetail` diff lists. Tier WORD always renders (WCAG 1.4.1). Note `RarityTier` has no `"debut"`; `TierBadge` accepts `RarityTier | "debut"` but the compare/showcase paths only pass real tiers.

### Connection vocabulary (offline + reconnect)
**Source:** `live/SyncDot.tsx` (muted `#A1A1AA` hollow-ring offline semantics) + `live/useOnlineStatus.ts` (reactive `navigator.onLine`) + `auth/reconnectContext.ts` (reconnect seam).
**Apply to:** `FriendsList` offline marker + `progressSync` reconnect flush (D-17/D-18) — reuse, never a second connection indicator.

### View-state overlays, no new routes
**Source:** `DexView.tsx` — `openAlbum`/`openShow` `useState` overlays (lines 68–70, 142–166), no routing library.
**Apply to:** the `Friends` segment + `FriendDetail` overlay — component view-state within `#/dex` (D-01/D-07).

### Additive Dexie migration
**Source:** `db/db.ts` — `version(4)`/`version(5)`/`version(6)` new-table-only bumps (lines 334–354); `friendBeacons` last-known-cache precedent (238–253) excluded from export + userId hooks.
**Apply to:** `friendCache.ts` — add `version(8)` new table only; exclude from `DbSnapshot`/export and from the userId-stamping loop (db.ts:432–441).

---

## No Analog Found

None. Every surface has a shipped analog (this is the phase's explicit premise). The only genuinely new mechanical work — the app-layer Supabase sync plumbing (`progressSync.ts`) — is covered by the VALIDATED blueprint `multi-user-supabase.md` §"Durable shared progress" (validated across two remote devices, spikes 002–004), which functions as its analog.

---

## Metadata

**Analog search scope:** `packages/core/src/dex/`, `packages/core/src/identity/`, `packages/core/test/`, `packages/app/src/dex/`, `packages/app/src/sync|live|auth|db/`, `packages/app/src/config.ts`, `.claude/skills/spike-findings-guezzer/references/`.
**Files scanned (read in full or targeted):** compare.ts, derive-dex.ts, share-stats.ts, rarity.ts, archive-types.ts, index.ts, identity/color.ts, purity.test.ts, share-stats.test.ts, fixtures/dex/synthetic.ts, CompareView.tsx, DexView.tsx, useDexStats.ts, ShowsList.tsx, TierBadge.tsx, rarityStyle.ts, DexHeader.tsx, IdentityAvatar.tsx, useAuthIdentity.ts, SyncDot.tsx, useOnlineStatus.ts, reconnectContext.ts, supabase.ts, db.ts, config.ts (compare/dex/auth blocks), multi-user-supabase.md.
**Pattern extraction date:** 2026-07-23
