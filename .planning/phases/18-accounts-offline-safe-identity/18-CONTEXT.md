# Phase 18: Accounts & Offline-Safe Identity - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Give each of the ~5 friends a distinct, pre-made identity they sign into, reach the app as, and **still cold-boot fully offline** at a dead-signal venue. Namespace the existing single-user Dexie data to a user id so a shared/borrowed phone never cross-contaminates two friends' dexes. Ship the "Gizz With Friends" rebrand chrome. This phase owns the milestone's **highest-risk seam** (offline-safe identity) and gates all shared state (Phases 19–20).

**In scope:** AUTH-01 (pre-made email/password sign-in, no self-service registration), AUTH-02 (offline-safe session boot — never gate startup on a network auth check), AUTH-03 (display_name in chrome), AUTH-04 (sign-out / device hand-off), AUTH-05 (one-time Dexie namespacing to user id), AUTH-06 ("Gizz With Friends" rebrand surfaces), AUTH-07 (deterministic auto color/avatar from user id), AUTH-08 (calm "reconnecting…" affordance for a stale token).

**Explicitly NOT in this phase:** no progress upsert/sync, friends screen, `deriveSharedProgress`, or live `postgres_changes` (Phase 19); no presence dots / waves / reactions / coarse activity (Phase 20); no self-service sign-up, magic-link/OTP, or in-app password-reset UI (permanently out of scope per REQUIREMENTS Out-of-Scope). Phase 18 writes **nothing** to Supabase beyond the auth sign-in call itself — the only network dependency is authentication, and it is deliberately kept off the boot path.

</domain>

<decisions>
## Implementation Decisions

### Sign-in surface (AUTH-01)
- **D-01:** Sign-in uses a **name-picker + password**: the ~5 friends' display names render as large tap targets; tapping one pre-fills that account's login handle and the friend just types their password. Optimized for one-thumb, in-the-dark, drunk-thumb entry. (Session persists after first login, so the password is typed only once per device.)
- **D-02:** Auth is a **full gate**. No stored session → login screen, and the app is blocked behind it (no anonymous/v1 fallback path going forward). Every user is always "someone." Offline boot still works once the friend has signed in once on this device (see D-06).
- **D-03:** First-ever launch on a device with **no signal** (never signed in here) shows a **calm "connect once" screen** — a friendly note ("connect to Wi-Fi/data once to sign in — then it works offline"), not a crash or a spinner-of-death.

### Roster & login handles (AUTH-01) — cross-phase note to seed convention
- **D-04:** The name-picker needs a client-side roster (`display_name → login handle`) baked into the deployed (public-URL) bundle. To keep **no real PII in a scrapeable bundle**, seed accounts with **synthetic login-handle emails** (e.g. `ezra@gizz.local`) used only as sign-in handles; the client roster ships those, never anyone's real email. **This adjusts Phase 17's seed convention** — the seed script mints accounts against slug-derived synthetic handles from env, not real personal emails. (Phase 17 already keeps email+password in env keyed by slug — this only fixes what value those email vars hold.)

### Offline-safe identity & session boot (AUTH-02, AUTH-08) — highest-risk
- **D-05:** Boot restores the session **synchronously** via `supabase.auth.getSession()` from localStorage — **startup is NEVER gated on a live network auth check**. `onAuthStateChange` reconciles login/logout/refresh when connectivity returns. (Blueprint-locked; must not regress the shipped v1 offline boot.)
- **D-06:** **The auth gate keys on presence of a stored session identity, NOT on token validity.** An **expired-but-present** session still opens the full offline dex as that identity (reading local Dexie needs no token; only Supabase calls do, and there are none until Phase 19). The token refreshes quietly when signal returns. This directly prevents the lockout failure mode: a friend whose token expired overnight is **never locked out of their own offline dex** at a dead-signal venue. No grace-window timer — presence of identity is the whole rule.
- **D-07:** The "reconnecting…" affordance (AUTH-08) **extends the existing live-sync status idiom** (`packages/app/src/live/SyncDot.tsx` + `useOnlineStatus.ts`) rather than inventing a second connection indicator. A stale token surfaces as the same calm chrome dot language, never a jarring "you're logged out."

### Shared-device data & namespacing (AUTH-04, AUTH-05)
- **D-08:** On the **first** sign-in on a device, the pre-existing single-user v1 dex is **claimed by (namespaced to) the first signer**, one time. On the owner's own phone that preserves the owner's real v1 catch history as their identity's dex.
- **D-09:** **Borrowed-phone behavior:** after sign-out → another friend signs in, the new friend sees **only their own dex** (empty until Phase 19 syncs it down). The prior user's data stays on-device but namespaced and is **never shown** to the new user. No cross-contamination.
- **D-10:** **Sign-out clears to the login screen instantly** with the view torn down — no flash of the previous person's dex to the next.
- **D-11:** Mechanism is the planner's call, but the behavior implies **one Dexie DB with per-user namespacing** (an additive `version(7).stores(...)` following the strict additive discipline in `db.ts`), queries scoped to the current user id, retaining multiple users' rows on-device while showing only the current identity's. The one-time claim stamps existing untagged rows with the first user id exactly once (AUTH-05 "exactly once").

### Identity look (AUTH-07)
- **D-12:** Each identity renders as a **colored circle + display-name initial(s)**, dark-on-light text like the existing rarity/tuning orbs (`ORB_TEXT_COLOR` `#0C0C10`). Legible as both a chrome glyph and (later) a presence dot in the dark. (Chosen over emoji avatars, which shrink poorly to a dot, and a plain dot, which can't identify who is who.)
- **D-13:** Color is **deterministic from the Supabase user id** via the hash→palette-index idiom (mirror `MapView.memberColor`'s `hash = hash*31 + charCodeAt | 0`), but into a **fresh, dedicated auth palette in config** — decoupled from the GizzMap `MEMBER_COLORS` set. Deterministic-from-id guarantees a friend looks the same on every device (feeds Phase 19 friend rows + Phase 20 presence dots).

### Identity chrome placement (AUTH-03, AUTH-04)
- **D-14:** A small **avatar (color + initials) sits in the header**; tapping it opens a **sheet** showing the full display_name + the sign-out control. Keeps the tight mobile header (title + existing menu button) clean with one obvious identity affordance. The seeded `display_name` (from `user_metadata`) is the label.

### Rebrand scope (AUTH-06)
- **D-15:** **Full "Gizz With Friends" rebrand**, including the share card. Surfaces: `index.html` `<title>` (still "Guezzer"), the PWA manifest `name`/`description` in `vite.config.ts`, the `config.copy` install/CTA strings, and the **share-card gold wordmark** (`share.wordmarkGold` text). The header wordmark is already done (commit `30f86cc`). The planner should size the share-card wordmark to fit "Gizz With Friends" (may need a smaller mark). **Display/chrome only** — tab routes, file paths, and persisted Dexie/storage keys (incl. `DB_NAME = "guezzer"`) stay unchanged (same discipline as the v1 tab rebrand).
- **D-16:** PWA manifest **`short_name` = "Gizz With Friends"** (owner's explicit choice; may truncate under the installed home-screen icon on some phones — acceptable to the owner).

### Post-login landing (AUTH-01)
- **D-17:** After sign-in, land on the **app's current default view** (its default hash route). Auth gates entry only; it does not relocate the user.

### Password failure / recovery (out-of-scope reset)
- **D-18:** A wrong password shows a **calm inline error**; a small "Forgot? Ask [owner] to reset it" line points at the real recovery path (owner re-mints via the seed script). No self-service reset — but no silent dead end either.

### Claude's Discretion
- The exact Dexie `version(7)` schema shape, index choices, and the one-time claim migration mechanics (D-11) — behavior is locked, implementation is open.
- Exact sign-in screen layout/styling and the identity sheet's visual treatment (D-01, D-14).
- The fresh auth palette's specific hues and the shared hash helper's location (D-13) — as long as it's a config-level palette, deterministic from user id, and legible in the dark.
- Exact copy strings for the "connect once" screen, "reconnecting…" state, and the password-error / ask-owner note (D-03, D-07, D-18).
- Whether the identity avatar/color helper lives in `packages/app` config or a pure `packages/core` helper — must not import Supabase into core.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spike blueprint (primary — validated across two remote devices)
- `.claude/skills/spike-findings-guezzer/SKILL.md` — blueprint index + non-negotiable requirements.
- `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` — **the load-bearing reference.** Auth + identity flow (`signInWithPassword`, `getSession` sync restore, `onAuthStateChange`, `signOut`), the "don't gate startup on a live auth check" rule, first-login Dexie namespacing, and the token-refresh-needs-network open item (AUTH-08).
- `.claude/skills/spike-findings-guezzer/sources/002-supabase-multiuser/seed/seed-users.mjs` — reference seed script; relevant to D-04's synthetic-handle convention.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — **AUTH-01…08** (this phase's exact requirement text, incl. AUTH-02's `getSession()` offline-boot rule and AUTH-08's stale-token UX framing); the **Out-of-Scope** table (no self-signup, no magic-link, no password-reset UI).
- `.planning/ROADMAP.md` §"Phase 18" — goal + the 5 success criteria this phase is verified against; the milestone framing (identity gates Phases 19–20; device-verify offline boot before building on it).

### Prior phase context
- `.planning/phases/17-backend-foundation-secrets/17-CONTEXT.md` — the Supabase foundation Phase 18 consumes: the single app-layer client (D-14/D-13 there), the `progress` schema/`summary jsonb`, the seed roster convention (D-06/D-08 there) that D-04 here adjusts, and the `VITE_`-prefix secret boundary.

### Project constraints
- `CLAUDE.md` — strict core purity (`packages/core` = zero DOM/browser/network/Supabase deps); Node ≥ 24.12 native-TS; single-config-file convention. Note: the "no backend / no accounts" hard constraints are deliberately revised by v2.0 — not blockers.
- `.planning/PROJECT.md` — v2.0 backend decision (Option A): Supabase is THE multi-user foundation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/app/src/db/supabase.ts` — the single app-layer Supabase client singleton (Phase 17). The ONLY `createClient` call in the repo; Phase 18 is its **first consumer** (`supabase.auth.*`). Header comment explicitly defers "offline-session tuning" to Phase 18.
- `packages/app/src/live/SyncDot.tsx` + `packages/app/src/live/useOnlineStatus.ts` — existing live-sync connection-status dot + online/offline hook; **extend these** for the AUTH-08 "reconnecting…" affordance (D-07) rather than adding a parallel indicator.
- `packages/app/src/map/MapView.tsx:53-58` — `memberColor(id)` hash→palette idiom to **mirror** for the deterministic per-user color (D-13); `config.map.MEMBER_COLORS` (`config.ts:722`) is the palette to sit *beside* (not reuse) with a fresh auth palette.
- `packages/app/src/dex/rarityStyle.ts` + `packages/app/src/show/tuningColor.ts` — the dark-on-light orb color+text pairing (`ORB_TEXT_COLOR` `#0C0C10`) to replicate for the identity avatar (D-12).
- `packages/app/src/config.ts` — the single giant `config` object; new `auth` block (palette + any constants) slots in here (mirrors `core/config.ts` where a key must stay equal across both).

### Established Patterns
- **App boot is synchronous today.** `main.tsx` mounts `<App/>` with no async gate/splash; `App.tsx` (`useHashRoute`, `AppShell` → synchronous route switch, `requestPersistenceOnce()` the only startup side effect). Any auth gate is the **first interposition** into this tree — it MUST preserve the zero-await synchronous first paint for a restored session (D-05/D-06).
- **Dexie is strictly additive.** `db.ts` (`GuezzerDB extends Dexie`, DB name `"guezzer"` from `config.ts:16`, singleton `db`) has 6 additive `version()` blocks; tables keyed by domain ids (`&show_id`, `&sessionId`, `&cardId`), **not** a user id today. AUTH-05 namespacing is a new additive `version(7)` (D-11).
- **Rebrand is chrome-only.** The v1 tab rebrand kept routes/paths/storage keys stable; AUTH-06 (D-15/D-16) follows the same discipline — never touch `DB_NAME` or persisted keys.
- `VITE_`-prefixed env is auto-exposed by Vite (typed via `vite-env.d.ts`); the app reads only the two public Supabase vars — no `define` entry needed for new client config.

### Integration Points
- The auth gate wraps the route switch in `App.tsx` (lines ~76-95, inside/around `<AppShell>`).
- The identity avatar + sign-out sheet hang off the header in `AppShell.tsx` (wordmark at line 44, menu button 46-53).
- Rebrand surfaces: `index.html:12` (`<title>`), `vite.config.ts:75-77` (manifest `name`/`short_name`/`description`), `config.ts:369` + `config.copy` (762-769) strings, share-card wordmark.
- Downstream: Phase 19 keys every `progress` row by this phase's `user_id` and reuses the identity color; Phase 20 keys its Realtime presence channel by the same user id + reuses the avatar/color for presence dots.

</code_context>

<specifics>
## Specific Ideas

- **The lockout-prevention rule (D-06) is the crux of the whole phase.** "Gate on stored identity, not token validity" is what makes the highest-risk seam safe: because Phase 18 makes no Supabase writes and Dexie reads need no token, a known identity is sufficient to open the full offline dex. This must be explicit in the plan and device-verified (expired token + airplane mode → dex still opens) before Phases 19–20 build on it.
- **Reuse over reinvention for connection UX:** the "reconnecting…" state is the existing SyncDot's language, not a new component — keeps the app's connection vocabulary singular.
- **Deterministic identity color from user id** (not from display_name, not stored) so it's stable across devices and derivable everywhere by everyone — the enabling primitive for Phase 19 friend rows and Phase 20 presence dots.
- **Synthetic login handles (D-04)** keep the public bundle PII-free while still giving the friendly name-picker — the roster maps names to `@gizz.local`-style handles, never real inboxes.

</specifics>

<deferred>
## Deferred Ideas

- **Progress upsert/sync, `deriveSharedProgress`, friends screen, live `postgres_changes`, head-to-head compare** → Phase 19 (PROG-01…08). The identity color primitive (D-13) is built here for reuse there.
- **Presence dots, waves, reactions, coarse activity status** → Phase 20 (PRES-01…07). The per-user avatar/color (D-12/D-13) feeds presence dots.
- **Self-service password reset / sign-up / magic-link** → permanently out of scope (REQUIREMENTS Out-of-Scope). Recovery is owner-re-mint (D-18).
- **GizzMap ↔ account convergence (derive map secret from session; full relay port)** → deferred backlog, out of v2.0.

### Reviewed Todos (not folded)
- 16 pending todos surfaced by `todo.match-phase 18` — all matched only on the generic `packages/app` / `dex` / `ui` keywords (bottom-sheet animation, date-format, share-card totals, standalone-PWA viewport gap, constellation flow animation, and a batch of future-feature seeds: Badge system, Couch Mode, Guezz League, Gizzle, Residency Mode, Song Dossiers, Shiny catches, etc.). **None touch the auth/identity/offline-boot domain; none folded.**

</deferred>

---

*Phase: 18-accounts-offline-safe-identity*
*Context gathered: 2026-07-22*
