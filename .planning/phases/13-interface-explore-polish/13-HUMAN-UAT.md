---
status: passed
phase: 13-interface-explore-polish
source: [13-VALIDATION.md, 13-CONTEXT.md]
owner_plan: 13-01
requirements: [UX-01, UX-02, UX-04]
created: 2026-07-19
verified: 2026-07-19
---

# Phase 13 — On-Device iOS Safari UAT Checklist

> Consolidated device-only verification for phase 13 (D-06 regression-proof standard:
> unit + component + **documented iOS UAT**). This is the single owner file for the
> parallel wave — plans 13-02 and 13-04 do not append here; they record their device
> confirmations against these items.
>
> Execute every item on a **physical notched iPhone** with the PWA installed
> (standalone / Add to Home Screen) before running `/gsd-verify-work`.

## Hosting (required for all items)

Serve the production build over an HTTPS cloudflared tunnel — plain LAN HTTP will not
register a service worker, so the installed-PWA and offline surfaces cannot be exercised.
See the `device-uat-hosting` project memory for the full runbook.

1. `npm run build -w @guezzer/app`
2. `npm run preview -w @guezzer/app -- --port 4173 --strictPort` (background)
3. `cloudflared tunnel --url http://localhost:4173 --http-host-header localhost`
   — the `--http-host-header localhost` flag is MANDATORY (vite preview returns 403 on a
   mismatched Host header). cloudflared is winget-installed but not on PATH; invoke by full
   path: `"/c/Program Files (x86)/cloudflared/cloudflared.exe"`.
4. Open the `https://<random>.trycloudflare.com` URL on the iPhone, then **Add to Home
   Screen** and launch the installed (standalone) app.

---

## UX-01 — Single top safe-area inset; overlay headers aligned

Owner: **13-01** (this plan).

**Repro:**
1. Launch the installed (standalone) PWA on a notched iPhone via the cloudflared HTTPS
   tunnel (`--http-host-header localhost`).
2. Observe the top of the AppShell header (the "Guezzer" title bar).
3. Open each top-anchored overlay in turn and observe the space above its header:
   SearchSheet, ArchiveBrowser, AlbumDetail, CompareView, SetlistView, RecapView.

**Expected:**
- A **single** `env(safe-area-inset-top)` dead band sits above the header — **no doubled
  ~50px band** under `viewport-fit=cover`.
- Header content is **vertically aligned** across the shell header and all six overlays.
- RecapView intentionally sits **12px lower** than the other headers (+24px vs +12px by
  design — see 13-01 Task 1); this offset is expected, not a regression.

- [x] UX-01 verified on device — passed (2026-07-19, standalone PWA on physical notched iPhone)

---

## UX-02 — Screen sleeps after End Show (device confirmation)

Owner: **13-02** (wake-lock release; mechanically covered by its jsdom test). This item is
the on-device confirmation of the released wake lock.

**Repro:**
1. In the installed PWA (over the cloudflared HTTPS tunnel with `--http-host-header
   localhost`), start a show (Show Mode running — wake lock held, screen stays awake).
2. End the show via End Show.
3. Leave the device untouched.

**Expected:**
- After End Show the screen **dims and sleeps** on the normal iOS auto-lock timer and
  **stays asleep** — the wake lock is released, not lingering.

- [x] UX-02 verified on device — passed (2026-07-19, screen slept and stayed asleep after End Show)

---

## UX-04 — Constellation camera preserved across address-bar collapse / rotation

Owner: **13-04** (constellation camera stability). On-device confirmation.

**Repro:**
1. In the installed PWA (over the cloudflared HTTPS tunnel with `--http-host-header
   localhost`), open Explore / the constellation.
2. Pan and zoom into a specific region of the graph.
3. **Rotate** the device (portrait ↔ landscape). NOTE: in the installed/standalone PWA
   there is no address bar and no keyboard (Explore's only control is a slider), so
   **rotation is the container-resize trigger** — it fires the same ResizeObserver event
   the fix gates on. (Address-bar collapse only applies when running in a Safari browser
   tab, not the home-screen app.)
4. Separately, focus a node, then drive that focused node off-screen via a rotation.

**Expected:**
- After address-bar collapse + rotation the **camera stays put** — no fit-all snap, no
  camera jump.
- When a focused node would leave the screen, the view **smoothly re-centers pan-only**
  onto it (does NOT fit-all / reset zoom).

- [x] UX-04 verified on device — passed (2026-07-19, rotation preserved pan/zoom; off-screen focus panned back at current zoom)

---

## Sign-off

- [x] All three device items verified on a physical notched iPhone — owner-approved 2026-07-19
- [x] Tunnel torn down (both preview + cloudflared background processes stopped)

Outcome: **UX-01 passed · UX-02 passed · UX-04 passed** — owner sign-off 2026-07-19.
