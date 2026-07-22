import { useSyncExternalStore } from "react";

/**
 * D-02: library-free hash routing. Also the phase's one live security
 * control (T-03-02) — `location.hash` is validated against this fixed
 * allow-list and only ever used to SELECT a view; never assigned to
 * `innerHTML`, `location`, or passed to `eval`.
 */
export const ROUTES = ["show", "explore", "map", "dex", "settings"] as const;
export type Route = (typeof ROUTES)[number];

function isRoute(value: string): value is Route {
  return (ROUTES as readonly string[]).includes(value);
}

export function currentRoute(): Route {
  const h = location.hash.replace(/^#\/?/, "");
  return isRoute(h) ? h : "show"; // unknown/empty hash normalizes to 'show'
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute, () => "show");
}

export function navigate(route: Route): void {
  location.hash = `#/${route}`;
}
