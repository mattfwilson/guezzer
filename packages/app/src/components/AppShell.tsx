import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { BottomTabBar } from "./BottomTabBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-screen flex-col bg-surface text-text-primary">
      <header
        className="flex items-center justify-between border-b border-hairline bg-elevated px-4 py-3"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <span className="text-[20px] font-semibold leading-tight">
          Guezzer
        </span>
        {/* Menu sheet (Install entry, version stamp) arrives in Plan 02/03 — no-op placeholder trigger for now. */}
        <button
          type="button"
          aria-label="Menu"
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
