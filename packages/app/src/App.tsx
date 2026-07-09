import { useEffect, useRef, useState } from "react";
import { AppMenu } from "./components/AppMenu";
import { AppShell } from "./components/AppShell";
import { InstallBanner } from "./components/InstallBanner";
import { PlaceholderView } from "./components/PlaceholderView";
import { requestPersistenceOnce } from "./pwa/persist.ts";
import { useHashRoute } from "./routing/useHashRoute";

export function App() {
  const route = useHashRoute();
  const [menuOpen, setMenuOpen] = useState(false);

  // Plan 04 (D-09): request eviction-resistant storage early on first run —
  // on mount AND (idempotently) again on the first user interaction, since
  // some platforms only grant persistence after engagement (RESEARCH Open
  // Question 3). requestPersistenceOnce() is silent-on-denial and never
  // throws, so no UI is involved here.
  const firstInteractionHandled = useRef(false);

  useEffect(() => {
    void requestPersistenceOnce();

    const onFirstInteraction = () => {
      if (firstInteractionHandled.current) return;
      firstInteractionHandled.current = true;
      void requestPersistenceOnce();
      window.removeEventListener("pointerdown", onFirstInteraction);
    };
    window.addEventListener("pointerdown", onFirstInteraction, {
      once: true,
    });
    return () => window.removeEventListener("pointerdown", onFirstInteraction);
  }, []);

  return (
    <>
      <AppShell onMenuClick={() => setMenuOpen(true)}>
        <PlaceholderView route={route} />

        {/* Mount seam for a later Phase 3 plan — do not remove:
            - Plan 03: <UpdateToast /> (waiting-service-worker prompt) */}
      </AppShell>

      <InstallBanner />
      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
