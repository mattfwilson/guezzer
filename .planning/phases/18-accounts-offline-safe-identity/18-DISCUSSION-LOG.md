# Phase 18: Accounts & Offline-Safe Identity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 18-accounts-offline-safe-identity
**Areas discussed:** Sign-in surface, Shared-device identity, Identity look, Reconnecting & rebrand, Roster/login handles, Expired-session offline, Identity chip placement, Post-login landing, Wrong password / recovery

---

## Sign-in surface

| Question | Options | Selected |
|----------|---------|----------|
| Sign-in UI | Name-picker + password / Raw email + password / Name-picker remembered | **Name-picker + password** ✓ |
| Auth gate | Required (full gate) / Optional (anonymous OK) | **Required (full gate)** ✓ |
| Cold + offline first launch | Calm "connect once" screen / Don't special-case it | **Calm "connect once" screen** ✓ |

**Notes:** Optimized for one-thumb, dark-venue entry. Session persistence means the password is typed once per device. No anonymous/v1 fallback going forward.

---

## Roster / login handles

| Question | Options | Selected |
|----------|---------|----------|
| Friends' login emails in the public bundle | Login aliases (synthetic) / Ship real emails / You decide | **Login aliases, not real emails** ✓ |

**Notes:** The name-picker requires a client-side `display_name → handle` roster in the deployed (public-URL) bundle. Synthetic `@gizz.local`-style handles keep real PII out of a scrapeable bundle. Adjusts Phase 17's seed convention (what value the env email vars hold).

---

## Shared-device identity

| Question | Options | Selected |
|----------|---------|----------|
| Existing v1 dex on first login (AUTH-05) | First signer claims it / Always start fresh / Ask at first login | **First signer claims it** ✓ |
| Borrowed phone: what friend B sees (AUTH-04) | Own dex only, yours hidden / Wipe on sign-out | **Own dex only; yours hidden** ✓ |
| Sign-out visible teardown | Clear to login instantly / You decide | **Clear to login instantly** ✓ |

**Notes:** Implies one Dexie DB with per-user namespacing (additive version 7), queries scoped to current user id, multiple users' rows retained on-device but only current identity shown.

---

## Identity look

| Question | Options | Selected |
|----------|---------|----------|
| Avatar form (AUTH-07) | Colored circle + initials / Colored circle + emoji / Plain colored dot | **Colored circle + initials** ✓ |
| Color source | Reuse GizzMap memberColor idiom / Fresh auth palette | **Fresh auth palette** ✓ |

**Notes:** Reuse the hash→palette-index idiom (keyed by Supabase user id) but with a dedicated auth palette in config, decoupled from map's MEMBER_COLORS. Dark-on-light text like existing rarity/tuning orbs.

---

## Reconnecting & rebrand

| Question | Options | Selected |
|----------|---------|----------|
| "Reconnecting…" affordance (AUTH-08) | Reuse SyncDot idiom / Dedicated chrome pill / Transient toast | **Reuse SyncDot idiom** ✓ |
| Rebrand scope (AUTH-06) | Chrome + manifest only / Full rebrand incl. share card / You decide | **Full rebrand incl. share card** ✓ |
| PWA short_name (icon label) | Gizz Friends / Keep "Guezzer" / GizzWithFriends | **Gizz With Friends** ✓ |

**Notes:** Share-card wordmark may need a smaller mark to fit "Gizz With Friends". short_name may truncate under the icon on some phones — acceptable to owner. Chrome/display only — routes, paths, DB_NAME stay unchanged.

---

## Expired-session offline (highest-risk seam)

| Question | Options | Selected |
|----------|---------|----------|
| Gate on stored identity vs token validity | Open dex, reconnect quietly / Force re-login when expired / Grace window then gate | **Open dex, reconnect quietly** ✓ |

**Notes:** Gate keys on presence of a stored session identity, NOT token validity. Local Dexie reads need no token; Phase 18 makes no Supabase writes. Prevents the lockout failure mode (token expires overnight → dead-signal venue). Must be device-verified before Phases 19–20.

---

## Identity chip + sign-out placement

| Question | Options | Selected |
|----------|---------|----------|
| Where identity + sign-out live (AUTH-03/04) | Avatar in header → sheet / Full chip in header / All in settings menu | **Avatar in header → sheet** ✓ |

**Notes:** Small avatar in header; tap opens a sheet with full display_name + sign-out. Keeps tight mobile header clean.

---

## Post-login landing

| Question | Options | Selected |
|----------|---------|----------|
| Landing view after sign-in | Keep current default / Always GizzDex / Restore last view | **Keep current default** ✓ |

**Notes:** Auth gates entry only; does not relocate the user.

---

## Wrong password / no recovery

| Question | Options | Selected |
|----------|---------|----------|
| Failure/recovery UX (no self-service reset) | Inline error + ask-owner note / Inline error only / You decide | **Inline error + ask-owner note** ✓ |

**Notes:** Calm inline error + small "Forgot? Ask [owner] to reset it" line pointing at owner-re-mint. No self-service reset (out of scope), but no silent dead end.

---

## Claude's Discretion

- Dexie `version(7)` schema shape, indexes, and one-time claim migration mechanics.
- Sign-in screen layout/styling and identity sheet visual treatment.
- Fresh auth palette hues and shared hash helper location.
- Exact copy for "connect once", "reconnecting…", and password-error/ask-owner strings.
- Whether the avatar/color helper lives in app config or a pure core helper (must not import Supabase into core).

## Deferred Ideas

- Progress sync / friends screen / `deriveSharedProgress` / head-to-head → Phase 19.
- Presence dots / waves / reactions / coarse activity → Phase 20.
- Self-service password reset / sign-up / magic-link → permanently out of scope.
- GizzMap ↔ account convergence → deferred backlog, out of v2.0.
- 16 reviewed todos (generic-keyword UI-polish/future-feature matches) — none touch the auth domain; none folded.
