import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { BottomTabBar } from "./BottomTabBar";
import { IdentityAvatar } from "../auth/IdentityAvatar.tsx";
import { useBottomSpaceVars } from "../layout/bottomSpace.ts";
import { useChromeVisible } from "../layout/chromeVisibility.ts";

export function AppShell({
  children,
  onMenuClick,
  scroll = true,
}: {
  children: ReactNode;
  onMenuClick?: () => void;
  /**
   * RESEARCH Pitfall 5 seam: the orbit stage must NOT scroll/rubber-band
   * (SHOW-13). `#/show` passes `scroll={false}` so `<main>` becomes a
   * non-scrolling full-height flex column and the OrbitStage (a `flex-1`
   * child) fills it without overflow. Other routes keep the scrolling `<main>`.
   */
  scroll?: boolean;
}) {
  // Bug fix (debug session: start-show-not-clickable) — this hook writes the
  // `--gz-*` bottom-space ladder (layout/bottomSpace.ts, the FOUND-02 single
  // owner) onto document.documentElement. <main> reserves `--gz-content-reserve`
  // on scrolling routes, and that composition already folds in whatever height
  // any OTHER fixed-bottom overlay (InstallBanner, UpdateToast) is really
  // rendering at right now, so <main>'s content is never covered/untappable
  // underneath one of those overlays. See pwa/bottomOverlayInset.ts — that
  // module still does the measuring; useBottomSpaceVars() now consumes it in
  // this component's place.
  //
  // Phase-22 D-12/CHROME-01: the Phase-21 D-16 `chromeVisible` seam is now a REAL
  // input, read from the shared store in layout/chromeVisibility.ts. ONE read, ONE
  // commit — the `setProperty` calls below land in the same React commit as every
  // other part of the collapse, which is what makes CHROME-05's "exactly one resize"
  // true by construction rather than by debouncing.
  const chromeVisible = useChromeVisible();
  useBottomSpaceVars(chromeVisible);

  // Bug fix (debug session: start-show-not-clickable) — height is `h-full`
  // ONLY, never `min-h-screen`. The `html/body/#root { height:100% }` chain
  // (styles.css) grounds `h-full` to the real VISIBLE viewport (the bottom
  // safe-area inset is now reserved by `--gz-content-reserve` /
  // `--gz-chrome-reserve` on <main>, not by body padding — Phase-21 FOUND-01
  // deleted that body-level declaration). `min-h-screen` (=100vh) is the iOS
  // trap: on mobile Safari 100vh is the LARGE viewport (toolbars hidden), so it
  // forced this column taller than the visible screen — vertically-centered
  // content (PreShowLauncher's Start Show button) then centered against a box
  // extending below the fold, landing it low, under the fixed InstallBanner,
  // which intercepted the tap. Desktop was unaffected (100vh == visible there).
  return (
    <div className="flex h-full flex-col bg-surface text-text-primary">
      <header
        className="flex items-center justify-between border-b border-hairline bg-elevated px-4 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <span className="text-[20px] font-semibold leading-tight">
          Gizz With Friends
        </span>
        {/* Identity + menu chrome. IdentityAvatar self-sources the current
            identity (renders nothing signed out) — no prop threading. */}
        <div className="flex items-center gap-1">
          <IdentityAvatar />
          <button
            type="button"
            aria-label="Menu"
            onClick={onMenuClick}
            className="flex min-h-11 min-w-11 items-center justify-center text-text-muted"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      <main
        className={
          scroll
            ? "flex-1 overflow-y-auto"
            : "flex min-h-0 flex-1 flex-col overflow-hidden"
        }
        style={{
          // Scrolling routes RESERVE space for the transient fixed-bottom overlays
          // (InstallBanner/UpdateToast) so their content is never covered/untappable.
          // Non-scrolling routes (the orbit stage, the constellation) instead let
          // those overlays FLOAT over the bottom edge — reserving the inset here would
          // permanently squish a `flex-1` full-height stage every time a transient
          // banner appears. Only the static tab-bar height is reserved for them.
          // D-02: this divergence is deliberate and preserved. The two values are no
          // longer two hand-written strings but the owner's two NAMED compositions —
          // `--gz-content-reserve` (chrome + the measured overlay inset) and
          // `--gz-chrome-reserve` (chrome alone). See layout/bottomSpace.ts; they must
          // not be collapsed into one value.
          paddingBottom: scroll
            ? "var(--gz-content-reserve)"
            : "var(--gz-chrome-reserve)",
        }}
      >
        {children}
      </main>

      <BottomTabBar />
    </div>
  );
}
