---
phase: 08
slug: on-device-ui-polish-accessibility
status: verified
threats_total: 18
threats_closed: 18
threats_open: 0
asvs_level: 1
created: 2026-07-18
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Phase 08 was a pure client-side UI accessibility + z-layering refactor for a
> static, backend-less PWA (no auth, no network writes, no server, no new npm
> packages). Verification confirmed each declared mitigation against the actual
> source — documentation and intent were not accepted as evidence.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| kglw-derived catalog → DOM/Canvas render | Song/venue names (from the bundled kglw corpus) rendered into headings, `aria-label`s, canvas labels | Untrusted-origin strings; core invariant is React-text / `fillText` only, never `dangerouslySetInnerHTML` |
| User free-text → local schema | "Whose dex is this?" owner-name input | Length-clamped string (schema hard-clamp 40 chars), stored locally only, never sent to a server |
| Modal a11y layer → app-content root | Focus trap + native `inert` toggle on `#app-content` while a modal is open | DOM focus / AT-tree suppression; ref-counted to survive modal stacking |
| Dev harness route → bundled catalog | `#/dev/orb-fit` renders already-bundled public catalog names | Public data only, dev-gated, no secrets |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-08-01 | Tampering/Elevation | `components/Sheet.tsx` | mitigate | `children` passed through untouched; no `dangerouslySetInnerHTML` — `Sheet.tsx:108` renders `{children}`, comment `:18`; app-wide grep found ZERO usages (only "never" comments) | closed |
| T-08-02 | DoS (a11y) | `a11y/useFocusTrap.ts` | mitigate | Escape (via `useDialogDismiss`) + focus-restore; cleanup ALWAYS decrements inert + restores focus — `useFocusTrap.ts:74-78` (cleanup runs on unmount) | closed |
| T-08-03 | DoS | `a11y/inertRoot.ts` | mitigate | Ref-counted `inertCount`; only 0↔1 boundary flips native `inert`; underflow-guarded — `inertRoot.ts:29-38` | closed |
| T-08-04 | Error Handling | `components/Sheet.tsx` | mitigate | `if (!open) return null` guard preserved, hooks run before it — `Sheet.tsx:64` (+ `:60-61`) | closed |
| T-08-05 | Tampering | `show/TrailNodeSheet.tsx`, `EndShowDialog.tsx`, `WhyDetail.tsx` | mitigate | Song name in `ariaLabel`/headings as React text — `TrailNodeSheet.tsx:94` (`ariaLabel={entry.songName}`), `:123` (`{entry.songName}`); no `dangerouslySetInnerHTML` | closed |
| T-08-06 | Error Handling | `show/EndShowDialog.tsx`, `TrailNodeSheet.tsx` | mitigate | Closed/empty guard + destructive-confirm gate preserved — `TrailNodeSheet.tsx:39` (`if (!entry) return null`); `EndShowDialog.tsx:78-79` (finalize only on explicit confirm) | closed |
| T-08-07 | Input Validation (V5) | `settings/SettingsView.tsx`, `config.ts` | mitigate | `maxLength={config.dex.OWNER_NAME_MAX_LENGTH}` on both inputs — `SettingsView.tsx:162,296`; `OWNER_NAME_MAX_LENGTH: 40` with schema hard-clamp — `config.ts:328` (comment `:326`, "schema clamp is the security control"). `initialFocusRef` changes focus only | closed |
| T-08-08 | Error Handling | `dex/ShareCardSheet.tsx`, `dex/CompareView.tsx` | mitigate | ShareCardSheet build-failure branch — `ShareCardSheet.tsx:76` (`setStatus("failed")`), `:118` (`status === "failed"` render); CompareView error branch — `CompareView.tsx:75-88` (`stats.error != null`), `:48` (`return null`) | closed |
| T-08-09 | Tampering | `dex/CompareView.tsx`, `dex/ShareCardSheet.tsx` | mitigate | Compare/share song+venue names as React text; no `dangerouslySetInnerHTML` in either file (app-wide grep clean) | closed |
| T-08-10 | DoS (a11y) | `explore/NodeSheet.tsx` | mitigate | Non-modal: `aria-modal={false}` — `NodeSheet.tsx:146`; NO trap/inert/scrim; Escape via `useDialogDismiss(true, onClose)` `:86` + focus-restore `:93-96` so graph+FilterFab stay reachable | closed |
| T-08-11 | Tampering | `explore/NodeSheet.tsx` | mitigate | Focused song name as React text — `NodeSheet.tsx:147` (`aria-label={songName}`), `:168` (`{songName}`); no `dangerouslySetInnerHTML` | closed |
| T-08-12 | Error Handling | `explore/NodeSheet.tsx` | mitigate | Honest-zero render branch — `NodeSheet.tsx:175` (`total === 0 ?` → "No next songs" copy, not an error) | closed |
| T-08-13 | Tampering | `config.ts` (ui.z), `show/FabMenu.tsx`, `dex/RecapView.tsx` | mitigate | Corrected tier order: `content:10 < page:15 < toast:20 < fabScrim:25 < fab:30 < sheetScrim:40 < sheet:50 < focusedFab:60` — `config.ts:215-242`. FabMenu scrim reads `z.fabScrim` (25) < container `z.fab` (30) — `FabMenu.tsx:101,109` (CR-01 fix, commit 700b19e). RecapView at `z.page` (15) < `sheetScrim` (40) — `RecapView.tsx:104,145` (WR-01 fix, commit 2514399) | closed |
| T-08-14 | Error Handling | `show/ShowView.tsx` + z-migrated surfaces | mitigate | Pure `className`→inline `zIndex` swap; render guards untouched — RecapView `return null` guards preserved `:68,75`, "calm empty frame" fallback `:96` | closed |
| T-08-15 | Tampering | `show/orbLabelFit.ts`, `PredictionOrb.tsx`, `CenterNode.tsx` | mitigate | `orbLabelFit.ts` is pure sizing (no `fillText`, no `dangerouslySetInnerHTML`); orb labels stay canvas `fillText` / React text — `PredictionOrb.tsx:63,144,179` render `candidate.songName` via fit + aria-label; retune changed only sizing constants | closed |
| T-08-16 | Information Disclosure | `dev/OrbFitHarness.tsx`, `App.tsx` | accept | Dev-gated route `#/dev/orb-fit` — `App.tsx:47` (`location.hash === "#/dev/orb-fit"`), not in ROUTES allow-list; renders only already-bundled public `@matrix` catalog names — `OrbFitHarness.tsx:1-25`; no secrets | closed |
| T-08-17 | Tampering | planning docs (STATE.md) | accept | Bookkeeping only; no runtime surface (docs-only plan 08-07) | closed |
| T-08-SC | Supply Chain | `package.json`, `package-lock.json` | mitigate | Zero new npm packages: `git diff ec0854a..HEAD` on `packages/app/package.json`, `packages/core/package.json`, root `package.json`, and `package-lock.json` = 0 changed lines each | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-16 | Dev-only orb-fit harness (`#/dev/orb-fit`, throwaway, slated for post-phase removal) renders already-bundled PUBLIC catalog names for on-device legibility verification. Route is hash-gated and outside the ROUTES allow-list; no secrets, no user data, no new attack surface on any production tab. | matt.f.wilson (owner) | 2026-07-18 |
| AR-08-02 | T-08-17 | Plan 08-07 changed planning/bookkeeping docs (STATE.md) only — no runtime code, no rendered surface, nothing reachable by a user or the network. | matt.f.wilson (owner) | 2026-07-18 |
| AR-08-03 | T-08-SC | "No new npm packages" is verified (all manifest + lockfile diffs empty) and accepted as the standing supply-chain posture for this UI-only phase; no third-party code entered the dependency graph. | matt.f.wilson (owner) | 2026-07-18 |

*Accepted risks do not resurface in future audit runs.*

---

## New Attack Surface (SUMMARY `## Threat Flags`)

Only `08-02-SUMMARY.md` contained a `## Threat Flags` section; it declares **None**
("No new network endpoints, auth paths, file access, or schema changes. Song names
continue to render as React text only; no new packages"). The remaining plan
summaries (08-01, 08-03…08-07) declared no new threat surface. **No unregistered
flags** — every flagged item maps to an existing threat ID (T-08-SC, T-08-09, etc.).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-18 | 18 | 18 | 0 | gsd-security-auditor (Claude) |

**Corroboration:** independent code review (`08-REVIEW.md`, 31 files) confirmed no
`dangerouslySetInnerHTML` introduced, `useFocusTrap` inert ref-count balanced across
mount/unmount/early-return, `Sheet` hooks-before-guard, and intact guard branches in
`ShareCardSheet`/`CompareView`. The two layering regressions it caught (CR-01
fabScrim>fab, WR-01 RecapView>ShareCardSheet scrim) were FIXED (commits `700b19e`,
`2514399`) and the corrected `config.ui.z` ordering was independently re-verified
here against source. Review's deferred items (WR-02 `inert` on `display:contents`,
WR-03 false `aria-modal` on unmigrated overlays, IN-01/IN-03) are latent
UI-correctness/scope items, not declared-mitigation gaps for the Phase-08 threat
register, and do not affect any threat's closed status.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-18
