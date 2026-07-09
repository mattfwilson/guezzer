import { useState } from "react";
import { AppMenu } from "./components/AppMenu";
import { AppShell } from "./components/AppShell";
import { InstallBanner } from "./components/InstallBanner";
import { PlaceholderView } from "./components/PlaceholderView";
import { useHashRoute } from "./routing/useHashRoute";

export function App() {
  const route = useHashRoute();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <AppShell onMenuClick={() => setMenuOpen(true)}>
        <PlaceholderView route={route} />

        {/* Mount seam for a later Phase 3 plan — do not remove:
            - Plan 03: <UpdateToast /> (waiting-service-worker prompt)
            - Plan 04: persistence trigger (navigator.storage.persist() on first run) */}
      </AppShell>

      <InstallBanner />
      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
