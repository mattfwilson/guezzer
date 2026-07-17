import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { BottomTabBar } from "./BottomTabBar";
import { useBottomOverlayInset } from "../pwa/bottomOverlayInset";

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
  // Bug fix (debug session: start-show-not-clickable) — the base 4rem here
  // matches the fixed BottomTabBar; `overlayInset` adds whatever height any
  // OTHER fixed-bottom overlay (InstallBanner, UpdateToast) is really
  // rendering at right now, so <main>'s content is never covered/untappable
  // underneath one of those overlays. See pwa/bottomOverlayInset.ts.
  const overlayInset = useBottomOverlayInset();

  // Bug fix (debug session: start-show-not-clickable) — height is `h-full`
  // ONLY, never `min-h-screen`. The `html/body/#root { height:100% }` chain
  // (styles.css) grounds `h-full` to the real VISIBLE viewport (and it already
  // respects body's safe-area padding). `min-h-screen` (=100vh) is the iOS
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
          Guezzer
        </span>
        <button
          type="button"
          aria-label="Menu"
          onClick={onMenuClick}
          className="flex min-h-11 min-w-11 items-center justify-center text-text-muted"
        >
          <Menu size={22} />
        </button>
      </header>

      <main
        className={
          scroll
            ? "flex-1 overflow-y-auto"
            : "flex min-h-0 flex-1 flex-col overflow-hidden"
        }
        style={{
          paddingBottom: `calc(4rem + env(safe-area-inset-bottom) + ${overlayInset}px)`,
        }}
      >
        {children}
      </main>

      <BottomTabBar />
    </div>
  );
}
