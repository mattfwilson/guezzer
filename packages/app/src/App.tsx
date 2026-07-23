import { useEffect, useRef, useState } from "react";
import { AppMenu } from "./components/AppMenu";
import { AppShell } from "./components/AppShell";
import { BackupToast } from "./components/BackupToast";
import { BingoCelebration } from "./components/BingoCelebration.tsx";
import { InstallBanner } from "./components/InstallBanner";
import { PlaceholderView } from "./components/PlaceholderView";
import { UpdateToast } from "./components/UpdateToast";
import { OrbFitHarness } from "./dev/OrbFitHarness.tsx";
import { DexView } from "./dex/DexView.tsx";
import { ExploreView } from "./explore/ExploreView.tsx";
import { GamesView } from "./games/GamesView.tsx";
import { useBingoCelebrations } from "./games/useBingoCelebrations.ts";
import { MapView } from "./map/MapView.tsx";
import { requestPersistenceOnce } from "./pwa/persist.ts";
import { useHashRoute } from "./routing/useHashRoute";
import { SettingsView } from "./settings/SettingsView.tsx";
import { ShowView } from "./show/ShowView.tsx";
import { useProgressSync } from "./sync/useProgressSync.ts";

export function App() {
  const route = useHashRoute();
  const [menuOpen, setMenuOpen] = useState(false);

  // Phase-16 (BINGO-05): App-level celebration driver. Diffs live bingo-board
  // win/mark transitions and fires the module emitter that `<BingoCelebration/>`
  // below renders — mounted once here so a celebration survives the
  // ShowView→RecapView unmount and fires over any tab (BackupToast precedent).
  useBingoCelebrations();

  // Phase-19 (D-16, PROG-02/05): the app-wide shared-progress ENGINE. Mounted
  // ONCE here at the shell (the same app-wide-mount precedent as
  // useBingoCelebrations above) so the postgres_changes subscription AND the
  // debounced own-row upsert stay active while signed in ACROSS every tab —
  // including Show Mode / LiveGizz — NOT only on the Friends segment. The
  // signed-in gate lives inside the hook, so this call is unconditional (never
  // gated on route === "dex"). Renders nothing; publishes to the shared sync
  // store that useFriendsProgress reads.
  useProgressSync();

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

  // POLISH-01 THROWAWAY dev harness (plan 08-06) — gated OUTSIDE the normal route
  // switch on the exact `#/dev/orb-fit` hash (not in the ROUTES allow-list, so it
  // never appears as a tab and leaves existing routing untouched). Placed AFTER all
  // hooks (rules of hooks). Renders all 264 real orb labels on-device and flags
  // overflow by real measurement. REMOVE POST-PHASE. Personal tool: exposes only
  // the already-bundled public catalog names.
  if (typeof location !== "undefined" && location.hash === "#/dev/orb-fit") {
    return <OrbFitHarness />;
  }

  return (
    // Phase-8 A11Y-01: the `#app-content` inert target (setRootInert toggles native
    // `inert` here while a modal <Sheet> is open). `display:contents` adds NO layout
    // box — the visible tree is identical to before — while still propagating `inert`
    // to every descendant per spec. Open sheets portal to document.body, OUTSIDE this
    // wrapper, so they stay interactive while everything here goes inert. Fallback if a
    // device ever shows inert NOT propagating through display:contents: move id/inert
    // onto AppShell's root flex div instead.
    <div id="app-content" style={{ display: "contents" }}>
      {/* Show Mode owns a full-height non-scrolling orbit (SHOW-13, Pitfall 5),
          so `#/show` disables AppShell's `<main>` scroll. Explore's constellation
          canvas owns all its gestures too (07-UI-SPEC §Layout region 1), so
          `#/explore` also mounts non-scrolling — and `#/map` likewise: the
          GizzMap stage owns its own pan/zoom/long-press gestures. Dex scrolls. */}
      <AppShell
        onMenuClick={() => setMenuOpen(true)}
        scroll={route !== "show" && route !== "explore" && route !== "map"}
      >
        {route === "show" ? (
          <ShowView />
        ) : route === "explore" ? (
          <ExploreView />
        ) : route === "map" ? (
          <MapView />
        ) : route === "settings" ? (
          <SettingsView />
        ) : route === "dex" ? (
          <DexView />
        ) : route === "games" ? (
          <GamesView />
        ) : (
          <PlaceholderView route={route} />
        )}
      </AppShell>

      <InstallBanner />
      <UpdateToast />
      <BackupToast />
      <BingoCelebration />
      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
