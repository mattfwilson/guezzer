---
phase: 22
phase_name: surface-motion-the-chrome-mechanism
audit_date: 2026-08-09
mode: verify-only
register_authored_at_plan_time: true
asvs_level: default
threats_total: 37
threats_closed: 37
threats_open: 0
threats_partial: 1        # T-22-23 — source control present, Android device half unverified
accepted_with_finding: 1  # T-22-34 — accepted premise empirically violated
unregistered_flags: 0
blockers: 0
---

# Phase 22 — Security Audit

**Verdict: SECURED.** All 37 registered threats resolve. 29 `mitigate` controls were located in
shipped source at a named file:line and, where a test was the declared control, that test was
executed and passes. 8 `accept` dispositions were re-checked against shipped code rather than
against their plan text; 7 hold unchanged, 1 (**T-22-34**) has an empirically violated premise and
is recorded below as an accepted risk **with a new mandatory teardown control**.

Two items are explicitly **not** closed by assumption and are called out rather than buried:

- **T-22-23 (Android half)** — the source-shape control is present and correct, but the device
  confirmation that would prove it is `BLOCKED` (no Android hardware). See §Verification Gaps.
- **T-22-34** — disposition stays `accept` per owner decision, but the "ephemeral, closed at the
  end of the session" premise was **falsified during this session's UAT and again at audit time**.

## Method

- Threat register taken from the `<threat_model>` block of all ten `22-NN-PLAN.md` files
  (37 unique IDs; no T-22-19 was ever issued).
- **Executor self-reports were not accepted as evidence.** All ten `22-NN-SUMMARY.md` files report
  `## Threat Flags: None`; every one of those claims was re-derived from source. No summary claim
  was found to contradict the code.
- Where a declared control is "asserted by test", the test file was read AND run.
  `npx vitest run` over the 13 phase-relevant files: **13 files / 171 tests, all passing.**
- `mitigate` controls were located by grep in the file named by the mitigation plan, not inferred
  from structure.

## Threat Verification — MITIGATE (29)

| Threat ID | Category | Evidence (file:line) | Status |
|-----------|----------|----------------------|--------|
| T-22-01 | DoS | `components/Sheet.tsx:153-157` — `useFocusTrap({active: open && modal})` + `useDialogDismiss(open, onClose)` still driven by `open`, not presence; V7 guard survives as the emptiness expression at `Sheet.tsx:174`. Gate holds: commit `6bc328f` (the 22-01 restructure) touched `Sheet.tsx`, `WaveToast.tsx`, `layerOrder.test.tsx` and **not** `sheet.a11y.test.tsx` — the "byte-unmodified" claim is a verified fact. Cases: `test/sheet.a11y.test.tsx:87` (V7), `:112` (Escape), `:125` (focus restore) | CLOSED |
| T-22-03 | DoS | `components/a11y/useFocusTrap.ts:84` (`releasedRef` seeded `true`), `:108` (cleared on activate), `:144-145` (destroy early-returns when already released). Stacked-modal bottom-close case: `test/sheet.a11y.test.tsx:310` — asserts `#app-content.inert === true` after the BOTTOM sheet closes with the top still open | CLOSED |
| T-22-04 | EoP | All three barriers derive from `useIsPresent()` at `Sheet.tsx:239` → `:324` `closingAriaHidden`, `:325` `closingPointerEvents`; applied at `:376` (scrim PE), `:390` (scrim `onClick={isPresent ? onClose : undefined}`), `:399` (card `aria-hidden`), `:419` (card PE). WR-08 split means each half has exactly one consumer. Asserted anti-vacuity-first at `test/sheet.closeStart.test.tsx:117-135`; re-asserted per surface at `test/trailNodeSheet.test.tsx:228-233` | CLOSED |
| T-22-05 | DoS (venue) | Commit half: the six-part D-20 assertion at `test/sheet.closeStart.test.tsx:92-148`. Device half: `22-HUMAN-UAT.md` test 2 — **PASS 2026-08-09**, background control fired on all four surfaces while the sheet was still on screen | CLOSED |
| T-22-07 | DoS | `pwa/install/installStore.ts:69` and `:70` — `typeof window === "undefined"` guards on both platform reads; `:172` guards the listener registration; `:158` `promptInstall()` returns silently with nothing captured. Case 6: `test/installStore.test.tsx:158` | CLOSED |
| T-22-09 | DoS | `dex/SetlistView.tsx:251-258` `role="dialog"` for the unresolvable state; `:263-271` visible `min-h-11 min-w-11` Back wired to `onClose`; `:184-185` `useDialogDismiss(missing, onClose)`. WR-01 additionally makes the `aria-modal="true"` honest (`:187-226` focus containment) | CLOSED |
| T-22-10 | XSS | `dex/SetlistView.tsx:255,279,282` — only `copy.setlistMissingHeading` / `copy.setlistMissingBody`. No `cacheRow` interpolation anywhere in the `resolved == null` branch (`:228-288`). Repo-wide: **zero live `dangerouslySetInnerHTML` call sites** in `packages/app/src` (all 24 matches are comments) | CLOSED |
| T-22-11 | ASVS V7 | `dex/SetlistView.tsx:246-250` + `:277-284` — no Dexie error object, no stack, no exception message reaches the DOM; the branch renders a heading and a body constant only | CLOSED |
| T-22-12 | DoS (phase worst case) | Five independent outs, all located: (1) non-persisted module state — `layout/chromeVisibility.ts` contains no Web Storage / IDB / Dexie call of any kind (grep clean), so a reload restores `visible = true` at `:44`; (2) `registerChromeToggle`'s unregister forces `visible = true` unconditionally when the count reaches 0; (3) always-rendered ≥44px control at a fixed viewport pixel — `explore/ChromeToggle.tsx:122-143`, `position: "fixed"` at `:132`, `CHROME_TOGGLE_SIZE_PX: 44` (`config.ts:428`) plus `min-h-11 min-w-11`; (4) first in tab order while hidden — `test/chromeToggle.test.tsx:495` asserts index 0 of the non-inert focusables with no positive `tabIndex`; (5) Escape via the shared LIFO — `ChromeToggle.tsx:115`, asserted `test/chromeToggle.test.tsx:519`. Unregister-restores also asserted `:290` | CLOSED (see residual R-1) |
| T-22-13 | EoP | Header: `components/AppShell.tsx:135` `inert={!chromeVisible}`, `:136` `aria-hidden`, `:154` `pointerEvents: "none"`. Tab bar: `components/BottomTabBar.tsx:52`, `:53`, `:75`. All three together, never one alone. Asserted `test/chromeToggle.test.tsx:201` | CLOSED |
| T-22-14 | DoS (battery) | Only `transform` animates: `AppShell.tsx:158` `animate={{ y: … }}`, `BottomTabBar.tsx:77` same. Box collapse is one custom-property write (`layout/bottomSpace.ts`, `--gz-chrome-reserve` swapped between `var(--gz-tab-bar-box)` and `var(--gz-safe-bottom)`). `test/chromeResize.test.tsx:157` asserts exactly one `--gz-chrome-reserve` `setProperty` per toggle, `:181` asserts `zoomToFit` not re-called, `:229` reinforces with a `MutationObserver` distinct-value count | CLOSED (see residual R-2) |
| T-22-15 | Tampering | `AppShell.tsx:104-113` records the rule and `:135` implements it — the React 19 JSX `inert` prop. `setRootInert` is **not imported or called** in `AppShell.tsx` or `BottomTabBar.tsx` (grep: only the two explanatory comment mentions). The shared count in `components/a11y/inertRoot.ts:21` is untouched by the chrome lifetime | CLOSED |
| T-22-16 | Tampering | `routing/useHashRoute.ts` is **absent from the entire phase diff** (`git diff e9c97d1^..HEAD --name-only`) — the `ROUTES` allow-list at `:9` and the `isRoute` membership check at `:21` are byte-unchanged. `components/AppMenu.tsx:43-44` signals then calls `navigate("settings")`; no fragment is constructed or parsed. Asserted `test/installSection.test.tsx:161-163` (`location.hash === "#/settings"`, no fragment) | CLOSED |
| T-22-17 | XSS | `settings/InstallSection.tsx` renders `copy.sectionHeading`, `copy.sectionBody`, `copy.androidCta`, `copy.unavailable` — all `config.copy.install.*` constants as escaped React text. No Dexie/imported-file/peer value, no `dangerouslySetInnerHTML` | CLOSED |
| T-22-18 | DoS | One shared gate: `components/AppMenu.tsx:74` `{!isInstalled && (` and `settings/InstallSection.tsx` `if (isInstalled) return null;` — both read `isInstalled` from the same `useInstallState()` store, so they cannot disagree. Absent-target no-op: `settings/SettingsView.tsx:100` `installHeadingRef.current?.scrollIntoView?.({…})` and `:101` `installHeadingRef.current?.focus()` | CLOSED |
| T-22-21 | DoS | `Sheet.tsx:269-275` — `setTimeout(…, config.ui.motion.SHEET_DURATION_MS)` calling `focusInitialTarget()` behind an `isPresentRef` guard; cleared by `clearFocusFallback` in the effect teardown and by `onCardAnimationComplete` at `:281-284`, whichever fires first. Asserted `test/sheet.closeStart.test.tsx:214` | CLOSED |
| T-22-23 | DoS | Source control present at **both** call sites. `pwa/install/installStore.ts:156-161` — `const d = deferred; if (!d) return; deferred = null;` are all synchronous, so `await d.prompt()` at `:161` remains the first awaited expression (the CR-02 fix explicitly preserved this). `settings/InstallSection.tsx` — `onClick={() => void promptInstall()}`, nothing awaited ahead of it | CLOSED (source) — **device half UNVERIFIED**, see §Verification Gaps |
| T-22-24 | DoS | `AppShell.tsx:271-273` — `<main>` takes `paddingTop: "calc(env(safe-area-inset-top))"` exactly while the chrome is hidden, in the same commit as the reserve collapse. The `calc()` wrapper is load-bearing (jsdom drops a bare `env()`), which is what keeps the assertion non-vacuous. Asserted `test/chromeToggle.test.tsx:257`; device-confirmed `22-HUMAN-UAT.md` test 5 **PASS**, portrait AND landscape | CLOSED |
| T-22-25 | EoP | `explore/ChromeToggle.tsx:137` `zIndex: config.ui.z.fab` as an **inline** style (no Tailwind `z-*`); `config.ts:290` `chrome: 14` vs `fab: 30`. Named guard: `test/layerOrder.test.tsx:823` — `"Phase-22 CHROME-03: chrome < fab — the escape control is never covered"`. Phase-21 D-28 respected: `ChromeToggle.tsx:139` uses solid `bg-elevated`; **no `backdrop-blur` in the file** (the only match is the prohibition comment at `:45`) | CLOSED |
| T-22-26 | Tampering | `explore/ChromeToggle.tsx:115` — `useDialogDismiss(!chromeVisible, showChrome)`; the hook is inactive in the visible state, so the toggle contributes nothing to the LIFO stack. Both halves asserted `test/chromeToggle.test.tsx:519` (restores from hidden; no-op, never an error, while visible) | CLOSED |
| T-22-27 | DoS (sacred D-17) | `pwa/bottomOverlayInset.ts:124` `offsetBelow(id)` + `:201` `useBottomOverlayOffset(id)` — overlays stack. `--gz-content-reserve` composition unchanged; `test/bottomOverlayInset.test.tsx:274` asserts `<main>`'s reserve equals the REAL occupied height once two overlays stack (not the double-count), plus `:255`, `:296`, `:377` | CLOSED |
| T-22-28 | DoS | `config.ts:448-454` — `BOTTOM_OVERLAY_ORDER = ["installBanner", "updateToast", "backupToast", "bingoCelebration", "waveToast"]`: `updateToast` is second from the bottom, directly above the persistent `installBanner` and beneath every transient toast. Rationale recorded at `config.ts:433-447`. Asserted `test/bottomOverlayInset.test.tsx:255` | CLOSED |
| T-22-29 | Tampering | `test/bottomOverlayInset.test.tsx:649` — the anti-vacuity case runs FIRST (`files.length > 100`, `ids.length >= 5`, every known id present), then `:670` asserts every `useBottomOverlayHeightRegistration` id found in `src/` is declared in `BOTTOM_OVERLAY_ORDER`, then `:688` the reverse direction. A broken extraction cannot make this silently green | CLOSED |
| T-22-30 | DoS (render loop) | `pwa/bottomOverlayInset.ts:159` — `if (heights.get(id) === rounded) return;` unchanged-value early return preserved. Every hook returns a **number**: `:171` `getSnapshot(): number`, `:201-206` `useBottomOverlayOffset(id): number` reading the cached `offsets` map. Asserted `test/bottomOverlayInset.test.tsx:351` (referential stability between notifies) | CLOSED |
| T-22-31 | ASVS V14 (config) | Commit `04b3bc1` verified in isolation: **1 file changed, 24 insertions, 0 deletions**, all in `packages/app/index.html` — two `<meta>` tags plus an explanatory comment. No CSP directive exists in `index.html` to alter; `vite.config.ts` (SW scope, `start_url`, `display`) is **absent from the entire phase diff**. Device-gated: `22-HUMAN-UAT.md` test 0 **PASS** — BEFORE/AFTER readings identical (`sab 34 / sat 62 / innerH 812`), so `black-translucent` activation did not move where content begins. Revert procedure 2 never triggered | CLOSED |
| T-22-32 | DoS (false evidence) | `22-HUMAN-UAT.md:155-157` — test 0 is stated as a precondition gating all SHEET-02 and NAV-06 evidence. `:158-163` names the iOS tell (`sab: 0` / `nav=false mq=false` = bookmark) and `:165-169` names the Android tells **separately** (`matchMedia("(display-mode: standalone)")` **plus** `beforeinstallprompt` having fired), with the Phase-21 session loss stated inline so the reason survives. Result recorded PASS with both readings tabulated | CLOSED |
| T-22-33 | DoS (at a venue) | Tests 1 and 2 marked blocking and **both PASS** (`22-HUMAN-UAT.md:281` — 8/8 across 4 surfaces × VoiceOver + external keyboard; `:333` — real close-start touch on all four). Fallback is a fact, not a claim: `22-09-SUMMARY.md:86` records the three-step revert executed end-to-end on a scratch branch — `npx vitest run` **EXIT 0** (139 files / 1196 tests) and `tsc -b` **EXIT 0**. No feature flag exists to rot — `Sheet.tsx:52-53` states it and no runtime gate appears in the file | CLOSED |
| T-22-35 | DoS (red build) | Commit `53d6e59` verified atomic: `Sheet.tsx` (+92) **and** `test/sheet.closeStart.test.tsx` (+291) **and** `test/sheet.motion.test.tsx` (+61) in one commit — one `git revert` takes the implementation and its assertions together. The three out-of-commit blocks all exist and all carry the exact title the revert procedure deletes: `test/dexView.test.tsx:367` `"fullscreen sheet exit window (reverts with the 22-02 exit commit)"`, `test/trailNodeSheet.test.tsx:200` and `test/songRow.test.tsx:157` `"bottom-sheet exit window (reverts with the 22-02 exit commit)"`. Named in `22-09-SUMMARY.md:102-103` as revert steps (b) and (c) | CLOSED |
| T-22-37 | DoS | `show/TrailNodeSheet.tsx:61-63` — `lastEntryRef` assigned **during render** (`if (entry) lastEntryRef.current = entry;`), `shown = entry ?? lastEntryRef.current`; guarded at `:136` (`ariaLabel={shown?.songName ?? ""}`) and `:138` (`{shown != null && …}`). Same shape in the second converted surface: `show/WhyDetail.tsx:50-52`, `:71`, `:73`. Asserted `test/trailNodeSheet.test.tsx:203` (zero DOM nodes when never opened) and `:243` (null-entry render does not throw); mirrored `test/songRow.test.tsx:160`, `:195` | CLOSED |

## Threat Verification — ACCEPT (8)

| Threat ID | Category | Re-check against shipped code | Status |
|-----------|----------|-------------------------------|--------|
| T-22-02 | XSS | Holds. Every new `config.copy.install.*` / `config.copy.dex.setlist*` constant reaches the DOM as escaped React text. Repo-wide grep confirms **zero live `dangerouslySetInnerHTML` call sites** in `packages/app/src` | CLOSED |
| T-22-06 | Tampering | Holds. `pwa/install/installStore.ts` touches exactly two members of the UA event — `d.prompt()` (`:161`) and `d.userChoice` (`:162`) — plus `event.preventDefault()` at `:174`. No field of either event is read, rendered, persisted or parsed; the only thing that escapes is the boolean triple at `:98-102` | CLOSED |
| T-22-08 | InfoDisc | Holds. `installStore.ts:80-84` is a three-boolean object; `:51` holds the event handle. Grep for `localStorage` / `sessionStorage` / `indexedDB` / Dexie in the file returns **only a comment**. Nothing persisted | CLOSED |
| T-22-20 | EoP | **Re-verified after the 22-04 and 22-10 conversions, as required.** A structural scan of every `<Sheet …>…</Sheet>` block in `packages/app/src` found **zero** `position: fixed` descendants — no literal `fixed` class and no fixed-rendering child component. The two components that could have introduced one do not: `SearchSheet` (`fixed inset-0`) is reached by an **early return that replaces the whole surface**, never as a Sheet child (`TrailNodeSheet.tsx:111-120`, `CatchUpSheet.tsx:148-157`); `AlbumDetail`, `ArchiveBrowser` and `SetlistView` each `createPortal(…, document.body)`, so their DOM ancestor is `<body>`, not the animating card. The forward-looking constraint is recorded at `Sheet.tsx:93-98` note (d) | CLOSED |
| T-22-22 | DoS | Holds and is now observable. The retained fullscreen card takes `aria-hidden` (`Sheet.tsx:399`) and `pointer-events: none` (`:419`) from close-start — both barriers apply to the `fullscreen` variant, which has no scrim of its own. Asserted `test/dexView.test.tsx:393` (`"retains the dialog node, aria-hidden, for the exit window after close"`) | CLOSED |
| T-22-34 | InfoDisc | **Disposition stays `accept`; the accepted PREMISE is falsified.** See §Finding F-1 below | ACCEPTED WITH FINDING |
| T-22-36 | Tampering (wrong row) | Holds, and the residual design rule is enforced in source. `show/TrailNodeSheet.tsx:86-94` `handlePick` and `:97-100` `handleDelete` both read the **`entry` prop** under an `entry != null && entry.id != null` guard. `lastEntryRef.current` / `shown` are read **only in the render body** (`:63`, `:136`, `:138`, `:166`, `:177`, `:191`). The mechanism is documented at the two handler sites (`:80-85`, `:96`), so the unsafe edit cannot be made by accident | CLOSED |
| T-22-SC | Tampering (supply chain) | **Zero packages installed this phase, verified by diff, not by claim.** `git diff e9c97d1^..HEAD -- '**/package.json' 'package.json' 'package-lock.json' 'pnpm-lock.yaml'` returns **empty**. The full phase file list contains no manifest or lockfile. `Smartphone` (`lucide-react`) and `cloudflared` are pre-existing | CLOSED |

## Findings

### F-1 — T-22-34: the accepted premise is empirically false, and still false right now

**Disposition unchanged: `accept`.** The impact assessment holds — no secret is in the bundle, all
`VITE_*` values are public by construction, and the tunnel serves the same static `dist/` that
deploys publicly. **The premise does not hold.**

`22-09-PLAN.md`'s register accepts the exposure because the tunnel is *"ephemeral … and closed at
the end of the session."* During this session's UAT that was found to be false in practice:
stopping the backgrounded task kills the **shell wrapper**, not the process. `cloudflared.exe`
survives — and so does `vite preview`, which keeps holding its port. Two tunnels started
2026-08-07 were still alive on 2026-08-09 with their preview servers behind them: a
publicly-reachable HTTPS tunnel to a local build, unattended, for roughly two days.

**Confirmed live at audit time.** `tasklist` during this audit shows one orphaned process still
running: `cloudflared.exe`, PID **8940**, ~50 MB RSS. No preview port was found listening, so this
particular orphan is a tunnel with nothing behind it — which is the second symptom, not an
all-clear: **accumulated orphans silently break NEW tunnels.** They register successfully
(`Registered tunnel connection`, precheck all PASS) and print a URL, but every request returns
`curl 000`. That failure already cost time in this session's UAT (`22-HUMAN-UAT.md:83`).

**Mandatory control, replacing the false premise.** Trusting that stopping the task stopped the
tunnel is not a teardown. The teardown is:

```powershell
# At the END of every device-UAT session — verify, do not assume.
Get-Process cloudflared -ErrorAction SilentlyContinue   # MUST return nothing
Get-Process node -ErrorAction SilentlyContinue |        # vite preview holds its port too
  Where-Object { $_.Path -like '*node*' }
# If anything is returned:
Stop-Process -Name cloudflared -Force
netstat -ano | Select-String 'LISTENING' | Select-String ':4173|:5173'
```

Residual risk if skipped: a public HTTPS entry point to a developer machine's local build stays
open indefinitely, and the next session's tunnel silently fails in a way that looks like a
network problem. **Action for the current machine: PID 8940 should be terminated.**

## Residual Risks (accepted, non-blocking)

| ID | Threat | Residual | Owner |
|----|--------|----------|-------|
| R-1 | T-22-12 | `setChromeVisible(false)` has an **unenforced precondition**: calling it while `toggleCount === 0` would produce a chrome-hidden state with no escape control, no Escape handler and no route-change reset. Recorded at the setter (`layout/chromeVisibility.ts`, WR-04 block). **Not reachable today** — `ChromeToggle` is the sole caller and registers on mount before any click can reach the setter, so escapability holds by **co-location, not by construction**. A guard was deliberately not added because Phase 23's specified consumer is button-less (D-03) | Phase 23 |
| R-2 | T-22-14 | The declared control (one reserve write, `zoomToFit` not re-called, transform-only animation) is fully present and verified four ways — the streaming-`ResizeObserver`-for-200ms failure mode the threat describes **is** prevented. Separately, `explore/ConstellationCanvas.tsx:249` calls `fg.d3ReheatSimulation()` unconditionally on a `size.height` change, so a chrome toggle does trigger **one** reheat. It is argued inert (`fx`/`fy` pinned at `onEngineStop`, `firstSettleRef` gates the camera) and that argument was independently confirmed. This is a **requirements-reconciliation gap** already recorded in `22-VERIFICATION.md` (SC3/CHROME-05, inert-not-absent, no override), not a threat gap — noted here only because it touches T-22-14's subject matter | already tracked in 22-VERIFICATION.md |

## Verification Gaps — could NOT be verified, stated rather than assumed

| Item | What is verified | What is NOT | Why |
|------|------------------|-------------|-----|
| **T-22-23 (Android half)** | The source-shape control at both call sites: `installStore.ts:156-161` keeps `await d.prompt()` as the first awaited expression, and `InstallSection.tsx` invokes `promptInstall()` directly from the click handler. `test/installStore.test.tsx` covers the no-op, rejection and double-tap paths | That a real Chromium user gesture actually produces the native install dialog from the relocated Settings affordance | `22-HUMAN-UAT.md` test 4 (NAV-06) is **BLOCKED — no Android device this session**. `beforeinstallprompt` is Chromium-only, so iOS cannot substitute. **There is also no automated source guard** pinning "no `await` before `prompt()`" — the rule is held by an acceptance criterion and two comments. A future refactor could reintroduce a preceding `await` and the whole suite would stay green while the install path silently died |
| Real-pointer effect of `pointer-events: none` (T-22-04 / T-22-22 / T-22-36) | Barrier **presence** in jsdom (`fireEvent` bypasses `pointer-events`, so only the dropped-handler half is provable there) | Nothing further needed — barrier **effect** was device-confirmed by `22-HUMAN-UAT.md` test 2 (PASS, all four surfaces) | Documented limitation, closed on device |

## Unregistered Flags

**None.** All ten `22-NN-SUMMARY.md` files declare `## Threat Flags: None`. Those declarations
were not taken on trust — the phase's complete source diff (`git diff e9c97d1^..HEAD`, 33 source
and test files under `packages/app/`) was reviewed for new attack surface. No network endpoint, no
auth path, no persistence, no file access, no schema change and no dependency was introduced. The
one genuinely new browser-tier surface (the `appinstalled` listener, `installStore.ts:188-192`) is
already covered by T-22-06's `accept` disposition — it carries no payload and nothing from it
reaches the DOM, Dexie or Supabase. Every new module (`chromeVisibility.ts`,
`installSectionFocus.ts`, `installStore.ts`) is module-scoped state with a `useSyncExternalStore`
interface and no storage API.

## Test Evidence

`npx vitest run` over the 13 files carrying the declared assertions:

```
Test Files  13 passed (13)
     Tests  171 passed (171)
```

Files: `sheet.a11y`, `sheet.closeStart`, `sheet.motion`, `chromeResize`, `chromeToggle`,
`layerOrder`, `trailNodeSheet`, `songRow`, `dexView`, `installSection`, `installStore`,
`setlistView`, `bottomOverlayInset`.

## Accepted Risks Log

| Threat ID | Risk | Rationale | Control |
|-----------|------|-----------|---------|
| T-22-02 | New copy constants as an XSS vector | Escaped React text only; no `dangerouslySetInnerHTML` anywhere in `src` | Standing T-08-01 rule; verified by repo-wide grep |
| T-22-06 | Forged `beforeinstallprompt` / `appinstalled` | Both UA-owned; a forged event could at most show a dead button or hide the install section. No privilege boundary, no backend to mislead | Only `prompt()` / `userChoice` touched; nothing reaches DOM/Dexie/Supabase |
| T-22-08 | Install store information disclosure | Boolean triple + a UA event handle; nothing persisted | D-11 no-persistence rule; verified by grep |
| T-22-20 | `position: fixed` descendant re-anchoring to the animating card | Present exposure is **zero** — verified by structural scan after the 22-04/22-10 conversions | Forward-looking constraint documented at `Sheet.tsx:93-98`; re-run the scan whenever a new `<Sheet>` consumer lands |
| T-22-22 | Trophy-case node retained ~200ms after close | `aria-hidden` + `pointer-events: none` from close-start, removed at exit end | `Sheet.tsx:399`/`:419`; asserted `dexView.test.tsx:393` |
| **T-22-34** | **cloudflared tunnel exposing a local build** | Impact genuinely low — no secret in the bundle, all `VITE_*` public by construction, same bundle deploys publicly. **BUT the "ephemeral / closed at session end" premise is FALSE** (see §F-1) | **NEW MANDATORY CONTROL: verify `Get-Process cloudflared` returns nothing at teardown.** Do not trust that stopping the background task stopped the tunnel |
| T-22-36 | Wrong-row Dexie write from the retained exiting subtree | Not reachable — `AnimatePresence` retains the element captured at the last present render with frozen closures, so a handler can only write the row the sheet was opened on | Source rule enforced and documented: handlers read the `entry` prop, never `lastEntryRef` (`TrailNodeSheet.tsx:80-100`) |
| T-22-SC | Supply chain | Zero packages installed | Verified by diff over the full phase range |
