# Phase 18: Accounts & Offline-Safe Identity - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 17 new/modified files
**Analogs found:** 15 / 17 (2 net-new files use blueprint patterns, no in-repo analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/identity/color.ts` (NEW) | utility (pure core) | transform | `packages/app/src/map/MapView.tsx` `memberColor` (53-58) | role-match (idiom exact, purity differs) |
| `packages/core/test/identity/color.test.ts` (NEW) | test (core, node) | transform | `packages/core/test/map/*` + `config.test.ts` | role-match |
| `packages/app/src/auth/AuthGate.tsx` (NEW) | provider / gate | request-response | `packages/app/src/App.tsx` (boot interposition) | partial (first interposition — blueprint Pattern 2) |
| `packages/app/src/auth/SignInScreen.tsx` (NEW) | component | request-response | `packages/app/src/map/AvatarSheet.tsx` (picker) + `SettingsView` | role-match |
| `packages/app/src/auth/useAuthIdentity.ts` (NEW) | hook | event-driven | `packages/app/src/live/useOnlineStatus.ts` | role-match |
| `packages/app/src/auth/roster.ts` (NEW) | config/data | — | `config.map.AVATARS` block (`config.ts:736`) | role-match |
| `packages/app/src/auth/claimDex.ts` (NEW) | service (Dexie write) | CRUD / batch | `db.ts` `markShowAttended` / `setMeta` transaction helpers | exact (idiom) |
| `packages/app/src/auth/IdentityAvatar.tsx` (NEW) | component | — | `dex/rarityStyle.ts` + `show/tuningColor.ts` (orb pairing) | role-match |
| Identity sheet (in `IdentityAvatar.tsx` or sibling) | component | — | `packages/app/src/map/AvatarSheet.tsx` | exact |
| `packages/app/src/db/db.ts` (MODIFY — `version(7)`) | model / migration | CRUD | `db.ts` `version(3)`/`version(6)` additive blocks | exact (same file) |
| `packages/app/src/dex/useDexStats.ts` (MODIFY — scope reads) | hook | CRUD | same file (existing `useLiveQuery` idiom) | exact (same file) |
| `packages/app/src/live/SyncDot.tsx` (MODIFY — reconnecting state) | component | event-driven | same file (existing 3-state glyph) | exact (same file) |
| `packages/app/src/components/AppShell.tsx` (MODIFY — header avatar) | component | — | same file (menu button, 46-53) | exact (same file) |
| `packages/app/src/config.ts` (MODIFY — `auth` block + copy) | config | — | `config.map` block + `config.copy` | exact (same file) |
| `packages/app/vite.config.ts` (MODIFY — manifest) | config | — | same file (manifest 74-77) | exact (same file) |
| `packages/app/index.html` (MODIFY — `<title>`) | config | — | same file (line 12) | exact (same file) |
| `packages/app/test/migrationV7.test.ts` (NEW) | test | CRUD | `packages/app/test/migrationV5.test.ts` | exact |
| `packages/app/test/authGate.test.tsx` / `signIn.test.tsx` / `authNamespacing.test.tsx` (NEW) | test | — | `migrationV5.test.ts` (Dexie reset idiom) + jsdom setup | role-match |

## Pattern Assignments

### `packages/core/src/identity/color.ts` (pure core utility, transform)

**Analog:** `packages/app/src/map/MapView.tsx` `memberColor` (lines 53-58) — the hash idiom to **mirror**, but this file is a **pure `packages/core` module** (no config import; palette length is a parameter). D-13 / AUTH-07.

**Hash idiom to copy** (`MapView.tsx:53-58`):
```typescript
function memberColor(memberId: string): string {
  let hash = 0;
  for (let i = 0; i < memberId.length; i++) hash = (hash * 31 + memberId.charCodeAt(i)) | 0;
  const palette = config.map.MEMBER_COLORS;
  return palette[Math.abs(hash) % palette.length];
}
```

**Pure-core transform (RESEARCH Pattern 5) — the shape to write:**
```typescript
// packages/core/src/identity/color.ts — no DOM, no Supabase, no config import; node-testable.
export function identityColorIndex(userId: string, paletteLength: number): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return Math.abs(hash) % paletteLength;
}
```

**Export it via the barrel** — follow the `map/presence.ts` block in `packages/core/src/index.ts` (lines 383-394): add an `export { identityColorIndex } from "./identity/color.ts";` block. Palette (`config.auth.IDENTITY_COLORS`) is injected by the app caller, never imported into core (keeps `purity.test.ts` green).

**Core purity constraint:** `packages/core/test/purity.test.ts` static-scans `packages/core/src` for `@supabase/` / DOM globals. `identity/color.ts` must import nothing browser/Supabase — a plain string→number function. It has no `fetch`/`window` risk.

---

### `packages/core/test/identity/color.test.ts` (core test, node env)

**Analog:** existing `packages/core/test/` files (`config.test.ts`, `map/`) — node env, pure assertions, no jsdom/fake-indexeddb. Assert determinism (same `userId` → same index) and range (`0 <= index < paletteLength`) for several fixture ids. AUTH-07.

---

### `packages/app/src/auth/AuthGate.tsx` (gate/provider, request-response) — THE CRUX

**Analog:** `packages/app/src/App.tsx` — the current **synchronous, zero-await boot tree** the gate interposes into. There is no prior gate; this is the first interposition (RESEARCH Pattern 2, D-05/D-06).

**What the boot tree looks like today** (`main.tsx:11-15`) — no async gate, no splash:
```typescript
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```
`App.tsx` (20-50): `useHashRoute()` + `requestPersistenceOnce()` is the ONLY startup side effect — fully synchronous first paint. **The gate MUST preserve zero-await first paint for a restored identity** (do NOT `await getSession()` before paint).

**Gate shape to write (RESEARCH Pattern 2):**
```typescript
const identity = readAppOwnedIdentity();        // SYNC: localStorage.getItem / cached meta
if (!identity) return <SignInScreen online={useOnlineStatus()} />;  // D-03 branches on online
return <App currentUserId={identity.userId} />; // full offline dex opens; zero await

// Background, AFTER first paint — reconcile only, never block (mirror App.tsx useEffect idiom):
useEffect(() => {
  supabase.auth.getSession();                    // may refresh if online; IGNORED for gating
  const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
    if (evt === "SIGNED_OUT") clearIdentityAndTearDown();  // ONLY explicit sign-out clears (D-10)
  });
  return () => sub.subscription.unsubscribe();
}, []);
```

**Supabase client source:** `packages/app/src/db/supabase.ts` exports the singleton `supabase` — AuthGate is its **first consumer** (`supabase.auth.*`). Import `import { supabase } from "../db/supabase.ts";`. Never construct a second client.

**Anti-pattern (RESEARCH):** `await supabase.auth.getSession()` before first paint reintroduces the network-shaped boot dependency this phase exists to kill (D-05).

---

### `packages/app/src/auth/SignInScreen.tsx` (component, request-response)

**Analog:** `packages/app/src/map/AvatarSheet.tsx` (large tap-target picker over a config list) for the roster grid; `config.copy` for all strings.

**Picker idiom to copy** (`AvatarSheet.tsx:26-45`) — map a config list to large tap targets:
```typescript
{config.map.AVATARS.map((option) => {
  const active = current === option.emoji;
  return (
    <button key={option.emoji} type="button" aria-label={option.label} aria-pressed={active}
      onClick={() => onPick(option.emoji)}
      className={`flex min-h-14 flex-col items-center justify-center rounded-xl border px-1 ${
        active ? "border-accent bg-accent/10" : "border-hairline"}`}>
      ...
    </button>
  );
})}
```
For SignInScreen the list is `ROSTER` (D-04), rows are `min-h-14` (56px, D-01), and the accent-fill primary CTA is "Sign in".

**Sign-in call (RESEARCH Pattern 1):**
```typescript
import { supabase } from "../db/supabase.ts";
const { error } = await supabase.auth.signInWithPassword({ email: handle, password });
// error.message → surface VERBATIM ("Invalid login credentials") — no user enumeration (D-18).
```

**Copy:** add a `config.copy.auth` block (mirror `config.copy.map` / `config.copy.installBanner` at `config.ts:761`). UI-SPEC Copywriting Contract lists every string. Input `>=16px` (`text-base`) to prevent iOS focus-zoom.

---

### `packages/app/src/auth/useAuthIdentity.ts` (hook, event-driven)

**Analog:** `packages/app/src/live/useOnlineStatus.ts` — the `useSyncExternalStore`-over-a-browser-event idiom, for reading the app-owned identity record reactively (so sign-out re-renders the gate).

**Idiom to copy** (`useOnlineStatus.ts:16-31`):
```typescript
function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => { /* removeEventListener */ };
}
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
```
`useAuthIdentity` subscribes to a custom identity-change event (or a `storage` event) and snapshots the app-owned `{ userId, displayName } | null` synchronously — the SSR/first snapshot must be the synchronous read, not a Promise.

---

### `packages/app/src/auth/roster.ts` (config/data — NO real PII)

**Analog:** `config.map.AVATARS` block (`config.ts:736-749`) — a bundled `as const` array of `{ label, ... }`. D-04.

```typescript
export const ROSTER = [
  { displayName: "Matt", handle: "matt@gizz.local" },
  { displayName: "Max",  handle: "max@gizz.local"  },
  // synthetic handles ONLY — must match what the Phase-17 seed actually minted (RESEARCH OQ2).
] as const;
```
**Security:** ships in the public bundle — never a real email (RESEARCH Security Domain / D-04). Verify against the live project before finalizing.

---

### `packages/app/src/auth/claimDex.ts` (service, one-time batch stamp)

**Analog:** `db.ts` transaction helpers — `markShowAttended` (652-666) and `setMeta`/`getMeta` (344-350). The meta-gated "exactly once" claim (AUTH-05 / D-08, RESEARCH Pattern 3, Pitfall 2).

**Transaction + meta-gate idiom to copy** (`db.ts` `markShowAttended` shows the `db.transaction("rw", ...tables, async () => {...})` shape; `getMeta`/`setMeta` are the flag store):
```typescript
export async function claimLegacyDexOnce(userId: string) {
  const already = await getMeta<string>("dexClaimedBy");
  if (already) return;                            // exactly once (AUTH-05)
  await db.transaction("rw", db.attendedShows, db.trackedShows, db.trackedEntries,
    db.archiveShows, db.bingoCards, db.meta, async () => {
      for (const table of [db.attendedShows, db.trackedShows, db.trackedEntries, db.archiveShows, db.bingoCards]) {
        await table.toCollection().modify((r) => { if (r.userId === undefined) r.userId = userId; });
      }
      await setMeta("dexClaimedBy", userId);
    });
}
```
**Pitfall 2:** this CANNOT live in `version(7).upgrade()` — the userId is unknown at DB-open (before sign-in). App-side, at first login, only.

**Sign-out (RESEARCH Pattern 4):** `await supabase.auth.signOut()` then clear the app-owned identity record — do NOT clear `dexClaimedBy` or wipe rows (prior user's rows stay namespaced, D-09).

---

### `packages/app/src/auth/IdentityAvatar.tsx` (component) + identity sheet

**Analog for the orb color+text pairing:** `packages/app/src/show/tuningColor.ts` (`ORB_TEXT_COLOR`, line 25) and `packages/app/src/dex/rarityStyle.ts` (`RARITY_ORB_TEXT_COLOR`, line 48). D-12.

**Dark-on-light pairing to copy** (both modules):
```typescript
// show/tuningColor.ts:25  — the dark text drawn ON a light fill
export const ORB_TEXT_COLOR = "#0C0C10";  // clears >=4.5:1 on all light fills
```
IdentityAvatar: fill = `config.auth.IDENTITY_COLORS[identityColorIndex(userId, len)]`, initials text = `#0C0C10`. Always render initials (never color-alone identity, Accessibility).

**Analog for the sheet:** `packages/app/src/map/AvatarSheet.tsx` — the exact `<Sheet>` usage (import from `../components/Sheet.tsx`, `ariaLabel`, `min-h-11` controls). The identity sheet shows `display_name` (from `session.user.user_metadata.display_name`) + a neutral (non-destructive) "Sign out" control. D-14 / D-04.

**Header placement:** `AppShell.tsx:46-53` — the menu button sits beside the wordmark; the avatar goes in that same header `<button>` idiom (32px glyph in a `min-h-11 min-w-11` tap target).

---

### `packages/app/src/db/db.ts` — `version(7)` additive namespacing (MODIFY)

**Analog:** the same file's `version(3)` (291-311, additive + `.upgrade()` backfill) and `version(6)` (335-338, new-tables-only, no upgrade). AUTH-05 / D-11.

**Additive discipline to copy** (`db.ts:335-338`):
```typescript
this.version(6).stores({
  friendBeacons: "&memberId",
  mapPins: "&pinId, synced",
});
```
`version(7)` adds a `userId` index to the existing tables (per D-11 field+scoping) — an added unindexed field needs no `.upgrade()`; adding it as an index does. **Never** rewrite v1-v6 or change `DB_NAME` (`config.DB_NAME` = "guezzer", `config.ts:16`).

**Also flag for planner (RESEARCH Pitfall 6):** `snapshot()` (687-713) and `importSnapshot()` (735-768) read/write ALL rows unscoped — must be scoped to the current `userId` (export only the signed-in identity; stamp imported rows). Part of the AUTH-05 surface.

**PK-collision caveat (RESEARCH Pitfall 4):** `attendedShows`/`archiveShows` use `&show_id` unique PKs — a plain `userId` field does not isolate two identities marking the same show on one device. Recommended: accept + document for v2.0 (D-09 "borrowed-phone dex is empty").

---

### `packages/app/src/dex/useDexStats.ts` — scope reads to userId (MODIFY)

**Analog:** the same file's existing `useLiveQuery` reads (57-60). D-11.

**Current unscoped read to change** (`useDexStats.ts:57-60`):
```typescript
const attendedShows = useLiveQuery(() => db.attendedShows.toArray());
```
becomes `db.attendedShows.where("userId").equals(currentUserId).toArray()` (RESEARCH "Don't Hand-Roll"). Same idiom, add the scope filter.

---

### `packages/app/src/live/SyncDot.tsx` — add "reconnecting" state (MODIFY)

**Analog:** the same file's existing 3-state glyph (online green / offline ring / drift amber). D-07 / AUTH-08. Add a "reconnecting/stale-token" **read** reusing the existing glyph language + a distinct `aria-label` — do NOT fork or add a second indicator.

**Existing token constants to reuse** (`SyncDot.tsx:47-57`):
```typescript
const ONLINE_GREEN = "#22C55E";  // connected/fresh token
const MUTED = "#A1A1AA";         // offline ring — identity still present, dex usable
const DRIFT_AMBER = "#F59E0B";   // the calm "reconnecting…" language (never red, never "logged out")
```
The offline `aria-label` idiom (line 101): `aria-label={online ? "Sync: online" : "Sync: offline"}` — extend with a reconnecting label.

---

### Rebrand surfaces (MODIFY) — AUTH-06 / D-15/D-16, chrome-only

| Surface | File:line | Change |
|---------|-----------|--------|
| Document title | `index.html:12` `<title>Guezzer</title>` | → "Gizz With Friends" (RESEARCH OQ1: requirement authoritative) |
| Manifest name/short_name/description | `vite.config.ts` manifest block (`name: "Guezzer"`, `short_name: "Guezzer"`, `description: "Predict the next King Gizzard song, live."`) | → "Gizz With Friends" name+short_name; updated description (D-16) |
| Install/CTA copy | `config.ts:762-769` (`config.copy.installBanner` / `installCta` / `installUnavailable`) | swap "Guezzer" brand refs |
| Share-card gold wordmark | share-card renderer, `config.share.wordmarkGold` text (`config.ts:369`) | → "Gizz With Friends"; size the mark to fit the longer string |

**Header wordmark already done** (`AppShell.tsx:44` reads "Gizz With Friends", commit `30f86cc`). **Never** touch `DB_NAME`, persisted keys, routes, or file paths. SW is `registerType: 'prompt'` — rebrand lands only after the user accepts the update (RESEARCH Pitfall 5).

---

### `packages/app/test/migrationV7.test.ts` (NEW)

**Analog:** `packages/app/test/migrationV5.test.ts` — copy its structure verbatim. AUTH-05.

**Reset idiom to copy** (`migrationV5.test.ts:24-27`):
```typescript
async function resetDb(): Promise<void> {
  db.close();
  await Dexie.delete(config.DB_NAME);
}
```
**Upgrade-preservation idiom** (62-129): seed a `version(6)`-shape DB with the old Dexie constructor, close, reopen through the real schema, `expect(db.verno).toBe(7)`, assert every prior table's rows survive. Then add: the **one-time claim** stamps legacy rows exactly once (re-login is a no-op — assert `dexClaimedBy` meta gates it). Isolation: `fake-indexeddb/auto` via `test/setup.ts`.

## Shared Patterns

### Supabase client singleton (all auth calls)
**Source:** `packages/app/src/db/supabase.ts:33` — `export const supabase = createClient(url, anonKey);`
**Apply to:** `AuthGate.tsx`, `SignInScreen.tsx`, sign-out control, `useAuthIdentity.ts`.
The ONLY `createClient` in the repo (asserted by `packages/core/test/purity.test.ts`). Import `{ supabase }` from it; never build a second client; never import it into `packages/core`.

### Dexie transaction + meta-gate write helper
**Source:** `packages/app/src/db/db.ts` — `setMeta`/`getMeta` (344-350) + the `db.transaction("rw", ...tables, async () => {...})` shape (`markShowAttended` 657-666).
**Apply to:** `claimDex.ts` (exactly-once claim), any new namespacing write helper.

### Dark-on-light orb glyph
**Source:** `show/tuningColor.ts:25` `ORB_TEXT_COLOR = "#0C0C10"` / `dex/rarityStyle.ts:48` `RARITY_ORB_TEXT_COLOR = "#0C0C10"`.
**Apply to:** `IdentityAvatar.tsx` — light identity fill + `#0C0C10` initials. New palette `config.auth.IDENTITY_COLORS` sits **beside** `config.map.MEMBER_COLORS` (`config.ts:722`), decoupled (D-13).

### Shared `<Sheet>` primitive
**Source:** `packages/app/src/components/Sheet.tsx` (bottom-sheet variant, a11y focus-trap/inert built in); usage exemplar `map/AvatarSheet.tsx`.
**Apply to:** the identity sheet (D-14). Reuse `ariaLabel`, `min-h-11` controls, `config.copy` strings — do not hand-roll a new sheet shell.

### Single-config discipline
**Source:** `config.ts` `config.map` block + `config.copy` block.
**Apply to:** new `config.auth` block (`IDENTITY_COLORS` palette + constants) and `config.copy.auth` block (all UI-SPEC strings) — no scattered literals (CLAUDE.md single-config rule).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/app/src/auth/AuthGate.tsx` | gate | request-response | No prior boot-tree interposition exists — the app boots fully synchronously with no gate today. Follow RESEARCH Pattern 2 + blueprint `multi-user-supabase.md` (validated), using `App.tsx`/`main.tsx` as the "shape to preserve," not a copy source. |
| `packages/core/src/identity/` (new dir) | — | — | No `identity/` module exists in core; `map/`-style pure module is the structural precedent for a new subdir + barrel export. |

## Metadata

**Analog search scope:** `packages/app/src/{auth,db,live,map,dex,show,components}`, `packages/app/{index.html,vite.config.ts}`, `packages/core/src/index.ts`, `packages/app/test/`, `packages/core/test/`.
**Files scanned:** ~20 read directly (all named "mirror this" analogs + boot tree + config + tests).
**Pattern extraction date:** 2026-07-22
</content>
</invoke>
