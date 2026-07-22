import { describe, expect, it } from "vitest";
import { identityColorIndex } from "../../src/identity/color.ts";

/**
 * AUTH-07 / D-13 — the pure identity-color index helper.
 *
 * Core stays palette-agnostic: the helper returns an INDEX, never a color
 * string. The app injects `config.auth.IDENTITY_COLORS.length` and reads the
 * hue back out. These assertions pin the three properties every downstream
 * consumer (header avatar, Phase 19 friend rows, Phase 20 presence dots) relies
 * on: determinism, range-safety, and the exact MapView hash idiom.
 */
describe("identityColorIndex (AUTH-07 / D-13)", () => {
  it("is deterministic — same (userId, length) yields the same index every call", () => {
    const a = identityColorIndex("abc", 6);
    const b = identityColorIndex("abc", 6);
    expect(a).toBe(b);
    // A plausible Supabase UUID is stable across repeated calls too.
    const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(identityColorIndex(uuid, 6)).toBe(identityColorIndex(uuid, 6));
  });

  it("returns an in-range integer 0 <= index < paletteLength", () => {
    const ids = [
      "abc",
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "",
      "Matt",
      "user-with-a-fairly-long-identifier-string-0123456789",
    ];
    for (const id of ids) {
      for (const len of [1, 3, 6, 12]) {
        const idx = identityColorIndex(id, len);
        expect(Number.isInteger(idx)).toBe(true);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(len);
      }
    }
  });

  it("two different plausible UUIDs both map into range without throwing", () => {
    const u1 = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const u2 = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
    expect(() => identityColorIndex(u1, 6)).not.toThrow();
    expect(() => identityColorIndex(u2, 6)).not.toThrow();
    expect(identityColorIndex(u1, 6)).toBeGreaterThanOrEqual(0);
    expect(identityColorIndex(u2, 6)).toBeGreaterThanOrEqual(0);
  });

  it("matches the MapView memberColor hash idiom exactly", () => {
    // Reference implementation: hash = (hash * 31 + charCodeAt(i)) | 0,
    // index = Math.abs(hash) % paletteLength.
    const reference = (userId: string, paletteLength: number): number => {
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = (hash * 31 + userId.charCodeAt(i)) | 0;
      }
      return Math.abs(hash) % paletteLength;
    };
    const ids = ["abc", "Matt", "3f2504e0-4f89-41d3-9a0c-0305e82c3301", ""];
    for (const id of ids) {
      expect(identityColorIndex(id, 6)).toBe(reference(id, 6));
    }
  });
});
