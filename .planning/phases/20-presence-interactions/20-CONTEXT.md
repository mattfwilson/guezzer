# Phase 20: Presence & Interactions - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the ~5-friend group **live, ephemeral awareness of each other**: who is currently in the app (online presence dots), a **coarse tab-level "what they're doing" status**, and **lightweight targeted/broadcast waves + emoji reactions** rendered as non-blocking toasts. All of it rides **one dedicated Supabase Realtime channel** (presence sync + broadcast) and is **never written to Postgres** — ephemeral by construction (PRES-01…07). The Friends screen inside GizzDex becomes presence-aware, fusing Phase-19's synced progress (PROG) with live presence (PRES) with **no new backend**.

Depends on Phase 18's identity (presence keyed by `user_id`, friend rows reuse the deterministic per-user color/avatar). Postgres-independent — it uses Realtime presence + broadcast only, so it needed nothing from Phase 19 beyond the Friends UI surface (which already reserved the presence slots). All Supabase access stays fenced in the app layer (`packages/app/src/sync/`); `packages/core` stays pure by construction.

**Hard scope line:** coarse **tab-level** status only — whether a tracked show is *active* is a boolean flag, but **never which song / setlist position**. Any shared mutable setlist state is the deferred **SOCL-V2-01** line and stays out.

**In scope:** PRES-01 (online presence dots via Realtime presence, ephemeral/dropped-on-disconnect), PRES-02 (send a wave → transient toast via Realtime broadcast), PRES-03 (presence + waves never persisted to Postgres), PRES-04 (coarse read-only tab-level activity), PRES-05 (targeted `to:userId` OR broadcast `to:null` waves), PRES-06 (fixed emoji reaction palette as reduced-motion-aware toasts reusing the Bingo celebration discipline), PRES-07 (presence-aware Friends rows fusing PROG + PRES).

**Explicitly NOT in this phase:**
- **Per-song / setlist-position presence** (e.g. "on song 7") → deferred **SOCL-V2-01**. Status is tab-level; the LiveGizz "At a show" upgrade is a boolean (an active tracked show exists), never per-song.
- **Any durable/persisted presence or wave history** — no missed-wave replay, no "recently seen" timestamps, no Postgres rows for presence/waves (PRES-03). Ephemeral only.
- **Invisible / ghost mode** — presence is always-on while signed in (deferred idea if ever wanted).
- **Global app-wide "N online" indicators** (tab badges / header counts) — presence UI stays on the Friends screen (+ app-wide wave toasts).
- **Haptics** on received waves — visual toasts only.
- **Surfacing online-only friends** who have no synced progress row — presence decorates existing PROG rows only.

</domain>

<decisions>
## Implementation Decisions

### Coarse activity vocabulary & "idle" (PRES-04)
- **D-01:** Broadcast the **real active tab** — the full 5-tab vocabulary `LiveGizz / GizzVerse / GizzMap / GizzDex / GizzGames` (NOT collapsed to the requirement's illustrative 4-value list, which predated GizzMap/GizzGames), plus `idle`. Most honest "what they're doing."
- **D-02:** `idle` is driven by **`document.visibilitychange` → `visibilityState === "hidden"`** (tab backgrounded / screen locked). Event-driven, zero timers — reuses the same visibility signal Wake Lock already listens to. Foreground = the current active tab. No no-interaction timeout.
- **D-03:** On the LiveGizz tab, status **upgrades to a distinct `At a show 🎸`** when a **tracked show session is active** (a `db.trackedShows` `status === "active"` row exists); otherwise plain `LiveGizz`. This is the single most exciting residency signal ("who's at the gig right now"). It is a **boolean flag only** (active vs not) — **never** per-song data, so it stays clear of the SOCL-V2-01 line. Reuses the same active-session liveQuery `useBingoCelebrations` already reads.
- Presence payload is therefore roughly `{ tab, atShow?: boolean }` (+ identity is the presence key). Settings/dev routes map to a sensible default (e.g. treat as their nearest tab or `idle`) — Claude's discretion.

### Wave & reaction send UX (PRES-02, PRES-05, PRES-06)
- **D-04:** **One unified reaction surface** (PRES-02 and PRES-06 collapse into a single "send a reaction" path). A single "React/Wave" entry opens the fixed emoji palette; the user **picks an emoji, then picks a target** (everyone = broadcast `to:null`, or one specific friend = targeted `to:userId`). One send code path, one broadcast event shape.
- **D-05:** The palette is led by the **wave 👋** as the first/default chip (honors PRES-02's "lightweight wave" as the primary gesture) within the same one-palette surface.
- **D-06:** The **fixed palette is exactly 4 chips: `👋` (wave) · `🔥` (fire) · `🦎` (lizard) · `🎯` (labeled "caught it!")**. `🎯` carries the short "caught it!" label; the others are emoji-only. Fixed set — no custom emoji, no picker.
- **D-07:** A wave can **also be sent from inside `FriendDetail`** (the full-screen "You vs {name}" head-to-head overlay), **pre-targeted at that friend** — natural when you're focused on one person. It shares the single send path with the list-level palette. Two entry points (list palette + FriendDetail), one send mechanism.
- **D-08:** **No send rate-limit** — trust the ~5-friend group; a spammer is a social problem, not a technical one. (The receive-side queue cap in D-10 already bounds on-screen flooding regardless.) An invisible mode / cooldown can be a deferred idea if it ever becomes real.

### Received wave/reaction toasts (PRES-02, PRES-05, PRES-06)
- **D-09:** A received toast shows **sender name + emoji, with a "to you" emphasis when the wave was targeted at the receiver** (e.g. `Matt 👋` for a broadcast vs `Matt waved at you 👋` / a subtle "to you" mark when targeted). Targeted feels personal (PRES-05); broadcast reads as group hype. Uses the deterministic identity color/initials glyph (shared `IdentityGlyph`). Sender identity is always shown.
- **D-10:** **Incoming bursts drain as a brief one-at-a-time queue** (small cap, ~3–5): each toast shows for a short duration and a backlog queues + drains fast, so a flurry (3 friends react to a big song, or one fast-tapper) reads as **distinct pops** (`Matt 🔥`, `Sam 🦎`) rather than clobbering. This is a deliberate departure from `BingoCelebration`'s single latest-wins toast — social waves are burstier and each ping should register. Over-cap overflow is dropped (consistent with ephemeral "right now" gestures).
- **D-11:** Toasts appear **app-wide (any tab)** — the toast host is mounted **once in `App.tsx`** (the `BingoCelebration` / `BackupToast` module-emitter + App-level host idiom), so a wave reaches you in Show Mode / GizzVerse / anywhere. `pointer-events-none`, at `config.ui.z.toast`, never intercepts a tap — the live logging loop stays sacred (the D-17 Bingo rule). Reduced-motion-aware per PRES-06 (reuse the `useReducedMotion()` gate the celebration layer already honors). All sender/emoji strings are escaped React text — never `dangerouslySetInnerHTML`.
- **D-12:** **No haptics** — visual toasts only. (iOS Safari lacks `navigator.vibrate` anyway, so the owner's iPhone would be visual-only regardless; keeps behavior consistent across the mixed iOS/Android group.)

### Presence ↔ Friends fusion & dot semantics (PRES-01, PRES-07)
- **D-13:** **Presence decorates existing synced-progress (PROG) rows ONLY.** An online friend with **no synced progress row is not shown** (they appear once they sync a row). List membership stays PROG-owned; presence is pure decoration dropped into the slots `FriendRow` already reserved (`data-slot="presence-online"` leading dot, `data-slot="presence-activity"` trailing label). No second list-membership source, no placeholder online-only rows.
- **D-14:** The online dot is **binary — present on the channel right now** (dropped on disconnect, exactly as Realtime presence behaves). **No "recently seen"** / last-seen timestamps (that would need persisted state and drift toward Postgres, against PRES-03).
- **D-15:** The pinned **"You" row shows its OWN live dot + current activity** — an honest self-anchor that also confirms your presence is broadcasting to friends.

### Offline / dead-signal venue behavior (the residency reality)
- **D-16:** When **YOU are offline**, **hide ALL online dots + activity labels** — we know nothing live about who's present, so never show a stale green dot that lies "online now." The Phase-19 dimmed **"offline · as of {time}"** cached PROG rows still render (name + stats). Honest "I can't see presence right now."
- **D-17:** When offline, the **"You" row reads `offline`** (own dot hidden / marked offline) — mirrors the friend-dot rule and is honest that you're not broadcasting. Reuses the existing **`useOnlineStatus`** signal (the same one the Phase-19 PROG sync + SyncDot already watch).

### Channel architecture & engine placement (PRES-01…03)
- **D-18:** Add **ONE new dedicated Realtime channel** (e.g. `gizz-room`, presence keyed by `userId`) carrying **both** presence-sync **and** wave/reaction broadcasts — **separate** from Phase-19's `progress-feed` `postgres_changes` channel. Matches the validated spike blueprint exactly; keeps ephemeral (this) cleanly separated from durable-progress (Phase 19). Do **not** merge presence onto the progress channel.
- **D-19:** A **new `usePresence()` engine hook** lives in the app-layer sync fence (`packages/app/src/sync/`, e.g. `presenceSync.ts` + `usePresence.ts` + a shared external store), **mounted ONCE in `App.tsx`** next to `useProgressSync()` / `useBingoCelebrations()`. Gated internally on **signed-in identity + online** (unconditional call in `App.tsx`, gate inside). It is the SOLE owner of the presence channel: `.track()` on subscribe, publishes online-ids + per-user activity + incoming-wave events to the shared store; read hooks (Friends rows, "You" row, toast host) stay **pure readers** (`useSyncExternalStore`). Mirrors the Phase-19 D-16 singleton pattern exactly. `packages/core` stays Supabase-free (the SETUP-04 purity guard test must keep passing).

### Privacy & ephemerality (PRES-03)
- **D-20:** Presence is **always-on while signed in** — no invisible/ghost toggle. Appropriate for a private, opt-in ~5-friend tool whose whole point is mutual awareness.
- **D-21:** **Missed waves are simply gone** — if a recipient is offline or the app is closed when a wave is sent, it is not received: **no queue, no missed-wave badge, no replay on reconnect, no history table.** Fully consistent with PRES-03 (never persisted). A wave is a "right now" gesture.

### Claude's Discretion
- Exact toast durations, queue cap value, and the drain cadence (D-10); exact palette chip styling / layout and the "React/Wave" entry-point affordance (a header control on the Friends screen + the FriendDetail button — D-04/D-07).
- The precise presence payload TypeScript shape (`{ tab, atShow? }`), the broadcast event shape (`{ from, to, emoji }`), config constant names/location (new `config.presence` / `config.copy.presence` block; keep the tone consistent with existing copy), the shared-store shape, channel name, and the `.track()` / subscribe / reconnect / sign-out teardown wiring mechanics (D-18/D-19).
- How Settings/dev routes and the transient `#/dev/orb-fit` harness map into the activity vocabulary (default to nearest tab or `idle`).
- Exact copy strings (`At a show 🎸`, `{name} waved at you 👋`, `{name} 👋`, `offline`, the online-dot color/size) and the visual treatment of the dot + activity label in the reserved `FriendRow` slots.
- Reduced-motion treatment of the wave toast (opacity-only vs a gentle float), consistent with the celebration layer's reduced path.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — **PRES-01…07** (this phase's exact requirement text: single channel keyed by user id, ephemeral/never-Postgres, tab-level coarse status "never per-song," targeted `to:userId` vs broadcast `to:null`, fixed emoji palette reusing the Bingo celebration discipline, presence-aware Friends rows).
- `.planning/ROADMAP.md` §"Phase 20: Presence & Interactions" — goal + the 5 success criteria this phase is verified against; the **hard scope line** (coarse tab-level only; shared mutable setlist = deferred SOCL-V2-01); the "Postgres-independent, Realtime presence + broadcast only" framing.

### Sync/presence blueprint (validated across two remote devices — spike 004)
- `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` §"Presence + waves" — **the load-bearing reference**: the exact client pattern `supabase.channel("gizz-room", { config: { presence: { key: userId } } })`, `.on("presence", { event:"sync" }, …)` → `Object.keys(ch.presenceState())`, `.on("broadcast", { event:"wave" }, …)`, `.subscribe(async s => { if (s==="SUBSCRIBED") await ch.track({...}) })`, and `ch.send({ type:"broadcast", event:"wave", payload:{ from, to } })` (`to:null` = everyone). Also §"What to Avoid" (don't persist waves/presence; don't import the client from core).
- `.claude/skills/spike-findings-guezzer/SKILL.md` — spike 004 (presence-and-ping) VALIDATED; the milestone requirements the real build must honor.

### App reuse targets — the mounted-once engine + toast + Friends surfaces
- `packages/app/src/App.tsx` — where `useProgressSync()` and `useBingoCelebrations()` are mounted ONCE at the shell; the new `usePresence()` engine and the wave-toast host mount here alongside them (D-11/D-19). Shows the `pointer-events-none`, app-wide, survives-unmount toast host idiom.
- `packages/app/src/sync/progressSync.ts` + `packages/app/src/sync/useProgressSync.ts` — the **exact pattern to mirror** (D-19): stateless Supabase primitives + a module-level shared external store (`subscribeSyncState`/`getSyncState`/`setSyncState`) written by a single shell-mounted engine and read by pure `useSyncExternalStore` hooks; channel subscribe/`removeChannel` teardown; online/identity gating; reconnect handling.
- `packages/app/src/sync/useFriendsProgress.ts` + `packages/app/src/sync/friendCache.ts` — the pure-reader hook + the offline last-known cache the presence dots must coexist with (D-16 hides dots but keeps these dimmed rows).
- `packages/app/src/components/BingoCelebration.tsx` + `packages/app/src/games/useBingoCelebrations.ts` — the **PRES-06 discipline to reuse**: module-emitter (`showBingoCelebration` / `subscribeBingoCelebration`) + App-level host, `useReducedMotion()` gating, `config.ui.z.toast`, `role="status"`, escaped text, `useBottomOverlayHeightRegistration`. Note the wave host **departs** from its single latest-wins toast in favor of the D-10 brief queue.
- `packages/app/src/dex/FriendRow.tsx` — **already reserved** the presence slots: leading `data-slot="presence-online"` (the online dot) and trailing `data-slot="presence-activity"` (the coarse activity label). Presence fills these in without a rebuild (D-13). Also the shared `IdentityGlyph` (deterministic color/initials) reused by the wave toast (D-09).
- `packages/app/src/dex/FriendsList.tsx` + `packages/app/src/dex/SelfRow.tsx` (pinned "You") + `packages/app/src/dex/FriendDetail.tsx` — the presence-aware list (D-13/D-15), the self dot/status (D-15/D-17), and the FriendDetail wave button (D-07).
- `packages/app/src/dex/DexView.tsx` — hosts the `Albums | Shows | Friends` toggle; the Friends screen is view-state within `#/dex` (never a new hash route).
- `packages/app/src/live/useOnlineStatus.ts` — the reactive `navigator.onLine` signal reused for the offline dot-hide + "You = offline" rules (D-16/D-17) and the engine's online gate.
- `packages/app/src/auth/useAuthIdentity.ts` — the current `user_id` / `display_name` that keys presence `.track()` and stamps outgoing waves (`from`); the signed-in gate for the engine (D-19/D-20).
- `packages/app/src/db/supabase.ts` — the single app-layer Supabase client singleton (Phase 17); the new presence channel is opened from here.
- `packages/app/src/config.ts` — the single config file; the new `config.presence` + `config.copy.presence` constants + the existing `config.ui.z` z-index scale live here.

### Activity-source reuse (the LiveGizz "At a show" flag)
- `packages/app/src/db/db.ts` (`db.trackedShows`) + `packages/app/src/games/useBingoCelebrations.ts` — the active-session liveQuery (`trackedShows.where("status").equals("active").first()`) that drives the `At a show 🎸` boolean (D-03) — a flag only, never the setlist.
- `packages/app/src/routing/useHashRoute.ts` — the `Route` union (`show/explore/map/dex/games/settings`) → tab-name mapping for the activity vocabulary (D-01).

### Backend foundation (already provisioned — nothing to build this phase)
- `.planning/phases/17-backend-foundation-secrets/17-CONTEXT.md` — Realtime is enabled; presence + broadcast need **no migration** (they are Postgres-independent). Confirms secrets discipline (anon key public, service_role env-only).
- `.planning/phases/18-accounts-offline-safe-identity/18-CONTEXT.md` — the identity substrate presence keys off (deterministic per-user color, offline-safe boot, current-identity scoping).
- `.planning/phases/19-shared-dex-progress/19-CONTEXT.md` — the Friends surface this phase makes presence-aware; D-16 (app-wide-while-signed-in engine), D-18 (offline cached rows), and the reserved presence slots were all built anticipating this phase (see its `<deferred>` "Built for Phase 20 fusion").

### Project constraints
- `CLAUDE.md` — strict core purity (`packages/core` = zero DOM/browser/network/Supabase deps); all Supabase imports fenced into `packages/app/src/sync/`; single-config-file convention; PWA installable on mixed iOS/Android.
- `.planning/PROJECT.md` — v2.0 milestone framing (Presence & interactions = the third target feature); Supabase is THE multi-user foundation; offline-first must not regress; "Explicitly NOT full real-time live setlist co-tracking (SOCL-V2-01 stays deferred)."

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`FriendRow` reserved slots** — Phase 19 deliberately shipped empty leading (`presence-online`) + trailing (`presence-activity`) slots in the friend row specifically so Phase 20 presence drops in without a rebuild (D-13). The single hardest fusion constraint (PRES-07) is already scaffolded.
- **`progressSync.ts` shared-store + singleton-engine pattern** — the exact architecture the presence engine mirrors (D-19): stateless Supabase primitives + module-level external store + one shell-mounted engine + pure reader hooks. Copy the shape, swap `postgres_changes` for presence/broadcast.
- **`BingoCelebration` / `BackupToast` module-emitter host** — the mandated PRES-06 toast discipline (App-level host, reduced-motion gate, z-index, non-blocking, escaped text). The wave toast is a sibling host; its only departure is the D-10 brief queue vs latest-wins.
- **`useBingoCelebrations` active-session liveQuery** — the `trackedShows` active-row read reused verbatim to drive the `At a show 🎸` flag (D-03) — flag only, never per-song.
- **`useOnlineStatus`** — reused for the offline dot-hide + self-offline rules (D-16/D-17) and the engine's online gate.
- **`useAuthIdentity` + `IdentityGlyph` + deterministic identity color** — key presence, stamp waves, and render the sender glyph in toasts consistently across devices.

### Established Patterns
- **Mounted-once engine + shared external store + pure readers** (Phase-19 D-16). The presence engine is a SINGLETON: one channel, one `.track()`, gated internally; every consumer is a `useSyncExternalStore` reader. No component opens a second channel.
- **App-level module-emitter toast host** (BackupToast → BingoCelebration lineage). Survives tab/route unmount, fires over any tab, `pointer-events-none`, never blocks the live loop.
- **App-layer Supabase fence** — every `@supabase/*` import stays in `packages/app` (SETUP-04 purity guard test). The new presence module obeys this by construction; a core-purity regression fails the existing Vitest boundary test.
- **View-state, not routes** — the Friends surface + FriendDetail are view-state within `#/dex` (no react-router, no new hash route). Presence changes nothing here.
- **Untrusted external data** — sender display names + any friend-supplied strings are escaped React text, clamped; identity by `userId`. Presence/broadcast payloads are untrusted at the read boundary (validate shape, ignore malformed events, never crash the toast host).

### Integration Points
- **Presence engine (new):** `usePresence()` mounted once in `App.tsx` → opens the `gizz-room` channel, `.track({ tab, atShow })` on subscribe + on activity change (route change / visibilitychange / active-show change), subscribes to `presence:sync` (→ online-ids + activity map) and `broadcast:wave` (→ incoming-wave events), publishes to a new shared presence store. Gated on identity + online; tears the channel down on sign-out / offline.
- **Activity source:** `useHashRoute()` (current tab) + `visibilityState` (idle) + `trackedShows` active-row (At a show) → the tracked presence payload (D-01/02/03).
- **Friends screen consumers:** `FriendRow` fills its reserved dot + activity slots from the presence store (D-13); `SelfRow` shows the "You" live dot/status, flipping to `offline` when `useOnlineStatus` is false (D-15/D-16/D-17); `FriendDetail` gains a pre-targeted wave button (D-07).
- **Wave toast host (new):** a module-emitter host mounted once in `App.tsx`, subscribing to the presence store's incoming-wave events, rendering the D-10 brief-queue toasts app-wide (D-11), reduced-motion-aware, non-blocking.
- **Send path:** list-level palette (pick emoji → pick target) and the FriendDetail button both call one `sendWave(emoji, to)` primitive → `channel.send({ type:"broadcast", event:"wave", payload:{ from, to, emoji } })` (D-04/D-07/D-08).

</code_context>

<specifics>
## Specific Ideas

- **The residency payoff is `At a show 🎸`.** Across consecutive nights, "who's at the gig right now" is the single most exciting presence signal — a boolean flag from the active tracked-show row, deliberately kept flag-only so it never crosses into the deferred per-song SOCL-V2-01 line.
- **Ephemeral by construction, top to bottom.** Presence drops on disconnect; waves are "right now" and gone if missed; nothing touches Postgres (PRES-03). This is why the whole feature needed no migration and is Postgres-independent.
- **Honest offline over pretty offline.** At a dead-signal venue, hide dots rather than freeze a lying green one; the "You" row admits `offline`. The cached PROG stats still show (Phase-19 dimmed rows) so the screen is never blank — but presence never lies.
- **Reuse, don't reinvent** — like Phase 19. The engine mirrors `progressSync`, the toast mirrors `BingoCelebration`, the row slots already exist, the identity glyph/color already exist, the active-show read already exists. The net-new surface is: one channel, one presence payload, one wave broadcast shape, one palette, and the dot/activity rendering in reserved slots.
- **Waves are a burst medium.** Unlike the single Bingo toast, incoming waves drain a brief queue so a group reacting to a big song reads as distinct pops — the one intentional departure from the celebration-layer default.

</specifics>

<deferred>
## Deferred Ideas

- **Per-song / setlist-position presence** ("on song 7", live shared setlist state) → **SOCL-V2-01** (explicitly deferred; the hard scope line). The `At a show` flag is the closest we go — a boolean, never per-song.
- **Missed-wave nudge / recent-waves peek / wave history** → out of scope (would need persistence, against PRES-03). Waves are gone if missed (D-21).
- **"Recently seen" / last-active timestamps** → deferred (needs persisted state, drifts toward Postgres; against the ephemeral rule). Dot is binary present-now only (D-14).
- **Invisible / ghost mode (opt-out of broadcasting presence)** → deferred; presence is always-on while signed in for this opt-in ~5-friend tool (D-20).
- **Send rate-limit / per-target cooldown** → not built; trust the group (D-08). The receive queue cap already bounds on-screen flooding. Revisit only if spam becomes real.
- **Global app-wide online indicator** (tab badge / header "N online") → not built; presence UI stays on the Friends screen (+ app-wide wave toasts). Claude may add a subtle one only if it doesn't add noise.
- **Haptics on received waves** → not built (visual only; iOS Safari lacks `navigator.vibrate` anyway) (D-12).
- **Surfacing online-only friends** (present but no synced progress row) → not shown; presence decorates existing PROG rows only (D-13).

### Reviewed Todos (not folded)
None reviewed this session — no `todo.match-phase` matches surfaced for the presence/interactions domain (the 15 pending v2 UI/feature todos noted in Phase 19 remain untouched and none touch presence/waves).

</deferred>

---

*Phase: 20-presence-interactions*
*Context gathered: 2026-07-24*
