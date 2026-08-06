---
phase: 22-surface-motion-the-chrome-mechanism
plan: 06
subsystem: pwa-install
tags: [install, NAV-05, D-32, D-34, D-35, D-37, useSyncExternalStore, settings]
requires:
  - "packages/app/src/pwa/install/useInstallState.ts (singleton-backed after plan 22-03)"
  - "packages/app/src/config.ts (config.copy.install.*, added in plan 22-01)"
  - "packages/app/src/pwa/bottomOverlayInset.ts (the I-1 store idiom copied)"
provides:
  - "packages/app/src/settings/InstallSection.tsx — the one platform-adaptive install section"
  - "packages/app/src/settings/installSectionFocus.ts — the D-35 deep-link counter store"
  - "requestInstallSectionFocus / subscribeInstallSectionFocus / getInstallSectionFocusSnapshot / getInstallSectionFocusServerSnapshot / __resetInstallSectionFocusForTests"
  - "DOM id #install — the deep-link scroll+focus target on #/settings"
affects:
  - "packages/app/src/components/AppMenu.tsx (gold install CTA + inline iOS steps + fallback removed)"
  - "packages/app/src/components/IosInstallInstructions.tsx (heading now behind showHeading, default true)"
  - "packages/app/src/settings/SettingsView.tsx (new last section + passive focus effect)"
tech-stack:
  added: []
  patterns:
    - "I-1 useSyncExternalStore module registry, snapshot is a plain number (Pitfall 9 cannot apply)"
    - "counter-not-boolean deep-link signal, so a same-hash navigate still re-fires (Pitfall 10)"
    - "passive useEffect for cross-commit focus hand-off from a closing sheet"
key-files:
  created:
    - packages/app/src/settings/InstallSection.tsx
    - packages/app/src/settings/installSectionFocus.ts
    - packages/app/test/installSection.test.tsx
  modified:
    - packages/app/src/settings/SettingsView.tsx
    - packages/app/src/components/AppMenu.tsx
    - packages/app/src/components/IosInstallInstructions.tsx
    - packages/app/src/config.ts
decisions:
  - "D-32 implemented: one Settings section owning one heading, below owner identity / data+export / rotation reset"
  - "D-34 implemented: the menu row and the section share one !isInstalled read from useInstallState()"
  - "D-35 implemented as a counter store, not a consumable boolean — the same-hash navigate case"
  - "IosInstallInstructions keeps its <h2> behind a showHeading prop (default true) because InstallBanner is a second consumer and D-37 freezes it"
  - "config.copy.iosInstall.heading / installCta / installUnavailable all RETAINED — all three still have a live InstallBanner consumer"
metrics:
  duration: ~12 min
  tasks: 3
  files: 7
  completed: 2026-08-06
---

# Phase 22 Plan 06: Relocated Install Affordance Summary

Moved the whole add-to-home-screen path out of the top-right menu into one
platform-adaptive `#install` section at the bottom of Settings, and cut the menu
back to a single neutral row that deep-links there — with a counter-backed focus
signal so the link still works for a user already sitting on `#/settings`.

## What Was Built

### Task 1 — the section and the signal (commit `0f8fa75`)

**`packages/app/src/settings/installSectionFocus.ts`** — a `useSyncExternalStore`
module holding a monotonically incrementing request counter, with
`requestInstallSectionFocus()`, `subscribeInstallSectionFocus()`,
`getInstallSectionFocusSnapshot()`, `getInstallSectionFocusServerSnapshot()` and
`__resetInstallSectionFocusForTests()`. Same shape as `pwa/bottomOverlayInset.ts`.

The doc comment records Pitfall 10 in full: a plain consumable boolean plus a
mount-time effect silently does nothing when the user is already on `#/settings`,
because `navigate()` assigns `location.hash` and assigning the **same** hash
fires no `hashchange`, so `useHashRoute`'s store never notifies and `SettingsView`
never re-renders or remounts. The counter makes each request a genuinely new
value, so the subscriber's effect re-fires regardless of route change. The
snapshot being a **number** also means React 19's uncached-`getSnapshot` loop
(Pitfall 9) cannot apply here at all.

**`packages/app/src/settings/InstallSection.tsx`** — one `<section id="install">`,
one `<h2 tabIndex={-1}>` (the deep-link focus target, carrying the shipped
Settings heading treatment), one muted body paragraph, and a three-way platform
branch:

| Branch | Body |
|---|---|
| `canInstall` | **Neutral** button — the Import block's class string verbatim, `<Smartphone size={18} />` glyph, `onClick={() => void promptInstall()}` |
| `isIos` | `<IosInstallInstructions showHeading={false} />` |
| neither | `config.copy.install.unavailable` paragraph |

Gated on `!isInstalled` — returns `null`, a gate rather than an empty state.
Every rendered string reads from `config.copy.install`. Three pieces of
reasoning are recorded inline so they are not "tidied" later: the button is
neutral because Settings already spends its one accent CTA on Export; the glyph
is `Smartphone` and not `Download` because `Download` is already the Export CTA
icon *in the same view*; and `promptInstall()` is called directly from the click
handler with nothing awaited ahead of it because `prompt()` is gesture-bound on
Chromium (T-22-23).

**`IosInstallInstructions`** gained a `showHeading` prop — see Deviation 1.

### Task 2 — mount it, and cut the menu down (commit `9930e9d`)

**`SettingsView.tsx`** renders `<InstallSection headingRef={installHeadingRef} />`
as the last section of the `max-w-md` column, after the "Backup & data"
`</section>` and before the import-fork sheets (which portal or render nothing,
so it is the last child in the DOM too). It adds no spacing of its own.

The view subscribes to the focus counter and runs a **passive** `useEffect` keyed
on it, skipping the initial `0`:

```
installHeadingRef.current?.scrollIntoView?.({ block: "start" });
installHeadingRef.current?.focus();
```

Passive rather than layout is commented at the call site: `AppMenu` closing
restores focus to the header Menu button at close-**start**, inside the *current*
commit, and this effect runs in a *later* one, so it lands after that restore
instead of being clobbered by it. The `scrollIntoView?.()` optional call is
load-bearing, not decorative — verified directly rather than assumed:

```
$ node -e "…" ; jsdom version: 29.1.1 ; scrollIntoView type: undefined
```

**`AppMenu.tsx`** lost the gold install button, the `isIos &&` inline
`<IosInstallInstructions />` block and the `!canInstall && !isIos &&` fallback
paragraph — three install affordances on a surface that should hold none. One
neutral row replaces them, cloned from the Settings row directly beneath it, with
`<Smartphone size={20} />` and `config.copy.install.menuRow`. Its handler is
`requestInstallSectionFocus(); navigate("settings"); onClose();`. It is gated on
`!isInstalled` from `useInstallState()` — the identical expression
`InstallSection` uses, from the same singleton, so the two cannot disagree. The
now-unused `canInstall` / `promptInstall` / `isIos` destructuring and the
`IosInstallInstructions` import are gone. A comment records that retiring the
accent fill is the point, not incidental tidying.

### Task 3 — `packages/app/test/installSection.test.tsx` (commit `06836d3`)

8 cases, all green (the plan asked for ≥6; the three-way branch got one case per
platform rather than one case with three phases, so each can fail independently):

1. the section is the **last** child of the Settings column, and follows the
   rotation-reset heading in document order (`compareDocumentPosition`);
2. the gate hides `SettingsView`'s `#install` **and** `AppMenu`'s row together,
   and reveals both together — asserted in one body so a one-sided regression
   cannot pass;
3. the row's `className` contains `border border-hairline` and not `bg-accent`;
   clicking it lands `location.hash` on exactly `#/settings` (no fragment —
   T-22-16) and fires `onClose`;
4. iOS branch only — `#install ol` with one `li` per configured step;
5. Android branch only — the synthetic `beforeinstallprompt` is dispatched
   **before** `render()`, which is the late-mount case plan 22-03 exists for;
6. neither branch — the `unavailable` paragraph only;
7. the deep link focuses the `tabIndex="-1"` heading, then **blur and request
   again** with no route change or remount, and focus returns — the assertion a
   one-shot boolean would fail;
8. the iOS branch contributes no second `<h2>` inside `#install`.

Each of 4/5/6 asserts **exclusivity** via a `renderedBranches()` helper returning
the list of present bodies, compared with `toEqual([...])` — not mere presence.
No assertion hardcodes a copy string. The file deliberately does **not** stub
`Element.prototype.scrollIntoView`, and says so in a comment, so a regression of
the optional call surfaces as a failure here instead of being masked.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `IosInstallInstructions` has TWO consumers, not one — deleting its `<h2>` outright would have degraded the D-37-frozen `InstallBanner`**

- **Found during:** Task 1
- **Issue:** The plan's part C states "After part D of Task 2 removes the menu's
  inline copy, this component has exactly **one** consumer, so the move is safe",
  and its acceptance criterion requires the file to contain no `<h2` and no
  reference to `config.copy.iosInstall.heading`. That premise is false.
  `packages/app/src/components/InstallBanner.tsx:111` renders
  `<IosInstallInstructions />` as the **entire body** of its iOS branch and has no
  heading of its own. Deleting the `<h2>` unconditionally would have left the iOS
  install banner as a bare numbered list — "1 Tap the Share button / 2 Choose Add
  to Home Screen / 3 Tap Add" — with no statement of what is being added or why.
  D-37 freezes that banner precisely because it is what walks a new user to the
  relocated section, so silently degrading it would have undercut NAV-05 itself.
  It is also unfixable from the banner side: D-37 forbids editing that file.
- **Fix:** the heading moved behind a `showHeading?: boolean` prop **defaulting to
  `true`** — byte-identical rendering for the untouched `InstallBanner` — and
  `InstallSection` is the single caller that opts out with `showHeading={false}`.
  The `<ol>`'s `mt-2` is applied only when the heading it separates is rendered,
  so the banner is pixel-identical and the section relies on its parent's `gap-2`.
  The reasoning is recorded in the component's doc comment.
- **Files modified:** `packages/app/src/components/IosInstallInstructions.tsx`,
  `packages/app/src/settings/InstallSection.tsx`
- **Commit:** `0f8fa75`
- **Verified:** `installBannerVersion.test.tsx` passes unedited; the D-32
  requirement it protects is still pinned positively by test case 8 (exactly one
  `<h2>` inside `#install` on the iOS branch), which is the property that
  actually matters.

### Config keys retained rather than deleted

**None of the three keys the plan expected to retire could be retired**, all for
the same reason — `InstallBanner` still reads them and D-37 freezes it:

| Key | Live consumer |
|---|---|
| `config.copy.installCta` | `InstallBanner.tsx:130` |
| `config.copy.installUnavailable` | `InstallBanner.tsx:118` |
| `config.copy.iosInstall.heading` | `IosInstallInstructions` on its `showHeading` default path, i.e. `InstallBanner.tsx:111` |

The plan explicitly anticipated the first two ("**leave that key in place** —
D-37 forbids touching the banner", and the matching acceptance criterion "unless
`InstallBanner` still reads one, in which case that key remains and the summary
records why"), so those are in-spec. The third follows from Deviation 1. All
three are also still asserted by `rebrand.test.ts`.

`config.ts`'s Phase-22 comment block was rewritten to say so: the duplication
between `config.copy.install.*` and the three older keys is now documented as
**deliberate and permanent**, not migration debt, with an instruction to edit
both copies if the wording changes. Without that note the next reader would
reasonably delete them and break the banner.

### Additional export

`getInstallSectionFocusServerSnapshot()` is a fifth export beyond the four the
plan's `must_haves.artifacts` lists. React 19 warns "Missing getServerSnapshot,
which is required for server-rendered content" without one, and both shipped
stores in this codebase (`bottomOverlayInset.ts`, `installStore.ts`) provide it.
The four named exports are all present and unchanged in signature.

### Tooling substitutions

**`npx tsc -b` → `npx tsc -b packages/core packages/app`.** The plan's
verification blocks specify a bare `npx tsc -b`, which is **vacuous in this
repo**: there is no root `tsconfig.json`, so the bare form prints `TS5083` and
still exits 0. Every typecheck gate in this plan was run in the explicit form,
which exits 0 for real.

No architectural changes, no checkpoints, no auth gates, no packages installed.

## Verification

| Gate | Result |
|---|---|
| `npx tsc -b packages/core packages/app` | exits 0 |
| `npx vitest run --project @guezzer/app packages/app/test/installSection.test.tsx` | 8 passed |
| `npx vitest run --project @guezzer/app` | 90 files / 724 tests passed |
| `npx vitest run` (whole suite) | **138 files / 1173 tests passed** (base 137 / 1165 — +1 file, +8 tests, zero regressions) |
| `git diff --stat cddcddd HEAD` | exactly the 7 declared files, no deletions |

`packages/app/src/components/InstallBanner.tsx` and `packages/app/index.html` are
**byte-unmodified** — confirmed absent from the diff stat. The `index.html` meta
tags (`apple-mobile-web-app-capable`) remain plan 22-09's, per the plan's scope
note.

Structural checks against the plan's acceptance criteria:

- `AppMenu.tsx`: `bg-accent` ×0, `IosInstallInstructions` ×0,
  `config.copy.install.menuRow` ×1.
- `InstallSection.tsx`: the only double-quoted sentences are in doc comments;
  every rendered string reads from `config.copy.install`.
- `SettingsView.tsx`: the effect is `useEffect`, and the scroll is written
  `scrollIntoView?.(`.

## Success Criteria

- [x] Settings' last section is the platform-adaptive install affordance, in
      Settings' own neutral visual language
- [x] Installing hides both the section and the menu row, through one shared
      `!isInstalled` read
- [x] The menu has one neutral "Add to Home Screen" row, no gold button, no
      inline steps
- [x] Tapping it lands on Settings, scrolls the section into view and moves focus
      to its heading — including when already on `#/settings`

## Known Stubs

None.

## Deferred / Notes for the phase

- The scroll half of the deep link is asserted only as "does not throw" — jsdom
  has no `scrollIntoView`, so that the section actually comes into view on a real
  scrolling viewport is device-UAT territory, not unit-testable here.
- `IosInstallInstructions`' `showHeading={true}` path (the banner) has no
  dedicated case in the new file; it stays covered by the untouched
  `installBannerVersion.test.tsx`.

## Threat Flags

None. No new network endpoint, auth path, file access or schema surface.
T-22-16 is asserted by case 3 (`location.hash === "#/settings"`, no fragment;
`ROUTES` untouched, no fragment parsing added). T-22-17 holds — only fixed
`config.copy.install.*` constants render, as escaped React text, no
`dangerouslySetInnerHTML`. T-22-18 holds — one shared gate plus optional
scroll/focus calls, so an absent target is a silent no-op. T-22-23 holds —
`promptInstall()` is invoked directly from the click handler with nothing
awaited ahead of it.

## Self-Check: PASSED

- FOUND: `packages/app/src/settings/InstallSection.tsx`
- FOUND: `packages/app/src/settings/installSectionFocus.ts`
- FOUND: `packages/app/test/installSection.test.tsx`
- FOUND: commit `0f8fa75`
- FOUND: commit `9930e9d`
- FOUND: commit `06836d3`
