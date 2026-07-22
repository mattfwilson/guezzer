import { describe, expect, it } from "vitest";
import { loadFestivalMap } from "../../src/map/festival-map.ts";

describe("loadFestivalMap (bundled artifact loader, @matrix idiom)", () => {
  it("validates + solves the committed field-of-vision-2026 artifact", () => {
    const result = loadFestivalMap();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.artifact.festival).toBe("field-of-vision-2026");
    expect(result.artifact.imageWidth).toBe(1920);
    expect(result.artifact.imageHeight).toBe(1080);
    // The accepted calibration: ~0.93 m/px at image center (owner 2026-07-22).
    expect(result.scaleMPerPx).toBeGreaterThan(0.85);
    expect(result.scaleMPerPx).toBeLessThan(1.0);
    // Bundled image URL resolves through Vite's asset pipeline.
    expect(result.imageUrl).toBeTruthy();
  });

  it("is memoized — a second call returns the SAME result reference", () => {
    expect(loadFestivalMap()).toBe(loadFestivalMap());
  });
});
