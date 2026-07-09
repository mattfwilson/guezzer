# Phase 3: App Shell & PWA Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 3-App Shell & PWA Foundation
**Areas discussed:** Shell scope & navigation, Install onboarding UX, Update prompt & version stamp, Data foundation scope

---

## Shell Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Nav skeleton + empty views | Persistent Show/Explore/Dex chrome, each view a labeled empty placeholder; navigable end-to-end | ✓ |
| Single placeholder screen | One "ready" screen proving install/offline/persist, no nav yet | |
| Nav + live smoke test | Nav skeleton plus one view wired to `@guezzer/core` to prove the core→app data path offline | |

**User's choice:** Nav skeleton + empty views
**Notes:** Live core smoke test explicitly declined — kept scope lean; app→core import wiring still established so Phase 4 isn't blocked.

## Nav Model

| Option | Description | Selected |
|--------|-------------|----------|
| Hash routing | `#/show`, `#/explore`, `#/dex` — shareable/bookmarkable URLs, back button, static-host safe | ✓ |
| View-state only | Plain React `useState`, no URL reflection; loses shareable-URL property | |

**User's choice:** Hash routing
**Notes:** Aligns with the "shareable via URL" PWA requirement; no router library per CLAUDE.md.

---

## Install UX

| Option | Description | Selected |
|--------|-------------|----------|
| Dismissible banner + menu | Dismissible "Install" banner (native prompt on Android, iOS steps on iOS) + permanent menu entry | ✓ |
| First-run onboarding screen | Full-screen first-launch install flow before showing the app | |
| Menu button only | Install lives only in a menu/settings item, no proactive prompt | |

**User's choice:** Dismissible banner + menu

## iOS Steps

| Option | Description | Selected |
|--------|-------------|----------|
| Illustrated steps | iOS Share glyph + numbered steps, shown only to detected iOS Safari | ✓ |
| Text-only steps | Plain numbered text, no glyph | |

**User's choice:** Illustrated steps
**Notes:** The Share icon picture is the point — users can't find the button by name.

## Re-prompt

| Option | Description | Selected |
|--------|-------------|----------|
| Stay dismissed | Don't auto-show again; rely on the menu entry | |
| Re-show next launch | Reappear on next app open until actually installed | ✓ |

**User's choice:** Re-show next launch
**Notes:** Menu entry remains the always-available fallback; higher conversion for the iOS eviction risk.

---

## Update UX

| Option | Description | Selected |
|--------|-------------|----------|
| Non-blocking toast | Dismissible "New version available — Refresh"; applies only on user tap | ✓ |
| Settings-only indicator | Update item appears only in menu/settings, no toast | |
| Toast, suppress during show | Toast but suppressed while a show is tracked (Phase 4 concept) | |

**User's choice:** Non-blocking toast
**Notes:** User-tap-only gate already satisfies never-mid-show for Phase 3; suppress-during-show deferred to Phase 4.

## Version Stamp

| Option | Description | Selected |
|--------|-------------|----------|
| Version + short SHA, in menu | `v1.0.0 · a1b2c3d · built <date>` in menu/about | ✓ |
| Version only | Just `v1.0.0` from package.json | |
| Build timestamp only | Build date/time, not tied to a commit | |

**User's choice:** Version + short SHA, in menu
**Notes:** Debugging anchor for friend bug reports — pins the exact build.

---

## DB Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Thin real schema | Dexie v1: meta/settings + stub `attendedShows` keyed by stable `show_id`; grow via migrations | ✓ |
| Full anticipated schema | Define attendedShows + trackedSetlists now to match P4/P5/P6 | |
| Meta table only | Generic key-value/meta table only, no domain tables | |

**User's choice:** Thin real schema
**Notes:** MVP-lean; proves PWA-03 against a real entity without committing to unlocked P4/P5/P6 shapes.

## Persist

| Option | Description | Selected |
|--------|-------------|----------|
| Early + silent fallback | Request `persist()` on first run; continue silently if denied; record status | ✓ |
| Request + show storage status | Request early AND show a persistence indicator in menu/about | |
| Defer to install | Only request persistence after home-screen install | |

**User's choice:** Early + silent fallback
**Notes:** Export (Phase 5, PWA-04) is the real backstop; status recorded so a later phase can nudge export.

---

## Claude's Discretion

- Exact `vite-plugin-pwa`/Workbox config wiring (precache globs; `json` glob deferred to when the matrix artifact is precached in a later phase).
- Tailwind v4 setup, dark-theme tokens, 44px tap-target base styles (optionally formalized via `/gsd-ui-phase`).
- PWA manifest details + app icon generation.
- Build-time git SHA + build-date injection (Vite `define`).
- Menu/about component structure; nav switcher placement (bottom tab vs header).
- App module decomposition, workspace devDep additions, Vitest `jsdom` app project.
- Optional minimal app-level test (DB round-trip, hash-route switch).

## Deferred Ideas

- Suppress the update toast during an active tracked show — Phase 4 (needs "active show" state).
- Live core smoke test in the shell — declined here; app→core wiring still established.
- Persistence-status indicator in the menu — deferred; status recorded silently now, surfaces with Phase 5 export.
- Precache the matrix/corpus JSON for offline model use — Phase 4; remember `json` isn't a Workbox `globPatterns` default.
