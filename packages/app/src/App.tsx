import { AppShell } from "./components/AppShell";
import { PlaceholderView } from "./components/PlaceholderView";
import { useHashRoute } from "./routing/useHashRoute";

export function App() {
  const route = useHashRoute();

  return (
    <AppShell>
      <PlaceholderView route={route} />

      {/* Mount seams for later Phase 3 plans — do not remove:
          - Plan 02: <InstallController /> (install banner + iOS instructions)
          - Plan 03: <UpdateToast /> (waiting-service-worker prompt)
          - Plan 04: persistence trigger (navigator.storage.persist() on first run) */}
    </AppShell>
  );
}
