import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import { presenceActivityLabel } from "../src/dex/FriendRow.tsx";
import type { Tab } from "../src/sync/presenceActivity.ts";

/**
 * NAV-03 — the presence label contract (D-39/D-40/D-41).
 *
 * D-39: the `Tab` tokens are the FROZEN `gizz-room` wire vocabulary, not display
 * labels; `config.copy.presence.activity` is the map that turns each token into
 * its label.
 *
 * D-40, two voices off one token: the bottom tab reads "Me" because it is *your*
 * tab, so a friend's dot must never read "Alex is on Me" — the presence voice is
 * "on GizzDex". This file asserts the two voices stay distinct.
 *
 * D-41 + the NAMED fallback placement, option (ii): the fallback lives in the
 * RENDER path (`presenceActivityLabel`), never in `reduceActivity` — the `TABS`
 * allow-list there is a real input-validation control over untrusted peer
 * payloads and stays byte-identical (see `test/sync/presenceActivity.test.ts`,
 * which still pins `reduceActivity([{ tab: "nonsense" }])` to `null`). The label
 * is therefore ALWAYS a constant string chosen by our own map — no peer-supplied
 * text ever reaches the DOM.
 */

/** The six frozen wire tokens, listed explicitly (not derived from the map). */
const TAB_TOKENS: Tab[] = [
  "LiveGizz",
  "GizzVerse",
  "GizzMap",
  "GizzDex",
  "GizzGames",
  "idle",
];

const presence = config.copy.presence;

describe("config.copy.presence.activity — the presence voice map (D-39)", () => {
  it("equals exactly the six-token label map", () => {
    expect(presence.activity).toEqual({
      LiveGizz: "on LiveGizz",
      GizzVerse: "on GizzVerse",
      GizzMap: "on GizzMap",
      GizzDex: "on GizzDex",
      GizzGames: "on GizzGames",
      idle: "idle",
    });
  });

  it("every Tab union member has a non-empty label", () => {
    // Iterated explicitly so a future token added WITHOUT a label fails here as
    // well as at compile time (the map is typed `Record<Tab, string>`).
    for (const token of TAB_TOKENS) {
      const label = presence.activity[token];
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("carries the D-41 constant fallback", () => {
    expect(presence.activityUnknown).toBe("in the app");
  });
});

describe("presenceActivityLabel — resolution order (NAV-03)", () => {
  it("resolves a known token to its presence voice, never the tab voice or the raw token (D-40)", () => {
    const label = presenceActivityLabel({ tab: "GizzDex" }, true);
    expect(label).toBe("on GizzDex");
    // The tab reads "Me" because it is YOUR tab — a friend's dot must not.
    expect(label).not.toBe("on Me");
    expect(label).not.toBe(config.copy.tabs.dex);
    // And never the bare wire token.
    expect(label).not.toBe("GizzDex");
  });

  it("atShow still wins over the tab (shipped precedence unchanged)", () => {
    expect(presenceActivityLabel({ tab: "LiveGizz", atShow: true }, true)).toBe(
      presence.atShow,
    );
    expect(presenceActivityLabel({ tab: "LiveGizz", atShow: true }, true)).toBe(
      "At a show 🎸",
    );
  });

  it("an online friend with NO activity reads `in the app` — never blank (D-41)", () => {
    expect(presenceActivityLabel(null, true)).toBe("in the app");
    expect(presenceActivityLabel(undefined, true)).toBe("in the app");
  });

  it("an offline friend keeps today's empty slot", () => {
    expect(presenceActivityLabel(null, false)).toBeNull();
  });

  it("an UNKNOWN token resolves to the constant — no peer-supplied text reaches the DOM (T-21-06)", () => {
    // The live risk: a NEWER build sends a token this build has no label for.
    const label = presenceActivityLabel({ tab: "SomeFutureTab" } as never, true);
    expect(label).toBe("in the app");
    expect(label).not.toBe("SomeFutureTab");
    expect(label).not.toContain("SomeFutureTab");
  });

  it("every known token resolves to its own map entry", () => {
    for (const token of TAB_TOKENS) {
      expect(presenceActivityLabel({ tab: token }, true)).toBe(
        presence.activity[token],
      );
    }
  });
});
