import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "../src/uuid.ts";

/**
 * Regression tests for debug session start-show-not-clickable: on a plain-HTTP
 * LAN origin (insecure context — the standard on-device testing path),
 * `crypto.randomUUID` is undefined and `startShow()`'s sessionId mint threw,
 * making the Start Show tap silently do nothing on real phones. The helper
 * must produce a spec-compliant v4 UUID from `crypto.getRandomValues` when the
 * native API is absent.
 */

const V4_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomUUID", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the native crypto.randomUUID when available", () => {
    const native = vi.fn(() => "11111111-2222-4333-8444-555555555555");
    vi.stubGlobal("crypto", {
      randomUUID: native,
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    expect(randomUUID()).toBe("11111111-2222-4333-8444-555555555555");
    expect(native).toHaveBeenCalledOnce();
  });

  it("falls back to a spec-compliant v4 UUID in insecure contexts (no crypto.randomUUID)", () => {
    // Model the insecure-context environment: randomUUID missing entirely,
    // getRandomValues present (it is available in insecure contexts).
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    const id = randomUUID();
    expect(id).toMatch(V4_SHAPE); // version nibble 4, RFC 4122 variant [89ab]
  });

  it("fallback produces unique values across calls", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    const seen = new Set(Array.from({ length: 100 }, () => randomUUID()));
    expect(seen.size).toBe(100);
  });
});
