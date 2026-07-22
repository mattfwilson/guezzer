# Phase 18: Accounts & Offline-Safe Identity - Research

**Researched:** 2026-07-22
**Domain:** Offline-first client auth (Supabase GoTrue), Dexie per-user namespacing, identity chrome, PWA rebrand
**Confidence:** HIGH (auth flow blueprint-validated; namespacing mechanics MEDIUM — a genuine schema-design decision surfaced below)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Sign-in = **name-picker + password**. The ~5 friends' display names render as large tap targets; tapping one pre-fills that account's login handle, friend types only their password. One-thumb / dark / drunk-thumb optimized. Password typed once per device (session persists).
- **D-02:** Auth is a **full gate**. No stored session → login screen, app blocked behind it. No anonymous/v1 fallback path going forward. Offline boot works once signed in once on this device (D-06).
- **D-03:** First-ever launch on a device with **no signal** (never signed in here) → **calm "connect once" screen** (friendly note, not a crash or spinner).
- **D-04:** Name-picker needs a client-side roster (`display_name → login handle`) baked into the deployed bundle. To keep **no real PII in a scrapeable bundle**, seed accounts with **synthetic login-handle emails** (e.g. `ezra@gizz.local`) used only as sign-in handles. **This adjusts Phase 17's seed convention** — seed against slug-derived synthetic handles from env, not real personal emails.
- **D-05:** Boot restores the session **synchronously** via `supabase.auth.getSession()` from localStorage — **startup NEVER gated on a live network auth check**. `onAuthStateChange` reconciles login/logout/refresh when connectivity returns. (Blueprint-locked; must not regress v1 offline boot.)
- **D-06 (THE CRUX):** **The auth gate keys on presence of a stored session identity, NOT on token validity.** An **expired-but-present** session still opens the full offline dex as that identity (reading local Dexie needs no token; there are no Supabase calls until Phase 19). Token refreshes quietly when signal returns. Prevents the lockout failure mode: a friend whose token expired overnight is **never locked out of their own offline dex** at a dead-signal venue. No grace-window timer — presence of identity is the whole rule.
- **D-07:** The "reconnecting…" affordance (AUTH-08) **extends the existing live-sync status idiom** (`SyncDot.tsx` + `useOnlineStatus.ts`), not a second connection indicator. A stale token surfaces as the same calm chrome-dot language, never a jarring "you're logged out."
- **D-08:** On the **first** sign-in on a device, the pre-existing single-user v1 dex is **claimed by (namespaced to) the first signer**, one time. Preserves the owner's real v1 catch history as their identity's dex.
- **D-09:** **Borrowed-phone:** after sign-out → another friend signs in, the new friend sees **only their own dex** (empty until Phase 19 syncs it down). Prior user's data stays on-device but namespaced, **never shown** to the new user.
- **D-10:** **Sign-out clears to login screen instantly** with the view torn down — no flash of the previous person's dex.
- **D-11:** Mechanism is planner's call, but behavior implies **one Dexie DB with per-user namespacing** (additive `version(7).stores(...)`), queries scoped to current user id, retaining multiple users' rows on-device while showing only the current identity's. The one-time claim stamps existing untagged rows with the first user id exactly once.
- **D-12:** Each identity renders as a **colored circle + display-name initial(s)**, dark-on-light text like existing rarity/tuning orbs (`ORB_TEXT_COLOR` `#0C0C10`). Legible as chrome glyph and (later) presence dot in the dark.
- **D-13:** Color is **deterministic from the Supabase user id** via the hash→palette-index idiom (mirror `MapView.memberColor`'s `hash = hash*31 + charCodeAt | 0`), into a **fresh, dedicated auth palette in config** — decoupled from GizzMap `MEMBER_COLORS`. Guarantees a friend looks the same on every device.
- **D-14:** A small **avatar (color + initials) in the header**; tapping it opens a **sheet** showing full display_name + sign-out control. The seeded `display_name` (from `user_metadata`) is the label.
- **D-15:** **Full "Gizz With Friends" rebrand**, incl. share card. Surfaces: `index.html` `<title>`, PWA manifest `name`/`description` in `vite.config.ts`, `config.copy` install/CTA strings, share-card gold wordmark (`share.wordmarkGold` text). Header wordmark already done (commit `30f86cc`). Size the share-card wordmark to fit "Gizz With Friends". **Display/chrome only** — routes, file paths, persisted Dexie/storage keys (incl. `DB_NAME = "guezzer"`) unchanged.
- **D-16:** PWA manifest **`short_name` = "Gizz With Friends"** (owner's choice; may truncate under the home-screen icon — acceptable).
- **D-17:** After sign-in, land on the **app's current default view** (default hash route). Auth gates entry only.
- **D-18:** Wrong password → **calm inline error** + a small "Forgot? Ask [owner] to reset it" line. No self-service reset, no silent dead end.

### Claude's Discretion

- Exact Dexie `version(7)` schema shape, index choices, and one-time claim migration mechanics (D-11).
- Exact sign-in screen layout/styling and identity sheet visual treatment (D-01, D-14).
- The fresh auth palette's hues and the shared hash helper's location (D-13) — must be config-level, deterministic from user id, legible in the dark.
- Exact copy strings for "connect once", "reconnecting…", and password-error / ask-owner note (D-03, D-07, D-18).
- Whether the identity avatar/color helper lives in `packages/app` config or a pure `packages/core` helper — **must not import Supabase into core**.

### Deferred Ideas (OUT OF SCOPE)

- Progress upsert/sync, `deriveSharedProgress`, friends screen, live `postgres_changes`, head-to-head compare → **Phase 19** (PROG-01…08). The identity color primitive (D-13) is built here for reuse.
- Presence dots, waves, reactions, coarse activity status → **Phase 20** (PRES-01…07).
- Self-service password reset / sign-up / magic-link → permanently out of scope. Recovery is owner-re-mint (D-18).
- GizzMap ↔ account convergence → deferred backlog.
- **Phase 18 writes NOTHING to Supabase beyond the auth sign-in call itself.** The only network dependency is authentication, deliberately kept off the boot path.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Pre-made email/password sign-in, reach app as distinct identity, no self-service reg | `supabase.auth.signInWithPassword` (Standard Stack); name-picker roster (D-04) baked in bundle; Pattern 1 |
| AUTH-02 | Offline boot from restored session; **never** gate startup on network auth check | Pattern 2 (auth gate keys on app-owned identity record); **Pitfall 1** (getSession-returns-null-offline); device-UAT is the real proof |
| AUTH-03 | See who you're logged in as (`display_name`) in chrome | `session.user.user_metadata.display_name`; header avatar + sheet (D-14) |
| AUTH-04 | Sign out; device hand-off | `supabase.auth.signOut()` + instant view teardown (D-10); Pattern 4 |
| AUTH-05 | First-login Dexie namespacing to user id, **exactly once** | Pattern 3 (app-side, meta-gated claim); **Pitfall 2** (stamp cannot run in Dexie upgrade hook); additive `version(7)` |
| AUTH-06 | "Gizz With Friends" rebrand — wordmark, title, manifest copy; chrome-only | Rebrand surface table (Architecture §Rebrand); D-15/D-16; SW-update-prompt caveat (Pitfall 5) |
| AUTH-07 | Deterministic auto color/avatar from user id | Pattern 5 (pure `identityColor(userId, palette)` helper); D-12/D-13; mirror `memberColor` |
| AUTH-08 | Stale token reconnects gracefully; calm "reconnecting…" not "logged out" | Pattern 6 (extend `SyncDot`/`useOnlineStatus`); **Pitfall 3** (TOKEN_REFRESHED / refresh-needs-network) |
</phase_requirements>

## Summary

Phase 18 is the identity seam that gates the rest of the milestone. The Supabase auth mechanics themselves are **blueprint-validated across two remote devices** (spike 002) and the app already has the single `supabase` client singleton (Phase 17) ready as its first consumer — so `signInWithPassword` / `getSession` / `onAuthStateChange` / `signOut` are low-risk, HIGH-confidence primitives. The real engineering content of this phase is **not** the auth calls; it is three seams around them: (1) interposing a gate into a currently-synchronous, zero-await boot tree without regressing offline first-paint, (2) namespacing six untagged Dexie tables to a user id additively and stamping legacy rows exactly once, and (3) driving a calm reconnect affordance off the existing status-dot idiom instead of the library's session events firing a jarring logout.

The single highest-value finding is a **verified real-world gotcha** directly on the crux (D-06): there is a known, still-open class of bug where `supabase.auth.getSession()` returns **null** when an app boots offline, because the auto-refresh path races/clears the stored session `[VERIFIED: github.com/orgs/supabase/discussions/36906]`. It is documented for React Native/AsyncStorage; on web + synchronous `localStorage` it is far less likely, but it means **D-06's "gate on presence of stored identity, not token validity" should be implemented against an app-owned identity record (Dexie `meta` / a dedicated localStorage key written at first sign-in), NOT solely against whatever `getSession()` returns at boot.** That belt-and-suspenders design makes the lockout failure mode architecturally impossible regardless of supabase-js's offline behavior, and it is the safest reading of the locked decision.

**Primary recommendation:** Write the signed-in identity (`user_id` + `display_name`) into an app-owned persistent record at first sign-in. Gate boot **synchronously** on the presence of that record. Run `getSession()`/`onAuthStateChange` in the background purely to reconcile connectivity and enable future (Phase 19) network writes — never on the boot-blocking path. Namespace Dexie via an additive `version(7)` that adds a `userId` index, with the legacy-row claim done app-side at first login (meta-gated, exactly once), and scope every dex read + the export/import snapshot to the current user id. Verify the whole thing on-device offline (airplane mode + expired token → dex still opens) before Phases 19–20.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Password sign-in (AUTH-01) | API/Backend (Supabase GoTrue) | App layer (thin client call) | Auth is Supabase's job; app only calls `signInWithPassword` and stores the returned session |
| Session persistence + refresh (AUTH-02/08) | Browser (localStorage) + supabase-js | App layer (reconcile UX) | supabase-js owns token storage/refresh; the app owns the *UX* of the offline→online transition |
| Offline-boot identity gate (AUTH-02/06) | App layer (React boot tree) | Browser (localStorage/Dexie meta) | The gate is an app-owned decision on a persisted identity record — deliberately decoupled from the network |
| Per-user data namespacing (AUTH-05) | App layer (Dexie schema + query scoping) | — | Local-only; Dexie is the sole source of truth; core stays pure |
| Deterministic identity color (AUTH-07) | **Core (pure helper)** | App config (palette) | Pure string-hash → index; belongs in `packages/core` so Phase 19/20 reuse it, node-unit-testable, no Supabase import |
| Identity chrome (avatar/sheet) (AUTH-03/04) | App layer (React/DOM) | — | Pure presentation over `session.user` |
| Rebrand (AUTH-06) | App layer (static config/manifest/HTML) | CDN/SW (precache + update prompt) | Chrome strings only; SW `registerType:'prompt'` means users refresh to see it |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.110.8 | Auth client (`auth.signInWithPassword` / `getSession` / `onAuthStateChange` / `signOut`) | **Already installed** (Phase 17); the single `supabase` singleton in `packages/app/src/db/supabase.ts` is this phase's first consumer `[VERIFIED: packages/app/package.json + repo]` |
| `dexie` | 4.4.4 | Additive `version(7)` namespacing + `useLiveQuery` scoping | Already the app's persistence layer; strictly-additive discipline established across 6 versions `[VERIFIED: packages/app/src/db/db.ts]` |
| `dexie-react-hooks` | 4.4.0 | `useLiveQuery` reactive reads (must now filter by user id) | Already in use in `useDexStats.ts` |
| React | 19.2.7 | The gate component + identity chrome | Existing framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fake-indexeddb` | 6.2.5 | Dexie migration/claim unit tests under jsdom | Already the test idiom (`test/setup.ts` imports `fake-indexeddb/auto`); mirror `migrationV5.test.ts` for the `version(7)` + claim tests |
| Tailwind CSS | 4.3.2 | Sign-in screen / identity sheet styling | Existing utility-class styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Gate on app-owned identity record | Gate directly on `getSession()` result | Simpler, but exposed to the offline-null bug (Pitfall 1) — rejected for the crux |
| `userId` field + query scoping (single tables) | Compound-key **new** tables `[userId+show_id]` | New tables give true PK isolation but a large refactor (export/import + 14 consumers). Field+scoping is lighter; see Pitfall 4 for the PK-collision caveat |
| Pure-core color helper | App-config helper (like current `memberColor`) | Both valid (D-13 discretion). Core recommended for node-testability + Phase 19/20 reuse |

**Installation:** None. This phase adds **no new npm packages** — it consumes existing, already-verified dependencies. (`@supabase/supabase-js@2.110.8` and `dexie@4.4.4` were installed in Phase 17 / earlier phases.)

## Package Legitimacy Audit

**No external packages are installed in this phase.** All dependencies (`@supabase/supabase-js@2.110.8`, `dexie@4.4.4`, `dexie-react-hooks@4.4.0`, `fake-indexeddb@6.2.5`) are pre-existing committed dependencies verified in `packages/app/package.json` and the lockfile. No slopcheck / registry-verification gate is required for Phase 18.

*(If the planner elects to add a package — e.g. a QR/credential-handoff helper — it MUST run the Package Legitimacy Gate first. Nothing in the locked decisions calls for one.)*

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
   Cold boot (main.tsx)  │  App-owned identity record (Dexie meta /     │
        │                │  localStorage key), written at first sign-in │
        ▼                └─────────────────────────────────────────────┘
  ┌─────────────┐   present?    ┌──────────────────────────────────────┐
  │  AuthGate   │──── NO ──────▶│ have network? ── NO ─▶ "connect once" │ (D-03)
  │ (synchronous│               │                └ YES ─▶ name-picker + │
  │  read of    │               │                         password (D-01)│
  │  identity   │               └──────────────────────────────────────┘
  │  record)    │                         │ signInWithPassword() ok
  │             │◀──── write identity record + run one-time Dexie claim ┘ (D-08, AUTH-05)
  └─────────────┘
        │ YES (identity present — token validity IRRELEVANT, D-06)
        ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  <App/> (existing synchronous route tree, unchanged)              │
  │  ┌────────────┐   reads scoped to currentUserId                   │
  │  │ useDexStats│──▶ db.*.where('userId').equals(currentUserId)     │ (D-11)
  │  └────────────┘                                                    │
  │  Header avatar (color+initials, D-12/13/14) ── tap ─▶ sign-out    │
  └──────────────────────────────────────────────────────────────────┘
        │ background, NON-blocking
        ▼
  getSession() + onAuthStateChange  ── TOKEN_REFRESHED / SIGNED_OUT ──▶ SyncDot
        │ (network only; failures degrade to "reconnecting…", D-07/AUTH-08) drives
        └──────── enables Phase 19 network writes; NEVER blocks boot ───────────▶
```

### Recommended Project Structure
```
packages/app/src/
├── auth/                      # NEW — the whole identity seam
│   ├── AuthGate.tsx           # interposes between main.tsx and <App/>; synchronous identity read
│   ├── SignInScreen.tsx       # name-picker + password (D-01), "connect once" branch (D-03), inline error (D-18)
│   ├── useAuthIdentity.ts     # reads app-owned identity record; exposes {userId, displayName} | null
│   ├── roster.ts              # baked display_name → synthetic handle map (D-04) — NO real PII
│   ├── claimDex.ts            # one-time, meta-gated legacy-row stamping (D-08/AUTH-05)
│   └── IdentityAvatar.tsx     # color+initials glyph (D-12); + identity sheet (D-14)
├── db/db.ts                   # + version(7) additive namespacing; + currentUserId-scoped read helpers
├── live/SyncDot.tsx           # EXTEND for "reconnecting…" (D-07) — do not fork
packages/core/src/
└── identity/color.ts          # NEW pure identityColor(userId, palette[]) helper (D-13) — no Supabase/DOM
```

### Pattern 1: Sign-in via the existing client singleton
**What:** Call `signInWithPassword` on the one app-layer client; store nothing custom — supabase-js persists the session to localStorage by default (`persistSession: true`).
**When to use:** The name-picker's password submit (D-01).
```typescript
// Source: .claude/skills/spike-findings-guezzer/references/multi-user-supabase.md (VALIDATED)
import { supabase } from "../db/supabase.ts";
const { data, error } = await supabase.auth.signInWithPassword({ email: handle, password });
// error?.message on a wrong password → calm inline error (D-18). Supabase returns a GENERIC
// "Invalid login credentials" — do NOT surface whether the handle exists (avoids user enumeration).
```

### Pattern 2: The offline-safe boot gate — gate on an app-owned identity record (the crux)
**What:** At first successful sign-in, persist `{ userId, displayName }` into an app-owned store (Dexie `meta` row and/or a dedicated localStorage key). Gate boot **synchronously** on the presence of that record — never on `getSession()` returning a valid session, and never on a network call.
**When to use:** The single interposition into the boot tree (D-05/D-06). This is the highest-risk item.
```typescript
// D-06: presence of identity is the WHOLE rule. Token validity is irrelevant to opening the dex.
const identity = readAppOwnedIdentity();        // sync: localStorage.getItem / a cached Dexie meta read
if (!identity) return <SignInScreen online={useOnlineStatus()} />;  // D-03 branches on online
return <App currentUserId={identity.userId} />; // full offline dex opens; zero await

// Background, AFTER first paint — reconcile, never block:
useEffect(() => {
  supabase.auth.getSession();                    // may refresh if online; ignored for gating
  const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
    if (evt === "SIGNED_OUT") clearIdentityAndTearDown();   // only an EXPLICIT sign-out clears (D-10)
    // TOKEN_REFRESHED / SIGNED_IN → update the app-owned record's token freshness, keep identity
  });
  return () => sub.subscription.unsubscribe();
}, []);
```
> Note the current boot tree (`main.tsx` → `<App/>`) is **fully synchronous with zero await** (`App.tsx`: `useHashRoute`, `requestPersistenceOnce()` the only side effect). The gate MUST preserve zero-await first paint for a restored identity (D-05). A synchronous `localStorage.getItem` read is compatible; an `await getSession()` before first paint is NOT — it would reintroduce the exact network-on-boot dependency this phase exists to kill.

### Pattern 3: One-time Dexie claim (app-side, meta-gated)
**What:** On first sign-in, stamp every pre-existing untagged row with the first signer's `userId`, exactly once, gated by a `meta` flag. This runs in **app code at login**, NOT in the Dexie `upgrade()` hook.
**When to use:** AUTH-05 / D-08.
```typescript
// The userId is UNKNOWN when the DB opens (before login), so the claim CANNOT live in
// version(7).upgrade(). It must be an app-side, idempotent, meta-gated operation:
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

### Pattern 4: Sign-out with instant teardown
```typescript
// D-10: clear to login instantly, view torn down — no flash of the previous dex to the next user.
await supabase.auth.signOut();      // clears supabase session
clearAppOwnedIdentity();            // clears the app-owned identity record → gate falls through to SignInScreen
// Because the gate reads the identity record, clearing it synchronously re-renders to SignInScreen.
// Do NOT clear the "dexClaimedBy" meta or wipe rows — prior user's rows stay namespaced (D-09).
```

### Pattern 5: Deterministic identity color (pure core helper)
**What:** Mirror `MapView.memberColor`'s hash but as a **pure** helper in `packages/core`, palette injected from app config.
```typescript
// packages/core/src/identity/color.ts — no DOM, no Supabase, node-testable, reused by Phase 19/20.
// Source idiom: packages/app/src/map/MapView.tsx:53-58 (memberColor)
export function identityColorIndex(userId: string, paletteLength: number): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return Math.abs(hash) % paletteLength;
}
// App: const color = config.auth.IDENTITY_COLORS[identityColorIndex(userId, config.auth.IDENTITY_COLORS.length)];
```
> The new `config.auth.IDENTITY_COLORS` palette sits **beside** `config.map.MEMBER_COLORS` (`config.ts:722`), decoupled (D-13). Initials glyph reuses the dark-on-light pairing `ORB_TEXT_COLOR`/`RARITY_ORB_TEXT_COLOR` = `#0C0C10` (`show/tuningColor.ts:25`, `dex/rarityStyle.ts:48`).

### Pattern 6: "Reconnecting…" by extending SyncDot (not forking it)
**What:** AUTH-08's calm affordance is a new *state* of the existing `SyncDot` vocabulary, driven by `useOnlineStatus()` + supabase auth-event freshness — never a new component, never a "you're logged out" message.
```typescript
// SyncDot already models online(green) / offline(hollow) / schemaDrift(amber). Add a "reconnecting"
// read that reuses the same glyph language (D-07). A stale token that hasn't refreshed yet while
// offline is NOT an error — it's the offline ring; when online returns and TOKEN_REFRESHED fires,
// it flips to green. No logout copy anywhere.
```

### Anti-Patterns to Avoid
- **`await supabase.auth.getSession()` before first paint** — reintroduces a network-shaped boot dependency; violates D-05.
- **Gating on token validity / `getUser()` at boot** — `getUser()` makes a network call; would lock out an offline friend with an expired token (the exact failure D-06 prevents).
- **Stamping legacy rows inside `version(7).upgrade()`** — the user id is unknown at DB-open; impossible there (Pitfall 2).
- **A second connection indicator** — violates D-07; reuse `SyncDot`.
- **Changing `DB_NAME`, localStorage keys, routes, or file paths during the rebrand** — chrome-only (D-15).
- **Reusing `config.map.MEMBER_COLORS` for identities** — D-13 mandates a fresh, decoupled palette.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password verification / hashing | Any custom credential check | `supabase.auth.signInWithPassword` | GoTrue bcrypts server-side; never handle raw password material yourself |
| Session persistence + token refresh | localStorage token juggling / manual JWT refresh | supabase-js defaults (`persistSession`, `autoRefreshToken` = true in browser) | The library already stores + schedules refresh; re-implementing invites the exact offline bugs |
| Reactive per-user reads | Manual state mirrors of tables | `useLiveQuery(() => db.x.where('userId').equals(uid).toArray())` | Existing idiom (`useDexStats.ts`); recompute-on-write is free |
| Dexie migration | Rewriting a `version()` block or new DB | Additive `version(7).stores({...})` + app-side claim | 6-version additive precedent; a PK/DB-name change breaks upgrade + violates D-15 |
| Identity color | A stored/uploaded avatar | Pure `identityColor(userId)` hash → palette | D-13; zero storage, stable across devices, offline-safe |

**Key insight:** Almost everything auth-shaped in this phase is already solved by supabase-js or the existing Dexie/config idioms. The only genuinely new code is the *gate placement*, the *claim*, and the *chrome* — keep the surface area tiny.

## Runtime State Inventory

> This phase both renames chrome (AUTH-06) and migrates local data (AUTH-05), so runtime state matters.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | (1) The existing Dexie `"guezzer"` DB holds the owner's **real v1 catch history** in untagged rows (`attendedShows`, `trackedShows`, `trackedEntries`, `archiveShows`, `bingoCards`). (2) supabase-js writes its session to localStorage key `sb-<project-ref>-auth-token` at sign-in. | (1) **Claim, do not wipe** — stamp with first signer's userId exactly once (Pattern 3). (2) No action — library-owned; the app-owned identity record is separate and additive. |
| **Live service config** | Supabase `auth.users.user_metadata.display_name` was set at **Phase 17 seed time**. The name-picker roster (D-04) maps display_name → **synthetic handle**. If Phase 17 seeded **real personal emails** as handles, D-04 requires **re-seeding** with synthetic `@…` handles so the public bundle carries no real PII. | **Verify what Phase 17 actually seeded** (the reference `seed-users.mjs` already uses synthetic `@fov.gizz` handles — good sign). If real emails were used, the seed roster + env handle vars must change and accounts re-minted before the roster ships. See Open Question 2. |
| **OS-registered state** | None — PWA; no Task Scheduler / launchd / systemd / pm2 registrations touch identity. | None (verified — no OS-level identity registration exists). |
| **Secrets/env vars** | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (present, public-by-design). Per-account passwords + `SUPABASE_SERVICE_ROLE_KEY` are env-only (Phase 17). The **baked roster** (display_name→handle) ships in the bundle — must contain **no real email/PII** (D-04). | No new secrets. Ensure the roster file is non-secret + PII-free before it ships in the public bundle. |
| **Build artifacts** | PWA manifest `name`/`short_name`/`description` (`vite.config.ts:74-77`), `index.html` `<title>` (line 12), precached app shell. Rebrand changes the cached shell. | Rebuild. **SW is `registerType: 'prompt'`** (`vite.config.ts`) — a rebrand-bearing SW update **waits for user approval**; friends see "Gizz With Friends" only after accepting the update / refresh (Pitfall 5). Expected, not a bug. |

**Canonical question — after every file is updated, what still carries old state?** The owner's untagged Dexie rows (claimed, not wiped), and any not-yet-refreshed installed PWA (updates via the prompt flow). Both are handled; nothing is silently stranded.

## Common Pitfalls

### Pitfall 1: `getSession()` can return null when booting offline
**What goes wrong:** On a cold offline launch with a stored session, `supabase.auth.getSession()` may return `null` because the auto-refresh path races/clears the session. `[VERIFIED: github.com/orgs/supabase/discussions/36906]`
**Why it happens:** `startAutoRefresh()` / the refresh lock attempts a refresh that can clobber the stored session when there's no network; reported against React Native + AsyncStorage (async storage). Web + synchronous `localStorage` is **less** susceptible but the same failure class exists and the discussion is **unresolved** as of March 2026.
**How to avoid:** Do NOT make the boot gate depend on `getSession()` returning a session (Pattern 2). Gate on an **app-owned identity record** written at first sign-in. `getSession()`/`onAuthStateChange` run only in the background to reconcile connectivity. This makes the lockout impossible regardless of the bug.
**Warning signs:** A friend reports "it logged me out" after an overnight offline gap — the exact symptom D-06 exists to eliminate.

### Pitfall 2: The legacy-row claim cannot live in the Dexie `upgrade()` hook
**What goes wrong:** Trying to stamp existing rows with the user id inside `version(7).upgrade(tx)` — but the DB opens **before** anyone logs in, so no user id exists yet.
**Why it happens:** Dexie upgrades run at first DB-open (app boot), which now precedes the sign-in gate.
**How to avoid:** `version(7)` only adds the `userId` **index/field structurally** (new tables need no upgrade; adding an unindexed field needs none either). The **stamping** is an app-side, meta-gated, idempotent operation at first sign-in (Pattern 3), guarded by a `meta` flag for "exactly once" (AUTH-05).
**Warning signs:** Migration test passes but rows have `userId: undefined`; or the claim re-runs on every login.

### Pitfall 3: A stale token surfaces as a jarring logout instead of "reconnecting…"
**What goes wrong:** Token *refresh* needs network (blueprint open item). Offline, a very stale token can't refresh; naive handling of a refresh failure or a `SIGNED_OUT`-ish event boots the user to the login screen mid-venue.
**Why it happens:** Treating "token not yet refreshed" as "not authenticated."
**How to avoid:** Only an **explicit** `signOut()` clears the app-owned identity (Pattern 4). A failed/pending refresh while offline is rendered as the calm `SyncDot` offline/reconnecting state (D-07), never a logout. When online returns, `TOKEN_REFRESHED` fires and the dot goes green. `[CITED: blueprint multi-user-supabase.md "Constraints — token refresh needs network"]`
**Warning signs:** Users bounced to login when signal drops.

### Pitfall 4: Unique primary keys (`&show_id`, `&sessionId`, `&cardId`) collide across users on a shared device
**What goes wrong:** The existing tables use **unique** inbound PKs (`attendedShows: "&show_id"`, `trackedShows: "&sessionId"`, `bingoCards: "&cardId"`). If two identities on one phone both mark the same `show_id`, a plain `userId` field does not prevent a PK collision — the second write upserts over the first.
**Why it happens:** D-11's "add userId + scope queries" model keeps the same unique PKs.
**How to avoid:** In practice this is a **rare edge** — D-09 says a borrowed-phone signer sees an *empty* dex (they log on their own phone; hand-off is identity, not heavy logging). Options for the planner: (a) accept the edge for v2.0 and document it; (b) for true isolation, migrate to **compound keys in new `version(7)` tables** (`[userId+show_id]`, etc.) with the claim copying legacy rows in — heavier (touches export/import + ~14 consumers). Recommend (a) with a documented limitation unless the owner wants full shared-device isolation. `sessionId`/`cardId` are UUID/derived and effectively non-colliding across users; only `attendedShows.&show_id` and `archiveShows.&show_id` are real collision candidates.
**Warning signs:** Two friends' marks of the same corpus show interfere on one device.

### Pitfall 5: Rebrand ships silently because the SW waits for approval
**What goes wrong:** After deploying the rebrand, installed PWAs still show "Guezzer" — looks like the change didn't ship.
**Why it happens:** `registerType: 'prompt'` (deliberate — never swap the app mid-show). The new SW waits; the manifest/title update lands only after the user accepts the update prompt / relaunches.
**How to avoid:** Expected behavior — verify via a fresh load or after accepting the `UpdateToast`. Don't "fix" it by switching to `autoUpdate` (explicitly forbidden in CLAUDE.md).
**Warning signs:** "The rebrand didn't deploy" on an already-installed device.

### Pitfall 6: Export/import (backup) leaks or merges across identities
**What goes wrong:** The existing `snapshot()` / `importSnapshot()` (`db.ts`) read/write **all** rows with no user scope. Post-namespacing, an export would carry every identity's rows, and an import would merge them unscoped.
**Why it happens:** The backup layer predates namespacing.
**How to avoid:** Scope `snapshot()` to the current `userId` (export only the signed-in identity's rows) and stamp imported rows with the current `userId`. This is part of the AUTH-05 surface even though it isn't named in the requirement text — flag for the planner.
**Warning signs:** A JSON export contains another friend's catches; an import inflates the wrong dex.

## Code Examples

### Reading identity from the restored session (for chrome, D-03/D-14)
```typescript
// Source: blueprint multi-user-supabase.md (VALIDATED) + seed sets user_metadata.display_name
const { data } = await supabase.auth.getSession();
const displayName = data.session?.user.user_metadata.display_name as string | undefined;
const userId = data.session?.user.id;
// For the GATE, prefer the app-owned record (Pattern 2); use the session read for chrome refresh.
```

### Baked roster (D-04) — no real PII
```typescript
// packages/app/src/auth/roster.ts — ships in the public bundle; synthetic handles only.
export const ROSTER = [
  { displayName: "Matt",  handle: "matt@gizz.local"  },
  { displayName: "Max",   handle: "max@gizz.local"   },
  // ...must match the synthetic emails the Phase-17 seed script actually minted (Open Question 2)
] as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1 "no accounts / no backend" | Supabase multi-user foundation (Option A) | 2026-07-22 (locked) | CLAUDE.md "no backend/no accounts" hard constraints are deliberately revised; spike-validated |
| `getSession()` as the source of truth for auth state at boot | App-owned identity record for the boot gate; `getSession()` for reconciliation only | This research | Immunizes the crux against the offline-null bug (Pitfall 1) |

**Deprecated/outdated:**
- Magic-link/OTP auth: wrong for a bad-signal venue (mail round-trip) — permanently out of scope.
- `getUser()` at boot: makes a network call — never on the boot path.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | On web + synchronous `localStorage`, `getSession()` returning null offline is *less* likely than the RN/AsyncStorage reports — but the app-owned-record gate makes it moot | Pitfall 1 | Low — the recommended design does not depend on getSession's offline behavior at all |
| A2 | supabase-js browser defaults `persistSession: true` + `autoRefreshToken: true` (client created with no auth options in `supabase.ts`) | Pattern 1/2 | Low — documented library defaults; verify the client isn't reconfigured |
| A3 | Only `attendedShows.&show_id` / `archiveShows.&show_id` are realistic cross-user PK-collision candidates (sessionId/cardId are UUID-derived) | Pitfall 4 | Medium — if the planner chooses field+scoping, a shared-device same-show mark could interfere |
| A4 | The Phase-17 seed used synthetic handles (reference `seed-users.mjs` uses `@fov.gizz`), so D-04 may already be satisfied structurally | Runtime State Inventory / OQ2 | Medium — if real emails were seeded, roster + re-mint needed before the bundle ships PII-free |

## Open Questions (RESOLVED)

1. **`<title>` rebrand target.** AUTH-06 lists "document title" as a rebrand surface (→ "Gizz With Friends"), but D-15 writes `index.html` `<title>` "(still 'Guezzer')". Interpretation: the parenthetical describes the *current* value (a surface to update), and the requirement is authoritative → title becomes "Gizz With Friends".
   - Recommendation: rebrand the title to "Gizz With Friends" per AUTH-06; flag for a one-line owner confirm if the planner reads D-15 as "leave the tab title as Guezzer."
   - **RESOLVED:** AUTH-06 is authoritative — the title-rebrand-to-"Gizz With Friends" decision is adopted in Plan 01 (rebrand copy/title surface). The D-15 parenthetical is read as the *current* value, not a directive to retain it.

2. **Did Phase 17 seed real emails or synthetic handles?** D-04 requires the bundle-baked roster to carry no real PII. If accounts were minted against real personal emails, the seed convention + env handle vars must change and accounts re-minted before the roster ships.
   - What we know: the reference seed script uses synthetic `@fov.gizz` handles.
   - What's unclear: what the *actual* Phase-17 run used (the real roster is filled "right before minting" per Phase-17 D-07).
   - Recommendation: verify against the live project (Management API introspection per MEMORY `v2-supabase-live-project`) before finalizing the roster; treat re-mint as a possible task.
   - **RESOLVED:** No real email/PII is baked. Plan 04 Task 1 verifies the seed-minted handles against the live Supabase project (Management API introspection) BEFORE baking the roster, and the roster ships only synthetic `@gizz.local`-style handles — if real personal emails are discovered the task STOPS and flags for owner re-mint (never bakes PII). The seed-email PII question is therefore resolved in-plan as synthetic handles only, with no decision deferred into execution.

3. **Shared-device isolation depth (Pitfall 4).** Accept the rare same-show PK-collision edge (lighter: field + query scoping) or do full compound-key isolation (heavier)?
   - Recommendation: field + scoping + documented limitation for v2.0, given D-09's "borrowed-phone dex is empty" framing. Revisit only if the owner wants hardened shared-device isolation.
   - **RESOLVED:** Field + query-scoping (a `userId` field on the 5 domain tables + `.where("userId")`-scoped reads) is adopted in Plan 02 (schema/claim) and Plan 07 (consumer read-scoping + export/import scoping); the rare same-show `&show_id` PK-collision edge is accepted and documented in `db.ts` per D-09's "borrowed-phone dex is empty" framing. Full compound-key isolation is explicitly out of scope for v2.0.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project (auth) | Sign-in (AUTH-01) | ✓ | ref `yunfqfldgbgjdqzywbdy`, us-east-1 (MEMORY) | — |
| Network (one-time, first sign-in) | AUTH-01 first login | ✓ (dev) | — | "connect once" screen (D-03) is the *product* fallback offline |
| `@supabase/supabase-js` | all auth calls | ✓ | 2.110.8 | — |
| HTTPS device UAT (iOS PWA) | AUTH-02 on-device offline-boot proof | ✓ | cloudflared tunnel `--http-host-header localhost` (MEMORY) | — |
| Node ≥ 24.12 | any CLI/seed re-run | ✓ | native-TS | — |
| `fake-indexeddb` | migration/claim tests | ✓ | 6.2.5 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** First sign-in needs network once; the offline case is the designed "connect once" UX, not a blocker.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`test.projects`: `@guezzer/core` = node, `@guezzer/app` = jsdom) |
| Config file | `vitest.config.ts` (root) `[VERIFIED]` |
| Quick run command | `npm test` (→ `vitest run`) — or `npx vitest run packages/app/test/<file>` for one file |
| Full suite command | `npm test` |
| App test env | jsdom + `fake-indexeddb/auto` + `matchMedia` stub (`packages/app/test/setup.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-05 | `version(7)` additive; v1–v6 tables preserved on upgrade | unit | `npx vitest run packages/app/test/migrationV7.test.ts` | ❌ Wave 0 (mirror `migrationV5.test.ts`) |
| AUTH-05 | Claim stamps legacy rows exactly once; re-login is a no-op | unit | same file | ❌ Wave 0 |
| AUTH-05 | Dex reads scoped to userId; other identity's rows hidden | unit | `npx vitest run packages/app/test/authNamespacing.test.tsx` | ❌ Wave 0 |
| AUTH-07 | `identityColor` deterministic + stable per userId | unit (core, node) | `npx vitest run packages/core/test/identity/color.test.ts` | ❌ Wave 0 |
| AUTH-02 | Gate opens app when app-owned identity present, no network | unit (mock supabase) | `npx vitest run packages/app/test/authGate.test.tsx` | ❌ Wave 0 |
| AUTH-04 | Sign-out clears identity → SignInScreen; no dex flash | component | same authGate file | ❌ Wave 0 |
| AUTH-01/18 | Wrong password → generic inline error (no enumeration) | component | `npx vitest run packages/app/test/signIn.test.tsx` | ❌ Wave 0 |
| AUTH-06 | Manifest/title/copy strings say "Gizz With Friends" | unit (string assert) | `npx vitest run packages/app/test/rebrand.test.ts` | ❌ Wave 0 |
| AUTH-02 | **On-device offline cold boot to full dex (airplane mode + expired token)** | **manual (device UAT)** | HTTPS tunnel per MEMROY; **the real proof of the crux — not automatable** | n/a |

### Sampling Rate
- **Per task commit:** the relevant new test file (`npx vitest run packages/app/test/<file>`).
- **Per wave merge:** `npm test` (full suite green — must not regress the 40+ existing app/core tests, esp. `migrationV3/V5`, `exportImportRoundtrip`).
- **Phase gate:** full suite green **plus** the manual on-device offline-boot check (SC-2) before `/gsd-verify-work` and before Phases 19–20.

### Wave 0 Gaps
- [ ] `packages/app/test/migrationV7.test.ts` — additive upgrade + claim-once (covers AUTH-05); mirror `migrationV5.test.ts` (uses `Dexie.delete(config.DB_NAME)` reset + `fake-indexeddb`).
- [ ] `packages/app/test/authNamespacing.test.tsx` — read-scoping hides other identity's rows (AUTH-05/D-09).
- [ ] `packages/app/test/authGate.test.tsx` — identity-present gate + sign-out teardown (AUTH-02/04); needs a `vi.mock` of the `supabase` singleton.
- [ ] `packages/core/test/identity/color.test.ts` — determinism (AUTH-07), pure/node.
- [ ] `packages/app/test/signIn.test.tsx` — inline error, roster picker (AUTH-01/D-18).
- [ ] `packages/app/test/rebrand.test.ts` — string assertions on manifest/title/copy (AUTH-06).
- [ ] Framework install: none — Vitest + fake-indexeddb already present.
- [ ] **Manual device-UAT checklist** for AUTH-02 (the crux is inherently a device test; automate the gate logic, verify the real offline boot on-device).

## Security Domain

**`security_enforcement: true`, ASVS level 1.** This phase introduces authentication + session handling — security-relevant.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **yes** | Supabase GoTrue `signInWithPassword` — bcrypt server-side, no custom credential handling. Passwords owner-minted (no in-app policy UI). No self-service reg/reset (out of scope) |
| V3 Session Management | **yes** | supabase-js JWT access+refresh in localStorage; library-managed refresh. App-owned identity record is non-authoritative UX state, not a credential |
| V4 Access Control | partial | RLS write-own is Phase 19; **Phase 18 makes no DB writes**, so no access-control surface beyond the auth call itself |
| V5 Input Validation | minimal | Password is a passthrough to GoTrue; handle comes from a fixed baked roster, not free-text — low injection surface. Render all identity strings as React text (no `dangerouslySetInnerHTML`) |
| V6 Cryptography | **no (don't hand-roll)** | Token signing/verification is Supabase's; the identity-color hash is **non-security** (a display hash — fine to be non-crypto) |
| V7 Errors & Logging | **yes** | Wrong password → generic "Invalid login credentials" (no user enumeration, D-18); never log tokens/passwords |
| V14 Config | **yes** | `anon` key in bundle is public-by-design; `service_role` never client-side (enforced Phase 17). Baked roster must be PII-free (D-04) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Real PII (emails) scraped from the public bundle roster | Information Disclosure | Synthetic `@…local`/`@…gizz` handles only (D-04); verify Phase-17 seed (OQ2) |
| User enumeration via distinct error messages | Information Disclosure | Supabase returns a single generic auth error; surface it verbatim (D-18) |
| Token theft via XSS (tokens in localStorage) | Spoofing / Elevation | No third-party scripts; React auto-escaping; no `dangerouslySetInnerHTML`; CSP is a static-host default. Accepted residual for a 5-friend personal tool |
| Self-lockout at a dead-signal venue (availability) | Denial of Service (self) | The D-06 gate (identity presence, not token validity) — the phase's central mitigation |
| Credential stuffing / brute force on the public anon auth endpoint | Spoofing | GoTrue built-in rate limiting; 5 known accounts, distinct passwords; low exposure |
| Cross-identity data leak on a shared device | Information Disclosure | Per-user Dexie scoping (D-09/D-11); scoped export/import (Pitfall 6); instant sign-out teardown (D-10) |

## Sources

### Primary (HIGH confidence)
- `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` — VALIDATED auth flow (`signInWithPassword`/`getSession`/`onAuthStateChange`/`signOut`), "don't gate startup on a live auth check", token-refresh-needs-network open item.
- Repo source (read directly): `packages/app/src/db/supabase.ts`, `db/db.ts`, `App.tsx`, `main.tsx`, `live/SyncDot.tsx`, `live/useOnlineStatus.ts`, `map/MapView.tsx`, `components/AppShell.tsx`, `dex/useDexStats.ts`, `config.ts`, `vite.config.ts`, `test/setup.ts`, `test/migrationV5.test.ts`, `vitest.config.ts`, `package.json` — all versions/idioms VERIFIED.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §Phase 18, `18-CONTEXT.md`, `17-CONTEXT.md` — requirement + decision text.

### Secondary (MEDIUM confidence)
- [Supabase getSession docs](https://supabase.com/docs/reference/javascript/auth-getsession) — "loads values directly from the storage attached to the client"; `getUser()` recommended when storage authenticity matters.
- [Supabase user-sessions guide](https://supabase.com/docs/guides/auth/sessions), [refreshSession](https://supabase.com/docs/reference/javascript/auth-refreshsession) — auto-refresh + TOKEN_REFRESHED semantics.

### Tertiary (LOW confidence — flagged, informs Pitfall 1)
- [GitHub Discussion #36906 — Supabase Auth session lost when starting app offline](https://github.com/orgs/supabase/discussions/36906) — unresolved; RN/AsyncStorage-specific reports of `getSession()` returning null offline. Drives the app-owned-record gate recommendation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps already installed + version-verified in-repo.
- Auth flow / boot gate: HIGH — blueprint-validated; the app-owned-record refinement is a conservative strengthening of D-06.
- Namespacing mechanics: MEDIUM — additive `version(7)` + app-side claim is clear, but the shared-device PK-collision (Pitfall 4) is a genuine design choice left to the planner.
- Pitfalls: HIGH for the boot/claim/rebrand items (verified in-repo + blueprint); MEDIUM for the offline-getSession edge (verified issue but RN-specific).

**Research date:** 2026-07-22
**Valid until:** ~2026-08-21 (supabase-js auth is fast-moving on offline/refresh behavior — re-check Pitfall 1 if the plan slips a month; the in-repo idioms are stable).
