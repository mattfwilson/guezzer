import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, getMeta } from "../src/db/db.ts";
import { requestPersistenceOnce } from "../src/pwa/persist.ts";

describe("persist: requestPersistenceOnce (silent, status-recorded, never throws)", () => {
  const originalStorage = navigator.storage;

  beforeEach(async () => {
    await db.meta.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "storage", {
      value: originalStorage,
      configurable: true,
    });
  });

  it("records 'persisted' when navigator.storage.persist() resolves true", async () => {
    Object.defineProperty(navigator, "storage", {
      value: {
        persisted: vi.fn().mockResolvedValue(false),
        persist: vi.fn().mockResolvedValue(true),
      },
      configurable: true,
    });

    await expect(requestPersistenceOnce()).resolves.not.toThrow();

    expect(await getMeta<string>("persistStatus")).toBe("persisted");
  });

  it("records 'best-effort' when navigator.storage.persist() resolves false, and does not throw", async () => {
    Object.defineProperty(navigator, "storage", {
      value: {
        persisted: vi.fn().mockResolvedValue(false),
        persist: vi.fn().mockResolvedValue(false),
      },
      configurable: true,
    });

    await expect(requestPersistenceOnce()).resolves.not.toThrow();

    expect(await getMeta<string>("persistStatus")).toBe("best-effort");
  });

  it("records 'unsupported' when navigator.storage.persist is absent, and does not throw", async () => {
    Object.defineProperty(navigator, "storage", {
      value: {},
      configurable: true,
    });

    await expect(requestPersistenceOnce()).resolves.not.toThrow();

    expect(await getMeta<string>("persistStatus")).toBe("unsupported");
  });

  it("is idempotent: short-circuits to 'persisted' when already persisted", async () => {
    Object.defineProperty(navigator, "storage", {
      value: {
        persisted: vi.fn().mockResolvedValue(true),
        persist: vi.fn(),
      },
      configurable: true,
    });

    await requestPersistenceOnce();

    expect(await getMeta<string>("persistStatus")).toBe("persisted");
  });
});
