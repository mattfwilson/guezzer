# Phase 20: Presence & Interactions - Research

**Researched:** 2026-07-24
**Domain:** Supabase Realtime (presence sync + broadcast), React external-store engines, ephemeral toast UX
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Coarse activity vocabulary & "idle" (PRES-04)**
- **D-01:** Broadcast the **real active tab** — full 5-tab vocabulary `LiveGizz / GizzVerse / GizzMap / GizzDex / GizzGames` (NOT the requirement's illustrative 4-value list), plus `idle`.
- **D-02:** `idle` driven by `document.visibilitychange` → `visibilityState === "hidden"`. Event-driven, zero timers. Foreground = current active tab. No no-interaction timeout.
- **D-03:** On LiveGizz, status **upgrades to `At a show 🎸`** when a `db.trackedShows` `status === "active"` row exists; otherwise plain `LiveGizz`. **Boolean flag only** — never per-song (stays clear of the deferred SOCL-V2-01 line). Reuses the same active-session liveQuery `useBingoCelebrations` reads.
- Presence payload ≈ `{ tab, atShow?: boolean }` (identity is the presence key). Settings/dev routes map to a sensible default (nearest tab or `idle`) — Claude's discretion.

**Wave & reaction send UX (PRES-02, PRES-05, PRES-06)**
- **D-04:** **One unified reaction surface** — PRES-02 + PRES-06 collapse into a single "send a reaction" path. Pick emoji, then pick target (everyone = broadcast `to:null`, or one friend = targeted `to:userId`). One send code path, one broadcast event shape.
- **D-05:** Palette led by **wave 👋** as first/default chip.
- **D-06:** Fixed palette is **exactly 4 chips: `👋` · `🔥` · `🦎` · `🎯` (labeled "caught it!")**. `🎯` carries the "caught it!" label; others emoji-only. No custom emoji, no picker.
- **D-07:** A wave can **also be sent from inside `FriendDetail`**, pre-targeted at that friend. Shares the single send path.
- **D-08:** **No send rate-limit** — trust the ~5-friend group. Receive-side queue cap (D-10) bounds on-screen flooding.

**Received wave/reaction toasts (PRES-02, PRES-05, PRES-06)**
- **D-09:** Received toast shows **sender name + emoji, with a "to you" emphasis when targeted** (e.g. `Matt 👋` broadcast vs `Matt waved at you 👋` targeted). Uses the deterministic identity color/initials glyph (shared `IdentityGlyph`). Sender identity always shown.
- **D-10:** **Incoming bursts drain as a brief one-at-a-time queue** (small cap ~3–5): each toast shows briefly, backlog queues + drains fast so a flurry reads as distinct pops. **Deliberate departure from `BingoCelebration`'s single latest-wins toast.** Over-cap overflow is dropped.
- **D-11:** Toasts appear **app-wide (any tab)** — host mounted **once in `App.tsx`**. `pointer-events-none`, at `config.ui.z.toast`, never intercepts a tap. Reduced-motion-aware (`useReducedMotion()`). All strings escaped React text — never `dangerouslySetInnerHTML`.
- **D-12:** **No haptics** — visual toasts only.

**Presence ↔ Friends fusion & dot semantics (PRES-01, PRES-07)**
- **D-13:** **Presence decorates existing synced-progress (PROG) rows ONLY.** An online friend with no synced progress row is not shown. List membership stays PROG-owned; presence fills `FriendRow`'s reserved `data-slot="presence-online"` + `data-slot="presence-activity"` slots. No second list-membership source, no placeholder online-only rows.
- **D-14:** Online dot is **binary — present on the channel right now** (dropped on disconnect). **No "recently seen"** / last-seen timestamps.
- **D-15:** Pinned **"You" row shows its OWN live dot + current activity.**

**Offline / dead-signal venue behavior**
- **D-16:** When **YOU are offline**, **hide ALL online dots + activity labels** — never show a stale green dot. Phase-19 dimmed `offline · as of {time}` cached PROG rows still render.
- **D-17:** When offline, the **"You" row reads `offline`**. Reuses the existing `useOnlineStatus` signal.

**Channel architecture & engine placement (PRES-01…03)**
- **D-18:** Add **ONE new dedicated Realtime channel** (`gizz-room`, presence keyed by `userId`) carrying **both** presence-sync **and** wave/reaction broadcasts — **separate** from Phase-19's `progress-feed` `postgres_changes` channel. Do **not** merge presence onto the progress channel.
- **D-19:** A **new `usePresence()` engine hook** in the app-layer sync fence (`packages/app/src/sync/`, e.g. `presenceSync.ts` + `usePresence.ts` + a shared external store), **mounted ONCE in `App.tsx`** next to `useProgressSync()` / `useBingoCelebrations()`. Gated internally on signed-in identity + online. SOLE owner of the presence channel: `.track()` on subscribe, publishes online-ids + per-user activity + incoming-wave events to a shared store; read hooks stay **pure readers** (`useSyncExternalStore`). Mirrors Phase-19 D-16 singleton pattern exactly. `packages/core` stays Supabase-free (SETUP-04 purity guard must keep passing).

**Privacy & ephemerality (PRES-03)**
- **D-20:** Presence **always-on while signed in** — no invisible/ghost toggle.
- **D-21:** **Missed waves are simply gone** — no queue, no badge, no replay, no history table.

### Claude's Discretion
- Exact toast durations, queue cap value, drain cadence (D-10); palette chip styling/layout and the "React/Wave" entry-point affordance (D-04/D-07).
- Precise presence payload TS shape (`{ tab, atShow? }`), broadcast event shape (`{ from, to, emoji }`), config constant names/location (new `config.presence` / `config.copy.presence`), shared-store shape, channel name, `.track()`/subscribe/reconnect/sign-out teardown wiring (D-18/D-19).
- How Settings/dev routes and the transient `#/dev/orb-fit` harness map into the activity vocabulary (default to nearest tab or `idle`).
- Exact copy strings (`At a show 🎸`, `{name} waved at you 👋`, `{name} 👋`, `offline`, online-dot color/size) and visual treatment of the dot + activity label in the reserved slots.
- Reduced-motion treatment of the wave toast (opacity-only vs gentle float).

### Deferred Ideas (OUT OF SCOPE)
- **Per-song / setlist-position presence** ("on song 7", live shared setlist) → SOCL-V2-01. The `At a show` flag is the closest we go (boolean, never per-song).
- **Missed-wave nudge / recent-waves peek / wave history** → out of scope (needs persistence, against PRES-03).
- **"Recently seen" / last-active timestamps** → deferred (needs persisted state). Dot is binary present-now only (D-14).
- **Invisible / ghost mode** → deferred; presence always-on while signed in (D-20).
- **Send rate-limit / per-target cooldown** → not built; trust the group (D-08).
- **Global app-wide online indicator** (tab badge / header "N online") → not built; presence UI stays on Friends screen + app-wide toasts.
- **Haptics on received waves** → not built (D-12).
- **Surfacing online-only friends** (present but no synced progress row) → not shown (D-13).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES-01 | Online presence dots via Realtime **presence** on one channel keyed by user id — ephemeral, dropped on disconnect, never persisted | §Standard Stack (installed `supabase-js@2.110.8` presence API verified); §Pattern 1 (engine mirrors `progressSync`); §Code Examples (channel setup, `.track()`, `presenceState()` → online-ids) |
| PRES-02 | Send a lightweight wave → transient toast via Realtime **broadcast** on the same channel — ephemeral | §Code Examples (`.on('broadcast',…)` + `channel.send({type:'broadcast',…})`); §Pattern 3 (brief-queue toast host) |
| PRES-03 | Presence + waves ephemeral by construction — never written to Postgres | §Architecture (presence/broadcast need **no migration, no `alter publication`** — Postgres-independent); §Pitfall 5 |
| PRES-04 | Coarse read-only tab-level activity (never per-song) | §Code Examples (activity payload derived from `useHashRoute` + `visibilityState` + active-show liveQuery); §Pattern 2 |
| PRES-05 | Waves targeted (`to:userId`) OR broadcast (`to:null`) | §Code Examples (one `sendWave(emoji, to)` primitive; receiver filters `to === null \|\| to === myUserId`) |
| PRES-06 | Fixed emoji reaction palette → reduced-motion-aware toasts reusing Bingo celebration discipline | §Pattern 3 (mirror `BingoCelebration` host: `useReducedMotion()`, `config.ui.z.toast`, `role="status"`, escaped text, `useBottomOverlayHeightRegistration`) |
| PRES-07 | Presence-aware Friends rows fusing PROG + PRES, no new backend | §Pattern 4 (`FriendRow` reserved slots already shipped; pure reader hook over presence store) |
</phase_requirements>

## Summary

This phase is **almost entirely a reuse-and-mirror exercise**, not a greenfield build. The load-bearing external dependency — `@supabase/supabase-js` — is **already installed at v2.110.8** (verified in `node_modules`), and the exact Realtime presence + broadcast client pattern was **validated live across two remote devices in spike 004**. The blueprint at `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` §"Presence + waves" is correct for the installed version, with one version-specific nuance flagged below (`config.presence.enabled`).

The net-new architecture is a **carbon copy of the Phase-19 `progressSync` singleton engine**: a stateless-primitives + module-level-external-store + one-shell-mounted-engine + pure-reader-hooks quartet, swapping `postgres_changes` for presence-sync and broadcast. The toast surface is a **carbon copy of `BingoCelebration`'s module-emitter + App-level host**, with exactly one deliberate departure: a small **brief-drain queue** (D-10) instead of latest-wins. Every fusion point on the Friends screen — the reserved `FriendRow` slots, the `IdentityGlyph`, the active-show liveQuery, the `useOnlineStatus` gate, the `useAuthIdentity` keying — **already exists and was shipped anticipating this phase**. No new npm packages. No Supabase migration (presence/broadcast are Postgres-independent).

**Primary recommendation:** Build `packages/app/src/sync/presenceSync.ts` (stateless channel primitives + `{ onlineIds, activityByUser, incomingWaves }` external store) + `usePresence.ts` (the one shell-mounted engine, gated on identity+online) + pure reader hooks, mirroring `progressSync.ts`/`useProgressSync.ts` **line-for-line in structure**. Build `WaveToast.tsx` mirroring `BingoCelebration.tsx` with a bounded FIFO queue. Fill the `FriendRow`/`SelfRow` reserved slots via a pure reader. Validate every inbound presence/broadcast payload at the read boundary (mirror `validateFriendRow`'s "malformed → skip, never crash" discipline). Keep all Supabase imports in `packages/app/src/sync/` so the SETUP-04 core-purity test stays green.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Presence sync (who's online + activity) | Supabase Realtime (hosted) | App-layer engine (`sync/`) | Ephemeral state lives on the Realtime broker; the app owns one subscription + a shared store. Never Postgres (PRES-03). |
| Wave/reaction transport | Supabase Realtime broadcast (hosted) | App-layer engine | Fire-and-forget broadcast; no durable store, no server we run. |
| Activity derivation (tab/idle/at-show) | App-layer (browser) | — | Reads `useHashRoute` + `document.visibilityState` + local Dexie active-show. Pure client-side; never leaves the device except as the coarse `{tab, atShow}` payload. |
| Presence/wave payload validation | App-layer read boundary (`sync/`) | — | Untrusted peer data validated + escaped in the app layer, mirroring `validateFriendRow`. Core stays pure. |
| Friends-row dot + activity rendering | App-layer React (`dex/`) | — | Pure `useSyncExternalStore` readers filling already-reserved `FriendRow` slots. |
| Toast rendering | App-layer React (`App.tsx` host) | — | Module-emitter host mounted once at the shell; survives route unmount. |
| Identity / channel keying | App-layer (`auth/` + `db/supabase.ts`) | — | `useAuthIdentity().userId` keys presence and stamps wave `from`; the singleton client opens the channel. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | **2.110.8 (installed)** | Realtime presence + broadcast client | Already the project's single backend dependency (Phase 17). The presence/broadcast API is validated (spike 004) and confirmed against the installed `@supabase/realtime-js@2.110.8` type surface (this research). [VERIFIED: node_modules] |
| React `useSyncExternalStore` | React 19 (installed) | Pure reactive readers over the presence external store | The established Phase-19 seam (`useFriendsProgress`, `useOnlineStatus`, `useAuthIdentity`, `useHashRoute` all use it). [VERIFIED: codebase] |
| `motion` / `motion/react` | 12.x (installed, used by `BingoCelebration`) | Reduced-motion-aware toast enter/exit | The exact library + `useReducedMotion()` gate the celebration layer already uses. Optional per D-11 (CSS transitions acceptable); reuse `BingoCelebration`'s `motion` idiom for consistency. [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dexie-react-hooks` (`useLiveQuery`) | installed | The active-show liveQuery driving `At a show 🎸` (D-03) | Reuse the exact `db.trackedShows.where("status").equals("active").first()` query `useBingoCelebrations` already runs. [VERIFIED: codebase] |
| `lucide-react` | installed | Any palette / entry-point iconography (optional) | Emoji chips are text; icons only if a "React/Wave" button needs a glyph. [ASSUMED — discretion] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One `gizz-room` channel (presence + broadcast) | Two channels (presence-only + broadcast-only) | Rejected by D-18 — the spike blueprint and the requirement both specify ONE channel. Two channels double the subscription overhead for zero benefit. |
| Bounded FIFO queue in React state (D-10) | A third-party toast/notification library | Rejected — mirroring `BingoCelebration`'s hand-rolled host is ~40 lines, keeps the `pointer-events-none`/z-index/reduced-motion/escaped-text discipline identical, and avoids a new dependency + slopcheck surface for a trivial queue. |
| `motion` for the toast | Plain CSS transitions | Viable (D-11 says "start with CSS"). `motion` chosen for parity with the celebration layer's reduced-motion path; either is acceptable. |

**Installation:** **None.** No new packages. `@supabase/supabase-js@2.110.8` is already a dependency of `packages/app`; all other libraries are installed.

**Version verification:**
```
$ node -e "require('@supabase/supabase-js/package.json').version"  → 2.110.8   [VERIFIED: node_modules]
$ node -e "require('@supabase/realtime-js/package.json').version"  → 2.110.8   [VERIFIED: node_modules]
packages/app/package.json → "@supabase/supabase-js": "2.110.8"                  [VERIFIED: codebase]
```

## Package Legitimacy Audit

> **No external packages are installed by this phase.** The sole backend dependency (`@supabase/supabase-js`) was vetted and installed in Phase 17 and is unchanged here. There is nothing to slopcheck. Disposition: **N/A — no new dependencies.**

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
   ACTIVITY SOURCES       │            usePresence() ENGINE              │
   (browser, app-layer)   │       (mounted ONCE in App.tsx, D-19)        │
                          │                                              │
  useHashRoute() ─────────┼─► derive { tab, atShow } ──► ch.track(...)   │
  visibilityState ────────┤        (D-01/02/03)          on SUBSCRIBED   │
  trackedShows(active) ───┘                              + on change     │
                          │                                              │
  useAuthIdentity() ──────┼─► presence key = userId, wave `from` stamp   │
  useOnlineStatus() ──────┼─► GATE (offline → teardown, D-16/17)         │
                          │                                              │
                          │   ch = supabase.channel("gizz-room",         │
                          │          {config:{presence:{key:userId}}})   │
                          └──────────────┬──────────────┬────────────────┘
                                         │ .on(presence │ .on(broadcast
                                         │   sync)      │   wave)
                          ┌──────────────▼──────────────▼────────────────┐
                          │   SUPABASE REALTIME BROKER (hosted, no DB)    │◄──► peers
                          │   presenceState() + broadcast fan-out         │
                          └──────────────┬──────────────┬────────────────┘
                                         │              │
                          ┌──────────────▼──────────────▼────────────────┐
                          │  VALIDATE at read boundary (malformed→skip)   │
                          │  publish to MODULE-LEVEL EXTERNAL STORE:      │
                          │  { onlineIds:Set, activityByUser:Map,         │
                          │    incomingWaves: emitter }                   │
                          └───────┬───────────────┬──────────────┬───────┘
             useSyncExternalStore │               │              │ module emitter
                          ┌───────▼──────┐ ┌───────▼──────┐ ┌─────▼─────────────┐
                          │ FriendRow /  │ │ SelfRow      │ │ WaveToast host    │
                          │ FriendsList  │ │ (You dot +   │ │ (App.tsx, brief   │
                          │ (dot+activity│ │  status/     │ │  FIFO queue,      │
                          │  in reserved │ │  offline)    │ │  pointer-events-  │
                          │  slots)      │ │  D-15/17     │ │  none, D-10/11)   │
                          └──────────────┘ └──────────────┘ └───────────────────┘
   SEND PATH:  palette (pick emoji → pick target) OR FriendDetail button
               → sendWave(emoji, to) → ch.send({type:"broadcast",event:"wave",
                                                 payload:{from,to,emoji}})   (D-04/05/07)
```

File-to-implementation mapping is in the Component Responsibilities table below, not the diagram.

### Recommended Project Structure
```
packages/app/src/
├── sync/
│   ├── presenceSync.ts        # NEW: stateless channel primitives + external store
│   │                          #      (mirror progressSync.ts: subscribe*/get*/set*)
│   ├── usePresence.ts         # NEW: the ONE shell-mounted engine (mirror useProgressSync.ts)
│   └── usePresenceReaders.ts  # NEW: pure useSyncExternalStore readers
│   │                          #      (useOnlineIds / useActivity / useSelfPresence)
│   │                          #      — or co-locate in presenceSync.ts like Phase 19
├── components/
│   └── WaveToast.tsx          # NEW: module-emitter + App-level host w/ brief FIFO
│                              #      queue (mirror BingoCelebration.tsx, depart D-10)
├── dex/
│   ├── FriendRow.tsx          # EDIT: fill reserved data-slot="presence-online" +
│   │                          #       data-slot="presence-activity"
│   ├── SelfRow.tsx            # EDIT: own dot + activity/offline (D-15/17)
│   ├── FriendsList.tsx        # EDIT (thin): pass presence to rows (stay a reader)
│   ├── FriendDetail.tsx       # EDIT: pre-targeted wave button (D-07)
│   └── ReactionPalette.tsx    # NEW: 4-chip palette + target picker (D-04/05/06)
├── config.ts                  # EDIT: config.presence + config.copy.presence + reuse config.ui.z.toast
└── App.tsx                    # EDIT: mount usePresence() + <WaveToast/> once
```

### Pattern 1: Singleton engine + module external store + pure readers (MIRROR `progressSync`)
**What:** One shell-mounted hook owns the single Realtime channel and writes a module-level store; every consumer is a `useSyncExternalStore` reader.
**When to use:** This is the locked D-19 architecture. Copy `progressSync.ts`'s shape exactly.
**Example:** (adapted from the verified Phase-19 store; see `packages/app/src/sync/progressSync.ts:179-245`)
```typescript
// presenceSync.ts — mirror the progressSync external-store seam VERBATIM in shape.
export interface PresenceState {
  onlineIds: ReadonlySet<string>;          // Object.keys(presenceState())
  activityByUser: ReadonlyMap<string, Activity>;  // per-user coarse status
}
let presenceState: PresenceState = { onlineIds: new Set(), activityByUser: new Map() };
const listeners = new Set<() => void>();
export function subscribePresenceState(cb: () => void): () => void { listeners.add(cb); return () => listeners.delete(cb); }
export function getPresenceState(): PresenceState { return presenceState; }        // STABLE ref between writes
export function setPresenceState(next: PresenceState): void {                       // engine-only writer
  presenceState = next; for (const l of listeners) l();
}
export function resetPresenceState(): void { /* pristine signed-out shape + notify (test/teardown seam) */ }
```
> Note the **stable-reference contract** (`progressSync.ts:214-221` and `useAuthIdentity.ts:33-54`): `getPresenceState` must return the same object reference between real writes or `useSyncExternalStore` loops with "Maximum update depth exceeded". Only replace the module object on a genuine change.

### Pattern 2: Activity derivation (tab + idle + at-show) — event-driven, zero timers
**What:** Compute the coarse `{ tab, atShow }` payload from three live browser/Dexie sources and re-`track()` on any change.
**When to use:** D-01/D-02/D-03. The engine watches all three and calls `ch.track(payload)` whenever the derived payload changes (and once on SUBSCRIBED).
**Example:**
```typescript
// Inside usePresence(): three reactive inputs, one derived payload.
const route = useHashRoute();                         // "show"|"explore"|"map"|"dex"|"games"|"settings"
const active = useLiveQuery(() => db.trackedShows.where("status").equals("active").first());
const hidden = useVisibilityHidden();                 // NEW tiny useSyncExternalStore over "visibilitychange" (D-02)
// Map Route → tab label; settings/dev → nearest tab or "idle" (discretion).
const tab = hidden ? "idle" : ROUTE_TO_TAB[route];
const atShow = route === "show" && active != null;    // boolean flag ONLY (D-03) — never the setlist
// effect: when {tab, atShow} changes AND subscribed → ch.track({ tab, atShow })
```
> **Reuse the exact visibility signal Wake Lock listens to** — see `wakeLock.ts:115-129` (`document.addEventListener("visibilitychange", …)`, guards `document.visibilityState`). Build a small `useVisibilityHidden()` `useSyncExternalStore` over `visibilitychange` reading `document.visibilityState === "hidden"` — the structural twin of `useOnlineStatus.ts` (swap the `online`/`offline` pair for `visibilitychange`). **Zero timers** (D-02).

### Pattern 3: Brief-drain FIFO toast queue (MIRROR `BingoCelebration`, depart at the queue)
**What:** A module-emitter + App-level host, identical to `BingoCelebration` in every discipline (z-index, `pointer-events-none`, `role="status"`, `useReducedMotion()`, escaped text, `useBottomOverlayHeightRegistration`) **except** it buffers incoming waves in a small FIFO and drains one-at-a-time.
**When to use:** D-10/D-11. This is the single intentional departure from the celebration layer.
**Example:**
```typescript
// WaveToast.tsx — the emitter half mirrors BingoCelebration.tsx:71-91 exactly.
let listener: ((w: WaveToastPayload) => void) | null = null;
export function showWaveToast(w: WaveToastPayload): void { listener?.(w); }
export function subscribeWaveToast(fn: (w: WaveToastPayload) => void): () => void { listener = fn; return () => { if (listener === fn) listener = null; }; }

// Host half: bounded queue instead of BingoCelebration's single latest-wins setToast.
const QUEUE_CAP = config.presence.QUEUE_CAP;          // ~3–5 (discretion, D-10)
const queueRef = useRef<WaveToastPayload[]>([]);
// on emit: if queue.length >= QUEUE_CAP → DROP (over-cap overflow discarded, D-10); else push + kick drain.
// drain: show head for config.presence.TOAST_MS, then shift + show next until empty.
```
> The reduced-motion path must match the celebration reduced path (opacity-only, no translate — `BingoCelebration.tsx:202-205`). Render the sender via the shared `IdentityGlyph` (D-09). Register height via `useBottomOverlayHeightRegistration("waveToast", visible)` so it never covers the live-log loop (`BingoCelebration.tsx:152-155`, `BackupToast.tsx:48`).

### Pattern 4: Fill the reserved FriendRow slots (pure reader, no rebuild)
**What:** `FriendRow.tsx:96-99` and `:115-117` (and `SelfRow.tsx:47-48`, `:63`) already ship empty `data-slot="presence-online"` / `data-slot="presence-activity"` spans. Fill them from the presence store.
**When to use:** PRES-07 / D-13. The hardest fusion constraint is pre-scaffolded.
**Example:** Pass `online: boolean` + `activity: Activity | null` props into `FriendRow` (from a pure `usePresenceReaders` hook keyed by `friend.userId`), rendered into the existing slots. When `useOnlineStatus()` is false, the reader returns `online:false`/`activity:null` for everyone (D-16 — hide all dots), while `FriendsList` keeps rendering the dimmed cached PROG rows (unchanged Phase-19 behavior).

### Anti-Patterns to Avoid
- **Opening a second channel from a component.** Only `usePresence()` opens `gizz-room`. Every UI consumer is a `useSyncExternalStore` reader (the D-16/D-19 singleton guarantee). `FriendsList` already models this — it "opens NO `postgres_changes` channel and starts NO debounce of its own" (`FriendsList.tsx:5-9`).
- **Merging presence onto `progress-feed`.** D-18 forbids it — keep ephemeral (`gizz-room`) cleanly separate from durable (`progress-feed`).
- **Deriving `At a show` from anything richer than a boolean.** Passing song/position crosses the deferred SOCL-V2-01 line (D-03). The payload is `{ tab, atShow?: boolean }` — nothing more.
- **`dangerouslySetInnerHTML` for sender names/emoji.** Escaped React text only (D-11, mirrors `FriendRow.tsx:11-16` / `FriendDetail.tsx:57-58`).
- **Timers for idle.** D-02 is event-driven off `visibilitychange` only. No `setTimeout` inactivity clock.
- **Trusting inbound payloads.** Validate shape at the read boundary; ignore malformed events; never crash the host (mirror `validateFriendRow`, `progressSync.ts:118-145`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Who's online + drop-on-disconnect | A heartbeat/ping table + TTL sweep | `supabase.channel(..).track()` + `presenceState()` | Realtime presence handles join/leave/disconnect natively and is ephemeral by construction (PRES-01/03). A DB heartbeat would violate PRES-03. |
| Wave transport | A `waves` Postgres table + insert/subscribe | `channel.send({type:"broadcast",…})` | Broadcast is fire-and-forget, leaves no trace (PRES-02/03). A table would need cleanup + violate ephemerality. |
| Reactive presence in React | A custom event bus + `useState` fan-out | Module external store + `useSyncExternalStore` | The established Phase-19 pattern; guarantees the singleton engine + stable snapshots. |
| Toast host that survives route unmount | A component-owned toast inside `DexView`/`FriendsList` | App-level module-emitter host (`BingoCelebration`/`BackupToast` idiom) | A wave must reach you in Show Mode / any tab; a segment-owned toast is torn down on route change (`BackupToast.tsx:8-15`). |
| Idle detection | A no-interaction timeout with timers | `document.visibilitychange` → `visibilityState` (D-02) | Zero timers, reuses the Wake Lock signal, honest "tab backgrounded" semantics. |
| Deterministic per-user color/initials | New color logic | `IdentityGlyph` + `identityColorIndex` (already shared) | `FriendRow.tsx:47-61` exports the exact glyph; `config.auth.IDENTITY_COLORS` is reused by Phase-19 rows AND explicitly reserved for "Phase 20 presence dots" (`config.ts:773`). |

**Key insight:** The entire ephemeral layer (presence + waves) needs **zero Postgres and zero migration** — this is why the phase is Postgres-independent and needed nothing from Phase 19 beyond the Friends UI surface. Broadcast + presence are on by default on every Realtime channel; only `postgres_changes` requires `alter publication supabase_realtime add table …` (a Phase-17 concern that does NOT apply here).

## Runtime State Inventory

> This is not a rename/refactor phase. Included briefly because it introduces a new Realtime channel and a new config block that touch runtime/service state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — PRES-03 forbids persistence; nothing written to Postgres, IndexedDB, or localStorage for presence/waves. Verified against D-03/D-14/D-21 (no last-seen, no history, no missed-wave replay). | None |
| Live service config | **New Realtime channel `gizz-room`** opened at runtime from the client. **No Supabase dashboard change, no migration, no `alter publication`** — presence + broadcast are enabled by default on all channels. Realtime was enabled in Phase 17. | None (verify Realtime is enabled on the project — it was, Phase 17) |
| OS-registered state | None. | None |
| Secrets/env vars | **None new.** Uses the existing public `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` via the Phase-17 singleton (`db/supabase.ts:24-33`). Anon key is public by design. | None |
| Build artifacts | None — no new package, no artifact rename. | None |

**Note on channel privacy:** The `gizz-room` channel is a **public** channel (no `private:true`). On public channels, presence read + broadcast require no RLS policy. If the channel were ever made private, `config.presence.enabled` receipt would additionally require a `presence.read` policy (see `RealtimeChannel.d.ts:44-45`) — **not** needed this phase.

## Common Pitfalls

### Pitfall 1: `config.presence.enabled` gate in realtime-js 2.110.8 (version-specific)
**What goes wrong:** In the installed `@supabase/realtime-js@2.110.8`, a client only *receives* presence state if `config.presence.enabled` is true **or** it registers an `.on('presence', …)` listener (which auto-enables it). Without either, `presenceState()` stays **empty and no presence events fire** for this client — even though its own `.track()` still makes it visible to others. This is newer than the spike blueprint's validation snapshot.
**Why it happens:** The presence state machine buffers incoming updates until it receives an initial snapshot, which is only requested when the flag/listener is present (`RealtimeChannel.d.ts:32-45`).
**How to avoid:** The engine registers `.on('presence', { event: 'sync' }, …)` anyway, so presence is auto-enabled. **Belt-and-suspenders:** ALSO set `config: { presence: { key: userId, enabled: true } }` explicitly so a future refactor that reorders/removes the listener can't silently blank all dots.
**Warning signs:** Your own dot shows (you `track()`), but no friends ever appear online despite being present.

### Pitfall 2: `presenceState()` returns an ARRAY of entries per key (multi-tab/device)
**What goes wrong:** `presenceState()` is typed `{ [key: string]: Presence<T>[] }` (`RealtimePresence.d.ts:7-11`) — each key (userId) maps to an **array**, one entry per open connection (a friend with two tabs, or phone + laptop, appears as 2+ entries under the same userId). Naively reading `presenceState()[userId].tab` is a type error / undefined; naively taking `[0]` may show a stale tab.
**Why it happens:** Presence tracks per-connection, keyed by your chosen `key`. Multiple connections legitimately share a key.
**How to avoid:** `onlineIds = new Set(Object.keys(state))` for the dots (any entry = online). For the **activity** map, reduce the array deterministically: prefer the "most active" (e.g. `atShow` true wins; else the last entry). Document the reduction rule in the engine.
**Warning signs:** A friend's activity label flickers between two tabs, or shows their background tab instead of foreground.

### Pitfall 3: Sender toasting themselves (broadcast `self`)
**What goes wrong:** If `config.broadcast.self` is enabled, the sender receives their own wave and toasts themselves.
**Why it happens:** `broadcast.self` defaults to **false** (`RealtimeChannel.d.ts:17,26-31`) — so by default this is NOT a problem. But if someone enables `self` (e.g. copied from an ack example), the sender self-toasts.
**How to avoid:** Do **not** set `broadcast: { self: true }`. Additionally, defensively drop any inbound wave where `payload.from === myUserId` at the read boundary (cheap insurance).
**Warning signs:** You see your own `You 👋` toast after sending.

### Pitfall 4: Stale-reference loop in the external store
**What goes wrong:** `useSyncExternalStore` requires `getSnapshot` to return a stable reference while unchanged; returning a freshly-built object each call throws "Maximum update depth exceeded".
**Why it happens:** Same footgun documented in `useAuthIdentity.ts:33-54` and `progressSync.ts:214-221`.
**How to avoid:** `getPresenceState()` returns the module object; `setPresenceState` replaces it only on a **real** change. When deriving `onlineIds`/`activityByUser` from a presence-sync event, compute the new object once and store it — never rebuild on every read.
**Warning signs:** React error overlay "Maximum update depth exceeded" the moment a presence consumer mounts.

### Pitfall 5: Accidentally persisting ephemeral state (PRES-03 violation)
**What goes wrong:** Adding a `waves` table, a last-seen timestamp, or caching presence in Dexie "for offline" quietly violates PRES-03 and the whole Postgres-independent framing.
**Why it happens:** The instinct to make things durable/offline-resilient (correct for PROG) is wrong for PRES.
**How to avoid:** Presence/waves live ONLY in the in-memory external store + the Realtime broker. Nothing touches Postgres/Dexie/localStorage. The offline story is D-16/D-17 (hide dots, "You = offline") — honest absence, not cached presence.
**Warning signs:** A migration file, a Dexie `presence`/`waves` table, or a `last_seen` column appearing in the plan.

### Pitfall 6: Channel teardown / reconnect / sign-out leaks
**What goes wrong:** Not calling `supabase.removeChannel(ch)` on sign-out or offline leaves the channel subscribed (and you `track()`ed as online after you've "left").
**Why it happens:** Same lifecycle the Phase-19 engine handles (`useProgressSync.ts:93-97` returns `removeChannel` cleanup; re-runs on `[userId, online]` change).
**How to avoid:** Mirror `useProgressSync`'s effect exactly: gate on `userId && online`; on offline or sign-out, `removeChannel(ch)` (optionally `ch.untrack()` first) in cleanup; re-subscribe + re-`track()` on reconnect. The `[userId, online]` dependency array drives this.
**Warning signs:** A friend shows online after they signed out or lost signal; duplicate `track()` entries.

## Code Examples

Verified against the installed `@supabase/realtime-js@2.110.8` type surface and the spike-004 blueprint.

### Channel setup + presence + broadcast (stateless primitive in `presenceSync.ts`)
```typescript
// Source: spike-004 blueprint (multi-user-supabase.md §"Presence + waves") +
//         realtime-js@2.110.8 type surface (RealtimeChannel.d.ts:320,381,540; RealtimePresence.d.ts:7)
import { supabase } from "../db/supabase.ts";  // the ONE app-layer client singleton (SETUP-04)

export interface WavePayload { from: string; to: string | null; emoji: string; }  // to:null = everyone (PRES-05)

export function openPresenceChannel(
  userId: string,
  onPresenceSync: (state: Record<string, Array<Record<string, unknown>>>) => void,
  onWave: (raw: unknown) => void,
) {
  const ch = supabase.channel("gizz-room", {
    config: { presence: { key: userId, enabled: true } },  // enabled:true — Pitfall 1 insurance
  });
  ch.on("presence", { event: "sync" }, () => onPresenceSync(ch.presenceState()))
    .on("broadcast", { event: "wave" }, ({ payload }) => onWave(payload))  // validate in onWave (Pitfall)
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // initial track happens in the engine so it carries the current {tab, atShow}
      }
    });
  return ch;
}

// Derive online-ids + per-user activity from presenceState() (Pitfall 2: value is an ARRAY).
export function readPresence(state: Record<string, Array<Record<string, unknown>>>) {
  const onlineIds = new Set(Object.keys(state));
  const activityByUser = new Map<string, Activity>();
  for (const [uid, entries] of Object.entries(state)) {
    const a = reduceActivity(entries);   // atShow wins, else last entry; validate each (Pitfall)
    if (a) activityByUser.set(uid, a);
  }
  return { onlineIds, activityByUser };
}
```

### Track activity + send a wave
```typescript
// Source: RealtimeChannel.d.ts:320 (track), :540 (send); spike-004 blueprint
await ch.track({ tab, atShow });  // on SUBSCRIBED and on every {tab,atShow} change (D-01/02/03)

// One send path for BOTH the palette and the FriendDetail button (D-04/05/07).
export async function sendWave(ch: RealtimeChannel, from: string, to: string | null, emoji: string) {
  await ch.send({ type: "broadcast", event: "wave", payload: { from, to, emoji } });  // to:null = everyone
}
```

### Validate an untrusted inbound wave at the read boundary (mirror `validateFriendRow`)
```typescript
// Source: mirrors progressSync.ts:118-145 "malformed → null → skipped, never crash"
const ALLOWED_EMOJI = new Set(["👋", "🔥", "🦎", "🎯"]);  // fixed palette (D-06)
function validateWave(raw: unknown, myUserId: string): WavePayload | null {
  if (raw == null || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  if (typeof w.from !== "string" || w.from.length === 0) return null;
  if (w.from === myUserId) return null;                       // Pitfall 3 insurance
  if (!(w.to === null || typeof w.to === "string")) return null;
  if (w.to != null && w.to !== myUserId) return null;         // targeted-at-someone-else → ignore (PRES-05)
  if (typeof w.emoji !== "string" || !ALLOWED_EMOJI.has(w.emoji)) return null;  // reject unknown emoji
  return { from: w.from, to: w.to as string | null, emoji: w.emoji };
}
// Sender display name for the toast: resolve from the friends store by `from` userId
// (never trust a name in the payload) → render via IdentityGlyph + escaped React text (D-09/11).
```

### Engine effect lifecycle (mirror `useProgressSync`'s `[userId, online]` effect)
```typescript
// Source: mirrors useProgressSync.ts:53-97
useEffect(() => {
  if (!userId || !online) {                       // signed-out OR offline → no presence (D-16/17/20)
    setPresenceState(/* pristine: empty onlineIds/activity */);
    return;
  }
  const ch = openPresenceChannel(userId,
    (state) => setPresenceState(readPresence(state)),
    (raw) => { const w = validateWave(raw, userId); if (w) showWaveToast(toToast(w)); });
  // channel ref kept so the SEND path (palette/FriendDetail) can reach it — expose via the store or a ref.
  return () => { void supabase.removeChannel(ch); };  // teardown on sign-out/offline (Pitfall 6)
}, [userId, online]);
```
> The `.track({tab, atShow})` call belongs in a **second** effect keyed on the derived payload + a "subscribed" flag, so activity changes re-track without tearing the channel down (mirrors how `useProgressSync` splits subscription from the debounced upsert into separate effects, `useProgressSync.ts:53` vs `:105`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Presence receipt implicit (any subscriber gets state) | `config.presence.enabled` flag (auto-enabled by an `.on('presence')` listener) | realtime-js ~2.9x+ (present in installed 2.110.8) | Set `enabled:true` explicitly as insurance (Pitfall 1). |
| Spike blueprint `presence:{key}` only | Same works; blueprint validated against installed version | — | Blueprint is accurate; add `enabled:true` only. |

**Deprecated/outdated:** Nothing in the blueprint is deprecated. The `channel().on(...).subscribe(...)` + `presenceState()` + `send({type:'broadcast'})` surface used by spike 004 is intact in 2.110.8.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `broadcast.self` defaults to `false` in 2.110.8 (sender doesn't self-toast without opt-in) | Pitfall 3 | LOW — mitigated by defensively dropping `from === myUserId` regardless. |
| A2 | Public `gizz-room` channel needs no RLS policy for presence/broadcast (channel is not `private`) | Runtime State Inventory | LOW — matches spike-004 (validated on a public channel); only `private:true` channels need policies. |
| A3 | `motion` reduced-motion path is acceptable/desired for the wave toast (vs plain CSS) | Standard Stack | NONE — D-11 leaves this to discretion; either works. |
| A4 | Settings/dev routes mapping to "idle"/nearest-tab is acceptable | Pattern 2 | NONE — explicitly Claude's discretion in CONTEXT. |
| A5 | Reducing multi-entry presence arrays by "atShow wins, else last" is a sensible activity rule | Pitfall 2 | LOW — a display nicety; any deterministic reduction satisfies the requirement. |

## Open Questions

1. **Exposing the channel handle to the send path.**
   - What we know: `usePresence()` owns the channel; the palette + `FriendDetail` button must call `sendWave` on that same channel.
   - What's unclear: whether to stash the live `RealtimeChannel` in the external store, a module-level ref, or expose a `sendWave(emoji, to)` function from the store that closes over the channel.
   - Recommendation: expose a module-level `sendWave(emoji, to)` from `presenceSync.ts` that the engine wires to the current channel (null-safe no-op when signed-out/offline) — keeps UI components pure callers, mirrors how the store is the single seam. Planner to decide the exact shape.

2. **Queue cap + durations concrete values (D-10).**
   - What we know: cap ~3–5, brief per-toast duration, fast drain.
   - What's unclear: exact ms. `BingoCelebration` uses 1800–2000ms toasts.
   - Recommendation: `config.presence = { QUEUE_CAP: 4, TOAST_MS: 1600, DRAIN_GAP_MS: 150 }` as a starting point (tune on-device). Keep all in `config.presence` per the single-config rule.

3. **Self-presence source for the "You" row (D-15).**
   - What we know: SelfRow is sourced from LOCAL dex/identity (never the Supabase read path) for offline-safety (`SelfRow.tsx:1-13`).
   - What's unclear: whether the "You" dot/activity reads the local derived payload directly (what we `track()`) or reflects our own entry in `presenceState()`.
   - Recommendation: drive the "You" dot from `useOnlineStatus()` + the locally-derived `{tab, atShow}` (what we're broadcasting) — not a round-trip through `presenceState()`. Honest, instant, offline-safe (D-15/17).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` | Realtime presence + broadcast | ✓ | 2.110.8 (installed) | — |
| Supabase Realtime (hosted) | PRES-01/02/04 | ✓ | Enabled Phase 17 (project ref `yunfqfldgbgjdqzywbdy`) | — (no fallback; feature requires it) |
| React 19 `useSyncExternalStore` | All reader hooks | ✓ | installed | — |
| `motion` | Toast animation | ✓ | installed (used by BingoCelebration) | Plain CSS transitions (D-11) |
| Vitest + jsdom | Engine/reader/toast tests | ✓ | vitest 4 (root config) | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** `motion` → CSS transitions (already sanctioned by D-11).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 (root `vitest.config.ts`, `test.projects`) |
| Config file | `C:\Users\mattf\git\guezzer\vitest.config.ts` — app project runs under **jsdom** with `@vitejs/plugin-react` |
| Quick run command | `npx vitest run packages/app/test/sync` (scoped) |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRES-01 | `presenceState()` → online-ids Set; drop on leave; keyed by userId | unit | `npx vitest run packages/app/test/sync/presenceSync.test.ts` | ❌ Wave 0 |
| PRES-03 | Nothing persisted — no Dexie/Postgres write in the presence path (assert only `channel`/`send`/`track` spies fire) | unit | same file | ❌ Wave 0 |
| PRES-04 | Activity derivation: route→tab, `visibilityState==="hidden"`→idle, active-show→`atShow` (pure fn) | unit | `npx vitest run packages/app/test/sync/presenceActivity.test.ts` | ❌ Wave 0 |
| PRES-05 | `sendWave` emits `{type:"broadcast",event:"wave",payload:{from,to,emoji}}`; receiver keeps `to===null\|\|to===me`, drops `to===other` | unit | `presenceSync.test.ts` | ❌ Wave 0 |
| PRES-05 | `validateWave` rejects malformed / unknown-emoji / self / other-targeted payloads (never throws) | unit | `presenceSync.test.ts` | ❌ Wave 0 |
| PRES-06 | Brief-queue host: FIFO drains one-at-a-time, over-cap dropped, reduced-motion path, escaped text | component | `npx vitest run packages/app/test/components/WaveToast.test.tsx` | ❌ Wave 0 |
| PRES-07 | FriendRow fills reserved slots from presence; offline (`useOnlineStatus=false`) hides all dots but keeps dimmed PROG rows | component | `npx vitest run packages/app/test/dex/friendPresence.test.tsx` | ❌ Wave 0 |
| SETUP-04 | Core stays Supabase-free after this phase | guard | `npx vitest run packages/core/test/purity.test.ts` (existing — must stay green) | ✅ |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/app/test/sync` (+ the touched component test)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green (incl. `packages/core/test/purity.test.ts`) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/app/test/sync/presenceSync.test.ts` — covers PRES-01/03/05 (mock the `supabase` singleton exactly as `test/sync/progressSync.test.ts:13-46`: `channel/on/subscribe/track/send/removeChannel/presenceState` spies via `vi.hoisted` + `vi.mock("../../src/db/supabase.ts")`)
- [ ] `packages/app/test/sync/presenceActivity.test.ts` — covers PRES-04 (pure activity-derivation fn; no DOM needed)
- [ ] `packages/app/test/components/WaveToast.test.tsx` — covers PRES-06 (queue drain/cap, reduced-motion, escaped text)
- [ ] `packages/app/test/dex/friendPresence.test.tsx` — covers PRES-07 (slot fill + offline hide)
- [ ] Framework install: none — Vitest + jsdom + the Supabase-mock idiom already exist.

## Security Domain

**ASVS Level 1** (`security_asvs_level: 1`, `security_enforcement: true`, block on high).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (reused) | Presence keys off the Phase-18 signed-in identity (`useAuthIdentity`); no new auth surface. |
| V3 Session Management | no (reused) | Existing Supabase session; channel opens only while signed in (D-20). |
| V4 Access Control | yes | Targeted waves: receiver enforces `to === null \|\| to === myUserId` at the read boundary — a wave targeted at someone else is ignored (PRES-05). Public channel, no durable data, RLS not applicable to broadcast/presence. |
| V5 Input Validation | **yes (primary)** | Every inbound presence entry + broadcast payload is untrusted peer data. Validate shape, reject unknown emoji (fixed 4-set), drop `from === self` / other-targeted, **never crash the host** — mirror `validateFriendRow` (`progressSync.ts:118-145`). |
| V6 Cryptography | no | No secrets handled; anon key is public by design. |
| V7 Error Handling | yes | Malformed events skipped silently (calm no-op), never thrown — the toast host and Friends screen must never crash on a hostile payload. |

### Known Threat Patterns for Supabase Realtime presence/broadcast
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via a hostile `display_name`/emoji in a wave | Tampering | Escaped React text only; never `dangerouslySetInnerHTML` (D-11). Resolve sender name from the trusted friends store by `from` userId, not from the payload. |
| Malformed/oversized broadcast payload crashing the host | Denial of Service | `validateWave` returns `null` → skipped; unknown emoji rejected against the fixed 4-set; host never throws (V5/V7). |
| Spoofed `from` (impersonating another user) | Spoofing | LOW residual — a private ~5-friend tool; `from` is advisory. Mitigation: resolve identity/glyph by the `from` userId against the known friends set; an unknown `from` still renders safely as escaped text. (Cryptographic sender-auth is out of scope for a personal tool; note as accepted residual.) |
| Wave-flood / on-screen spam | Denial of Service | Receive-side brief-queue **cap with over-cap drop** (D-10) bounds on-screen flooding regardless of send rate (D-08 accepts no send limit). |
| Presence used to leak fine-grained activity | Information disclosure | Coarse tab-level only, never per-song (D-03 hard scope line); payload is `{tab, atShow:boolean}`. |

## Sources

### Primary (HIGH confidence)
- `node_modules/@supabase/realtime-js@2.110.8` type surface — `RealtimeChannel.d.ts` (`track` :320, `send` :540, `broadcast/presence` config :14-56, presence `.on` :337-354, broadcast `.on` :381-404, `subscribe` :296) and `RealtimePresence.d.ts` (`RealtimePresenceState` :7-11) — the installed API, directly verified.
- `packages/app/package.json` + `node -e require(...).version` → `@supabase/supabase-js` **2.110.8**, `@supabase/realtime-js` **2.110.8** — VERIFIED.
- `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` §"Presence + waves" + `SKILL.md` — spike 004 VALIDATED across two remote devices (the exact channel/track/broadcast pattern).
- Codebase reuse targets, all read this session: `sync/progressSync.ts`, `sync/useProgressSync.ts`, `sync/useFriendsProgress.ts`, `App.tsx`, `components/BingoCelebration.tsx`, `components/BackupToast.tsx`, `games/useBingoCelebrations.ts`, `dex/FriendRow.tsx`, `dex/SelfRow.tsx`, `dex/FriendsList.tsx`, `dex/FriendDetail.tsx`, `dex/DexView.tsx`, `live/useOnlineStatus.ts`, `auth/useAuthIdentity.ts`, `db/supabase.ts`, `config.ts`, `routing/useHashRoute.ts`, `wakeLock.ts`, `core/test/purity.test.ts`, `test/sync/progressSync.test.ts`, `vitest.config.ts`.

### Secondary (MEDIUM confidence)
- CONTEXT.md D-01…D-21 + REQUIREMENTS.md PRES-01…07 — the locked decision set and requirement text.

### Tertiary (LOW confidence)
- None — all claims verified against installed code, the codebase, or the validated spike.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; the one dependency is installed and its API directly inspected.
- Architecture: HIGH — a line-for-line mirror of the shipped, tested Phase-19 engine + Phase-16 toast host; every fusion point already exists in code.
- Pitfalls: HIGH — Pitfalls 1 & 2 verified against the installed type surface; 3-6 verified against shipped code patterns.

**Research date:** 2026-07-24
**Valid until:** 2026-08-23 (stable — pinned to an installed version; the only churn risk is a `supabase-js` upgrade, which is not planned this phase)
