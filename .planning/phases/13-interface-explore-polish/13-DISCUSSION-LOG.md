# Phase 13: Interface & Explore Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 13-Interface & Explore Polish
**Areas discussed:** UX-01 inset source, UX-03 fill-hint safety, UX-04 camera behavior, Regression-proof bar

---

## UX-01 — Safe-area inset source

| Option | Description | Selected |
|--------|-------------|----------|
| Per-surface env() only | Drop body top padding; every top-anchored surface (shell + each fixed overlay) applies its own env() calc. One idiom; overlays already need it. | ✓ |
| Body padding only | Keep body padding-top, strip header's re-add. Simpler for shell but overlays still need own env() — keeps two idioms (the bug's cause). | |
| You decide | Let planning audit all fixed surfaces and pick the single source. | |

**User's choice:** Per-surface env() only
**Notes:** One consistent idiom, body top padding dropped. Planning must audit ALL fixed-position top surfaces (SearchSheet, ArchiveBrowser, RecapView) for consistent header heights.

---

## UX-03 — Fill-hint safety posture

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative-suppress | Only offer a hint when the neighborhood clearly aligns with the editor sequence; otherwise no hint. Never names the wrong song. | ✓ |
| Alignment-anchor | Actively resolve the right song via nearest surrounding logged songs + editor row between them. Fills more, more edge cases. | |
| You decide | Both must guarantee no confident wrong-song hint. | |

**User's choice:** Conservative-suppress
**Notes:** No hint beats a wrong hint. Worst acceptable case is a missing hint the user fills manually. Matches robustness-over-strictness posture.

---

## UX-04 — Constellation camera on resize

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve exactly | First-settle flag only; pure size changes never move the camera at all. | |
| Preserve + re-center if lost | First-settle gate, but if the focused node would go off-screen after resize, smoothly re-center on it (not fit-all). | ✓ |
| You decide | Both must stop the fit-all snap on resize. | |

**User's choice:** Preserve + re-center if lost
**Notes:** Resize preserves pan/zoom; only intervene if the focus would be lost off-screen, and then re-center rather than fit-all. Any new duration/threshold constants go in config.explore.

---

## Regression-proof bar

| Option | Description | Selected |
|--------|-------------|----------|
| Unit + component + iOS UAT | UX-03 core unit tests, UX-02 jsdom component test of the race, UX-01/04 documented on-device iOS UAT. Mirrors Phase 12 D-08. | ✓ |
| Unit + iOS UAT only | Core unit for UX-03; everything else device-verified. Skips the jsdom wake-lock test. | |
| You decide | UX-03 gets unit tests; device-only bugs get documented iOS UAT at minimum. | |

**User's choice:** Unit + component + iOS UAT
**Notes:** UX-02 also gets a device confirm. Use the cloudflared HTTPS tunnel per the device-UAT memory. Persist device checks as UAT items.

---

## Claude's Discretion

- UX-01: exact per-surface `env()` calc placement; whether to also move the left/right/bottom body insets for consistency.
- UX-02: not discussed as a gray area — its fix is unambiguous (re-check `showActive` after the acquire resolves, release immediately if false), locked by the todo. Exact code shape is planning's detail.
- UX-03: the precise alignment/neighborhood-match algorithm, provided it never names a wrong song and suppresses on ambiguity.
- UX-04: the first-settle flag mechanism, off-screen-detection method, and re-center constant values in config.

## Deferred Ideas

None raised beyond phase scope — the phase stayed on its four fixes. Two Explore/UI keyword-matched todos (directional-flow particles, bottom-sheet animation) reviewed and left for v2 (conflict with settle-and-freeze / out of scope).
