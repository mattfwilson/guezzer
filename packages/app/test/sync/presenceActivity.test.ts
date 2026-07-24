import { describe, expect, it } from "vitest";
import {
  deriveActivity,
  reduceActivity,
  ROUTE_TO_TAB,
} from "../../src/sync/presenceActivity.ts";

/**
 * Phase-20 pure activity derivation (PRES-04). No Supabase, no React, no DOM —
 * these are the two pure functions the presence engine feeds: `deriveActivity`
 * turns (route, hidden, atShowActive) into the coarse `{ tab, atShow? }` payload
 * (D-03 — atShow is a boolean, never a song; D-02 — a hidden tab is idle), and
 * `reduceActivity` collapses a peer's multi-entry presence array to one Activity
 * (atShow entry wins, else the last valid entry, else null — never throws;
 * Pitfall 2).
 */

describe("ROUTE_TO_TAB", () => {
  it("maps every Route to its brand-name tab (settings → idle)", () => {
    expect(ROUTE_TO_TAB).toEqual({
      show: "LiveGizz",
      explore: "GizzVerse",
      map: "GizzMap",
      dex: "GizzDex",
      games: "GizzGames",
      settings: "idle",
    });
  });
});

describe("deriveActivity", () => {
  it("show + visible + atShow-active → LiveGizz with atShow:true", () => {
    expect(deriveActivity("show", false, true)).toEqual({
      tab: "LiveGizz",
      atShow: true,
    });
  });

  it("show + visible + no active show → LiveGizz with NO atShow key", () => {
    const a = deriveActivity("show", false, false);
    expect(a).toEqual({ tab: "LiveGizz" });
    expect("atShow" in a).toBe(false);
  });

  it("maps each content route to its tab", () => {
    expect(deriveActivity("explore", false, false)).toEqual({ tab: "GizzVerse" });
    expect(deriveActivity("map", false, false)).toEqual({ tab: "GizzMap" });
    expect(deriveActivity("dex", false, false)).toEqual({ tab: "GizzDex" });
    expect(deriveActivity("games", false, false)).toEqual({ tab: "GizzGames" });
  });

  it("hidden wins over everything, including atShow (D-02)", () => {
    expect(deriveActivity("show", true, true)).toEqual({ tab: "idle" });
    expect("atShow" in deriveActivity("show", true, true)).toBe(false);
  });

  it("settings (no content tab) → idle", () => {
    expect(deriveActivity("settings", false, false)).toEqual({ tab: "idle" });
  });

  it("atShow only when show route is foregrounded (never on other tabs)", () => {
    // atShowActive true but not on the show route → no atShow leak
    expect(deriveActivity("dex", false, true)).toEqual({ tab: "GizzDex" });
  });
});

describe("reduceActivity", () => {
  it("prefers the first entry with atShow:true", () => {
    expect(
      reduceActivity([{ tab: "GizzDex" }, { tab: "LiveGizz", atShow: true }]),
    ).toEqual({ tab: "LiveGizz", atShow: true });
  });

  it("with no atShow entry, returns the last valid entry", () => {
    expect(reduceActivity([{ tab: "GizzDex" }, { tab: "GizzVerse" }])).toEqual({
      tab: "GizzVerse",
    });
  });

  it("all entries malformed → null (never throws, Pitfall 2)", () => {
    expect(reduceActivity([{}, { tab: "nonsense" }])).toBeNull();
  });

  it("empty array → null", () => {
    expect(reduceActivity([])).toBeNull();
  });

  it("skips malformed entries but keeps valid ones", () => {
    expect(
      reduceActivity([{ tab: "nonsense" }, null, { tab: "GizzMap" }]),
    ).toEqual({ tab: "GizzMap" });
  });

  it("a malformed atShow flag (non-true) is treated as absent", () => {
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reduceActivity([{ tab: "LiveGizz", atShow: "yes" } as any]),
    ).toEqual({ tab: "LiveGizz" });
  });
});
