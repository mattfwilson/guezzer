# Phase 20: Presence & Interactions - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 17 (7 new, 6 edited, 4 new tests)
**Analogs found:** 17 / 17 (every file has an in-repo analog — this is a "mirror, don't invent" phase)

> This phase ships **zero net-new architecture**. Every new file is a line-for-line
> structural clone of a shipped Phase-17/18/19 sync file or the Phase-16 toast host.
> All Supabase access stays fenced in `packages/app/src/sync/` (SETUP-04 core-purity
> guard must keep passing — `packages/core` never imports `@supabase/*`).

---

## File Classification

| New/Modified File | New/Edit | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|----------|------|-----------|----------------|---------------|
| `packages/app/src/sync/presenceSync.ts` | NEW | service (sync fence) + store | event-driven / pub-sub | `sync/progressSync.ts` | exact (role + flow) |
| `packages/app/src/sync/usePresence.ts` | NEW | hook (singleton engine) | event-driven | `sync/useProgressSync.ts` | exact |
| `packages/app/src/sync/usePresenceReaders.ts` | NEW | hook (pure reader) | request-response (read) | `sync/useFriendsProgress.ts` | exact |
| `packages/app/src/sync/useVisibilityHidden.ts` | NEW | hook (event store) | event-driven | `live/useOnlineStatus.ts` | exact |
| `packages/app/src/sync/presenceActivity.ts` | NEW | utility (pure derive) | transform | `sync/useFriendsProgress.ts` `buildFriendRows` | role-match (pure fn) |
| `packages/app/src/components/WaveToast.tsx` | NEW | component (toast host) | event-driven / pub-sub | `components/BingoCelebration.tsx` | exact (one deliberate departure: FIFO queue) |
| `packages/app/src/dex/ReactionPalette.tsx` | NEW | component | request-response (send) | `dex/DexView.tsx` segment control + `components/Sheet.tsx` | role-match |
| `packages/app/src/dex/FriendRow.tsx` | EDIT | component | request-response (read) | self (reserved slots already shipped) | exact |
| `packages/app/src/dex/SelfRow.tsx` | EDIT | component | request-response (read) | self + `FriendRow` | exact |
| `packages/app/src/dex/FriendsList.tsx` | EDIT | component | request-response (read) | self | exact |
| `packages/app/src/dex/FriendDetail.tsx` | EDIT | component | request-response (send) | self (header/button idiom) | exact |
| `packages/app/src/config.ts` | EDIT | config | — | self (`config.ui.celebration`, `config.copy.friends`) | exact |
| `packages/app/src/App.tsx` | EDIT | shell (mount point) | — | self (`useProgressSync()` + `<BingoCelebration/>` mounts) | exact |
| `packages/app/test/sync/presenceSync.test.ts` | NEW | test (unit) | — | `test/sync/progressSync.test.ts` | exact |
| `packages/app/test/sync/presenceActivity.test.ts` | NEW | test (unit, pure) | — | `test/sync/progressSync.test.ts` (mock idiom) | role-match |
| `packages/app/test/components/WaveToast.test.tsx` | NEW | test (component) | — | (no direct toast test found — mirror `progressSync.test.ts` store + RTL) | partial |
| `packages/app/test/dex/friendPresence.test.tsx` | NEW | test (component) | — | (RTL over Friends surface) | partial |

---

## Pattern Assignments

### `packages/app/src/sync/presenceSync.ts` (service + module store, event-driven)

**Analog:** `packages/app/src/sync/progressSync.ts` (mirror the two-halves layout: stateless channel primitives + a module-level external store)

**Store seam — copy VERBATIM in shape** (`progressSync.ts:188-245`). The stable-reference contract is load-bearing (Pitfall 4):
```typescript
export interface SyncState { friends: FriendRowData[]; offline: boolean; asOf: number | null; error: string | null; }
let syncState: SyncState = { friends: EMPTY_FRIENDS as FriendRowData[], offline: false, asOf: null, error: null };
const listeners = new Set<() => void>();
export function subscribeSyncState(callback: () => void): () => void { listeners.add(callback); return () => { listeners.delete(callback); }; }
export function getSyncState(): SyncState { return syncState; }          // STABLE ref between writes
export function setSyncState(partial: Partial<SyncState>): void { syncState = { ...syncState, ...partial }; for (const l of listeners) l(); }
export function resetSyncState(): void { /* pristine + notify — test/teardown seam */ }
```
For presence, the store shape becomes `{ onlineIds: ReadonlySet<string>, activityByUser: ReadonlyMap<string, Activity> }` per RESEARCH Pattern 1. Keep `resetPresenceState()` as the test seam (`progressSync.ts:233-245`).

**Channel-open primitive** — mirror `subscribeProgress` (`progressSync.ts:158-172`) but swap `postgres_changes` for presence-sync + broadcast. Note the exact channel-handle type + `removeChannel` wrapper it exports (`progressSync.ts:171-177`):
```typescript
export function subscribeProgress(onChange: () => void): RealtimeChannelHandle {
  const channel = supabase.channel("progress-feed").on("postgres_changes" as any, {...}, () => onChange()).subscribe();
  return channel;
}
export type RealtimeChannelHandle = ReturnType<typeof supabase.channel>;
export async function removeChannel(channel: RealtimeChannelHandle): Promise<void> { await supabase.removeChannel(channel); }
```
New channel per RESEARCH Code Examples: `supabase.channel("gizz-room", { config: { presence: { key: userId, enabled: true } } })` then `.on("presence", { event: "sync" }, …).on("broadcast", { event: "wave" }, …).subscribe(...)`. The `enabled: true` is Pitfall-1 insurance.

**Untrusted-payload validation — mirror `validateFriendRow` (`progressSync.ts:118-145`) EXACTLY** ("malformed → null → skipped, never crash"):
```typescript
function validateFriendRow(raw: unknown, myUserId: string): FriendRowData | null {
  if (raw == null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const { user_id: userId, display_name: displayName, summary } = row;
  if (typeof userId !== "string" || userId.length === 0) return null;
  if (typeof displayName !== "string" || displayName.length === 0) return null;
  if (userId === myUserId) return null;             // drop own row / self-toast
  const parsed = parseSharedProgress(summary); if (parsed == null) return null;
  return { userId, displayName, summary: parsed, ... };
}
```
`validateWave(raw, myUserId)` follows this shape: reject non-object, empty `from`, `from === myUserId` (Pitfall 3), `to` not `null|string`, `to` targeted-at-someone-else, and any emoji outside the fixed 4-set `["👋","🔥","🦎","🎯"]`.

**Supabase import fence** (`progressSync.ts:30`): `import { supabase } from "../db/supabase.ts";` — never `createClient` (that lives only in `db/supabase.ts:33`).

---

### `packages/app/src/sync/usePresence.ts` (singleton engine hook, event-driven)

**Analog:** `packages/app/src/sync/useProgressSync.ts` (the SOLE-owner engine; mount once, render nothing, gate internally)

**Engine lifecycle effect — mirror the `[userId, online]` effect (`useProgressSync.ts:53-97`)** including the per-run `cancelled` guard and channel teardown:
```typescript
useEffect(() => {
  if (!userId) return;                       // signed out → no-op
  let cancelled = false;
  if (!online) { /* hydrate offline / clear presence */ return () => { cancelled = true; }; }
  setSyncState({ offline: false });
  const channel = subscribeProgress(pull);
  pull();
  return () => { cancelled = true; void removeChannel(channel); };
}, [userId, online]);
```
For presence: on `!userId || !online` → `setPresenceState(pristine)` (D-16/17/20); on subscribe → `.track({tab, atShow})`; teardown `removeChannel(ch)` (Pitfall 6). The `.track()` on activity-change belongs in a SECOND effect keyed on the derived payload (mirrors how `useProgressSync` splits subscription `:53` from the debounced upsert `:105`).

**Live inputs — same hooks the engine already composes** (`useProgressSync.ts:40-44`):
```typescript
const identity = useAuthIdentity(); const userId = identity?.userId ?? null; const displayName = identity?.displayName ?? null;
const online = useOnlineStatus();
```
Add the activity trio per RESEARCH Pattern 2: `useHashRoute()` (`routing/useHashRoute.ts:33` → `Route` union `show|explore|map|dex|games|settings`), `useLiveQuery(() => db.trackedShows.where("status").equals("active").first())` (verbatim from `useBingoCelebrations.ts:165-167`), and the new `useVisibilityHidden()`.

**Mount site** — `App.tsx:39` calls `useProgressSync()` unconditionally next to `useBingoCelebrations()` (`App.tsx:29`); `usePresence()` mounts identically (gate lives inside).

---

### `packages/app/src/sync/useVisibilityHidden.ts` (event-store hook, event-driven)

**Analog:** `packages/app/src/live/useOnlineStatus.ts` — the structural twin (swap the `online`/`offline` event pair for `visibilitychange`):
```typescript
function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback); window.addEventListener("offline", callback);
  return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); };
}
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
```
For visibility: `document.addEventListener("visibilitychange", callback)`, snapshot `() => document.visibilityState === "hidden"`, server snapshot `() => false`. This reuses the exact signal Wake Lock listens to (`wakeLock.ts:119-124`) — zero timers (D-02).

---

### `packages/app/src/sync/usePresenceReaders.ts` (pure reader hook, read)

**Analog:** `packages/app/src/sync/useFriendsProgress.ts` — the pure `useSyncExternalStore` reader (owns no channel/debounce):
```typescript
export function useFriendsProgress(): SyncState {
  return useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState);
}
```
Presence readers (e.g. `usePresenceFor(userId)`, `useSelfPresence()`) read the presence store the same way. Every Friends-surface consumer stays a pure reader — no component opens `gizz-room` (the D-19 singleton guarantee; `FriendsList.tsx:5-9` documents this discipline for `progress-feed`).

---

### `packages/app/src/sync/presenceActivity.ts` (pure derive utility, transform)

**Analog:** `buildFriendRows` in `useFriendsProgress.ts:41-61` — a pure, exported, unit-testable transform (no Supabase, no DOM).

Two pure functions to co-locate here (both isolated-testable per RESEARCH test map PRES-04):
1. `deriveActivity(route, hidden, atShow)` → the `{ tab, atShow }` payload. `tab = hidden ? "idle" : ROUTE_TO_TAB[route]`; settings/dev → nearest tab or `idle` (discretion, D-01/02).
2. `reduceActivity(entries)` → collapse the multi-entry presence array to one activity (`atShow` wins, else last entry — Pitfall 2). Presence values are `{ [key]: Presence[] }`, one entry per connection.

---

### `packages/app/src/components/WaveToast.tsx` (toast host, event-driven)

**Analog:** `packages/app/src/components/BingoCelebration.tsx` — clone every discipline; depart ONLY at the queue (D-10).

**Module-emitter half — mirror `BingoCelebration.tsx:71-91` verbatim:**
```typescript
let listener: ((payload: BingoCelebrationPayload) => void) | null = null;
export function showBingoCelebration(payload: BingoCelebrationPayload): void { listener?.(payload); }
export function subscribeBingoCelebration(fn: (payload) => void): () => void { listener = fn; return () => { if (listener === fn) listener = null; }; }
```

**Host disciplines to copy** (`BingoCelebration.tsx:144-219`):
- `const reduce = useReducedMotion() ?? false;` (`:145`)
- height registration so it never covers the live loop: `useBottomOverlayHeightRegistration("waveToast", visible)` (`:152-155`; see also `BackupToast.tsx:48`)
- `role="status"`, `pointer-events-none fixed inset-x-0 bottom-16 … border-t border-hairline bg-elevated px-4 py-4`, `style={{ zIndex: config.ui.z.toast }}` (`:206-212` — `config.ui.z.toast` = 20, `config.ts:280`)
- reduced-motion path is opacity-only, no translate: `initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}` (`:202-205`)
- escaped React text for all sender/emoji strings — never `dangerouslySetInnerHTML` (`:214`)
- `AnimatePresence` keyed on a monotonic `id` so a repeat re-triggers the enter (`:157`, `:197-199`)

**THE DEPARTURE (D-10):** `BingoCelebration` is latest-wins (`setToast(...)`, `:182-184`). `WaveToast` instead buffers in a bounded FIFO ref: on emit, if `queue.length >= config.presence.QUEUE_CAP` DROP (over-cap discarded); else push + kick a drain that shows head for `config.presence.TOAST_MS`, then shifts with `config.presence.DRAIN_GAP_MS` between pops. Use `config.presence` constants — no scattered magic numbers.

**Sender rendering (D-09):** reuse the shared `IdentityGlyph` (`FriendRow.tsx:47-61`) — deterministic color from `config.auth.IDENTITY_COLORS[identityColorIndex(userId, len)]` (`config.ts:775`), initials in `#0C0C10`. Resolve the sender NAME from the trusted friends store by `from` userId, never from the payload (V5).

---

### `packages/app/src/dex/ReactionPalette.tsx` (send surface, send)

**Analog:** the `DexView.tsx:104-127` segment-control button grid + `components/Sheet.tsx` (used at `FriendDetail.tsx:96`, `DexView.tsx:206`).

**Selected-chip / selected-target accent-ring idiom** — echo the segment-control's active-state class swap (`DexView.tsx:117-121`):
```typescript
className={`flex min-h-11 flex-1 items-center justify-center rounded text-[14px] font-semibold touch-manipulation ${active ? "bg-accent text-surface" : "text-text-muted"}`}
```
Per UI-SPEC the palette uses an accent RING (not fill) for selection. Every chip + target row is `min-h-11 min-w-11` (44px floor). Fixed 4 chips `👋 · 🔥 · 🦎 · 🎯 caught it!` (D-06); `aria-label` each (`"Wave"`, `"Fire"`, `"Lizard"`, `"Caught it"`). Target picker: `Everyone` (top/default → `to:null`) + one row per known friend (→ `to:userId`).

**Send path:** both the palette and the FriendDetail button call ONE `sendWave(emoji, to)` primitive → `ch.send({ type: "broadcast", event: "wave", payload: { from, to, emoji } })`. Expose `sendWave` as a module-level function from `presenceSync.ts` that closes over the current channel (null-safe no-op when signed-out/offline) — see RESEARCH Open Question 1.

---

### `packages/app/src/dex/FriendRow.tsx` (EDIT — fill reserved slots)

**Analog:** self. The slots are ALREADY shipped empty (`FriendRow.tsx:96-99` leading, `:115-117` trailing):
```typescript
<span data-slot="presence-online" aria-hidden="true" className="shrink-0" />
...
<span data-slot="presence-activity" aria-hidden="true" className="shrink-0" />
```
Accept `online: boolean` + `activity: Activity | null` props (from a pure `usePresenceReaders` hook keyed by `friend.userId`). Fill the leading slot with an 8px green dot (`h-2 w-2 rounded-full`, `#22C55E` — the shipped `SyncDot` online-green, `SyncDot.tsx:55`) and the trailing slot with the muted-caption activity label (`text-[13px] leading-tight text-text-muted`, echoing `FriendsList.tsx:55`; `At a show 🎸` gets `text-text-primary` emphasis). Dot never conveys state by color alone — pairs with the visible activity label (WCAG 1.4.1). No presence CHANNEL logic here — pure props only (D-13/D-19).

---

### `packages/app/src/dex/SelfRow.tsx` (EDIT — own dot + activity/offline)

**Analog:** self + `FriendRow`. Same reserved slots (`SelfRow.tsx:47-48`, `:63`). Drive the "You" dot from `useOnlineStatus()` + the locally-derived `{tab, atShow}` (what we broadcast) — NOT a round-trip through `presenceState()` (RESEARCH Open Question 3; keeps it offline-safe like the rest of SelfRow, `SelfRow.tsx:1-13`). When `useOnlineStatus()` is false → own dot hidden, activity reads `offline` (D-17).

---

### `packages/app/src/dex/FriendsList.tsx` (EDIT — thin, stay a reader)

**Analog:** self. Currently maps rows at `FriendsList.tsx:76-88`. Add the presence props to each `<FriendRow>`. When offline (`useOnlineStatus()` false) the presence reader returns `online:false`/`activity:null` for everyone (D-16 — hide all dots) while the existing dimmed cached-PROG rows keep rendering unchanged (`:54-59`, `:84` `dimmed={offline}`). Opens no channel — stays a pure reader (`FriendsList.tsx:5-9`).

---

### `packages/app/src/dex/FriendDetail.tsx` (EDIT — pre-targeted wave button)

**Analog:** self (the header/button idiom `FriendDetail.tsx:68-85`). Add a `Wave at {name}` button pre-targeted at `friend.userId`, sharing the one `sendWave(emoji, to)` path (D-07). ≥44px (`min-h-11 min-w-11 … touch-manipulation`, echoing the back button `:77`). Friend name already escaped + clamped (`:57-58`).

---

### `packages/app/src/config.ts` (EDIT — new blocks)

**Analog:** `config.ui.celebration` block (`config.ts:301-320`) for the constants shape; `config.copy.friends` (`config.ts:1373-1402`) for the copy shape.

Add `config.presence = { QUEUE_CAP: 4, TOAST_MS: 1600, DRAIN_GAP_MS: 150 }` (RESEARCH recommendation) mirroring the documented-constant style of `config.ui.celebration:310-320`. Add `config.copy.presence` (title `Send a reaction`, `wave: (name) => \`${name} 👋\``, `wavedAtYou: (name) => \`${name} waved at you 👋\``, `atShow: "At a show 🎸"`, tab labels, `offline`, etc.) mirroring the function-copy style of `config.copy.friends` (`:1379`, `:1390`, `:1396`). Reuse `config.ui.z.toast` (20) and `config.auth.IDENTITY_COLORS` (`:775`) — do NOT mint new tokens.

---

### `packages/app/src/App.tsx` (EDIT — mount engine + host once)

**Analog:** self. `useProgressSync()` is called unconditionally at `App.tsx:39` (next to `useBingoCelebrations()` `:29`); `<BingoCelebration />` and `<BackupToast />` are mounted in the shell JSX (`:110-111`). Add `usePresence();` beside `useProgressSync()` and `<WaveToast />` beside `<BingoCelebration />`. The dev-harness early-return (`:69-71`) stays above the render — place new hooks BEFORE it (rules of hooks).

---

## Shared Patterns

### Singleton engine + module external store + pure readers (the D-19 architecture)
**Source:** `sync/progressSync.ts:188-245` (store) + `sync/useProgressSync.ts:53-97` (engine) + `sync/useFriendsProgress.ts:27-29` (reader)
**Apply to:** `presenceSync.ts`, `usePresence.ts`, `usePresenceReaders.ts`
The engine is the SOLE channel owner; `getSnapshot` returns a STABLE reference between real writes (else `useSyncExternalStore` loops — documented `useAuthIdentity.ts:33-54`, `progressSync.ts:214-221`).

### App-level module-emitter toast host (survives route unmount, non-blocking)
**Source:** `components/BingoCelebration.tsx:71-91` (emitter) + `:144-219` (host) + `components/BackupToast.tsx:23-82`
**Apply to:** `WaveToast.tsx`
`pointer-events-none`, `config.ui.z.toast` (20), `role="status"`, `useReducedMotion()`, `useBottomOverlayHeightRegistration`, escaped text — the live logging loop is never blocked.

### Untrusted-payload validation at the read boundary (malformed → skip, never crash)
**Source:** `sync/progressSync.ts:118-145` (`validateFriendRow`)
**Apply to:** `presenceSync.ts` (`validateWave`, presence-entry reduce)
Every inbound presence entry + broadcast payload is untrusted peer data (V5 primary). Reject non-object / empty `from` / self / other-targeted / unknown-emoji; return `null` → dropped silently; host never throws (V7).

### Deterministic per-user identity glyph + color
**Source:** `dex/FriendRow.tsx:47-61` (`IdentityGlyph`) + `config.auth.IDENTITY_COLORS` (`config.ts:775`)
**Apply to:** `WaveToast.tsx` sender, `ReactionPalette.tsx` target rows
Import `IdentityGlyph` from `FriendRow.tsx` (already exported); never re-derive color logic. `config.ts:773` reserves this palette for "Phase 20 presence dots."

### Reactive browser-event external store (structural twin)
**Source:** `live/useOnlineStatus.ts` / `routing/useHashRoute.ts` / `auth/useAuthIdentity.ts` (all `useSyncExternalStore` over a window/document event)
**Apply to:** `useVisibilityHidden.ts`
Swap only the event pair + snapshot fn. Zero timers (D-02).

### Supabase-singleton mock idiom (for tests)
**Source:** `test/sync/progressSync.test.ts:13-57` — `vi.hoisted` spies + `vi.mock("../../src/db/supabase.ts", …)` exposing `{ from, channel, removeChannel }`
**Apply to:** `test/sync/presenceSync.test.ts`
Extend the mocked `channel()` to return `on/subscribe/track/send/presenceState` spies so PRES-01/03/05 assert only `channel/send/track` fire and NOTHING persists (no Dexie/Postgres write).

---

## No Analog Found

None. Every file maps onto a shipped in-repo pattern. The two component TEST files (`WaveToast.test.tsx`, `friendPresence.test.tsx`) have no exact prior toast/presence test, but reuse the established RTL + jsdom setup and the `progressSync.test.ts:13-57` Supabase-mock idiom — treat as partial analogs, not greenfield.

---

## Metadata

**Analog search scope:** `packages/app/src/sync/`, `packages/app/src/dex/`, `packages/app/src/components/`, `packages/app/src/live/`, `packages/app/src/auth/`, `packages/app/src/routing/`, `packages/app/src/games/`, `packages/app/src/db/`, `packages/app/src/config.ts`, `packages/app/src/App.tsx`, `packages/app/test/sync/`
**Files scanned:** 18 (all read this session; every reuse target named in CONTEXT/RESEARCH verified in code)
**Pattern extraction date:** 2026-07-24
