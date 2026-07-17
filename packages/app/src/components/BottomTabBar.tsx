import { BookOpen, Compass, Music } from "lucide-react";
import { navigate, useHashRoute, type Route } from "../routing/useHashRoute";

const TABS: { route: Route; label: string; Icon: typeof Music }[] = [
  { route: "show", label: "LiveGizz", Icon: Music },
  { route: "explore", label: "GizzVerse", Icon: Compass },
  { route: "dex", label: "GizzDex", Icon: BookOpen },
];

export function BottomTabBar() {
  const active = useHashRoute();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-stretch justify-around border-t border-hairline bg-elevated"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
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
