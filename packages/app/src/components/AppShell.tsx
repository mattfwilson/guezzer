import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { BottomTabBar } from "./BottomTabBar";

export function AppShell({
  children,
  onMenuClick,
}: {
  children: ReactNode;
  onMenuClick?: () => void;
}) {
  return (
    <div className="flex h-full min-h-screen flex-col bg-surface text-text-primary">
      <header
        className="flex items-center justify-between border-b border-hairline bg-elevated px-4 py-3"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
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

      <main className="flex-1 overflow-y-auto pb-16">{children}</main>

      <BottomTabBar />
    </div>
  );
}
