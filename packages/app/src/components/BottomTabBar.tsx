import { BookOpen, CalendarDays, Compass, Gamepad2, Map, Music } from "lucide-react";
import { config } from "../config.ts";
import { navigate, useHashRoute, type Route } from "../routing/useHashRoute";

/** The six content routes that own a bottom tab (`settings` has none). */
type TabRoute = Exclude<Route, "settings">;

// NAV-01/NAV-02 (D-43): the labels are DISPLAY strings read from
// `config.copy.tabs` — the route keys, the file path and every persisted key are
// unchanged. D-43's tab-icon note: `BookOpen` beside "Me" is an acknowledged,
// deliberate non-change, reviewed in Phase 24.
const TABS: { route: TabRoute; label: string; Icon: typeof Music }[] = [
  { route: "show", label: config.copy.tabs.show, Icon: Music },
  { route: "explore", label: config.copy.tabs.explore, Icon: Compass },
  { route: "map", label: config.copy.tabs.map, Icon: Map },
  // Schedule tab (2026-07-30): 5→6 tabs accepted by the owner — short labels
  // keep every tab ≥ 44px wide via `flex-1` even at 375px.
  { route: "schedule", label: config.copy.tabs.schedule, Icon: CalendarDays },
  { route: "dex", label: config.copy.tabs.dex, Icon: BookOpen },
  // D-01: GizzGames is the forward-compatible home for future games (Gizzle /
  // Guezz League), so the generic Gamepad2 hub icon — not a bingo-specific glyph.
  // The 3→4 tap-target tightening is accepted; `flex-1` keeps each tab ≥ 44px.
  { route: "games", label: config.copy.tabs.games, Icon: Gamepad2 },
];

export function BottomTabBar() {
  const active = useHashRoute();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-stretch justify-around border-t border-hairline bg-elevated"
      // FOUND-02: both this side and AppShell's <main> read the ONE owner in
      // layout/bottomSpace.ts, so they cannot drift. The home-indicator gutter is
      // subtracted back out as padding, leaving the button area at the bar's height
      // minus its own inset (border-box) — geometrically identical to what shipped.
      // The old comment here claimed a hand-written bar height "matches AppShell's
      // bottom reservation ... no dead gap"; the plan-21-04 measurement proved otherwise
      // (FOUND-01, CONFIRMATION BRANCH: body's bottom inset was double-counted
      // against this bar, leaving a dead gap of exactly one safe-area inset).
      //
      // PHASE-22 SPLIT (CHROME-01, 22-RESEARCH Pitfall 6): through Phase 21 this read
      // `--gz-chrome-reserve`, which was correct while that variable meant "how tall
      // the bar is". It now means "how much bottom space the chrome OCCUPIES" and
      // collapses to a bare safe-area strip when chrome hides. The bar's own box must
      // NOT collapse with it — a squashed box's `translateY(100%)` no longer clears the
      // viewport, leaving a visible sliver that still looks reachable. So the height
      // reads `--gz-tab-bar-box`, which never collapses. Same arithmetic, own name.
      style={{
        height: "var(--gz-tab-bar-box)",
        paddingBottom: "var(--gz-safe-bottom)",
      }}
    >
      {TABS.map(({ route, label, Icon }) => {
        const isActive = active === route;
        return (
          <button
            key={route}
            type="button"
            onClick={() => navigate(route)}
            className={`flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 py-2 ${
              isActive ? "text-accent" : "text-text-muted"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={22} />
            <span className="text-[14px] font-semibold leading-tight">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
