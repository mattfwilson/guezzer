import { describe, expect, it, beforeEach } from "vitest";
import {
  currentRoute,
  navigate,
  ROUTES,
} from "../src/routing/useHashRoute.ts";

describe("useHashRoute / currentRoute", () => {
  beforeEach(() => {
    location.hash = "";
  });

  it("normalizes an empty hash to 'show'", () => {
    location.hash = "";
    expect(currentRoute()).toBe("show");
  });

  it("normalizes an unknown hash to 'show'", () => {
    location.hash = "#/nonsense";
    expect(currentRoute()).toBe("show");
  });

  it("resolves a known hash to its route", () => {
    location.hash = "#/explore";
    expect(currentRoute()).toBe("explore");
  });

  it("navigate('explore') sets location.hash to #/explore and currentRoute follows", () => {
    navigate("explore");
    expect(location.hash).toBe("#/explore");
    expect(currentRoute()).toBe("explore");
  });

  it("exposes the full ROUTES allow-list", () => {
    expect(ROUTES).toEqual(["show", "explore", "dex", "settings"]);
  });

  it("resolves #/settings to the settings route (D-14 allow-list extension)", () => {
    location.hash = "#/settings";
    expect(currentRoute()).toBe("settings");
  });
});
