import { describe, expect, it } from "vitest";
import {
  compass8,
  fitResidualsPx,
  haversineMeters,
  initialBearingDeg,
  metersPerPixel,
  pixelToLatLng,
  projectToPixel,
  solveGeoref,
  type ControlPoint,
} from "../../src/map/georef.ts";
import { festivalMapArtifact } from "../../src/map/georef.ts";
import artifact from "../../../../data/festival-maps/field-of-vision-2026.json" with { type: "json" };

/**
 * Synthetic fixture: points generated from a KNOWN affine at Meadow Creek
 * latitudes — x = 111000·(lng + 106.14), y = 122000·(38.812 − lat) — so the
 * solver's recovery is verifiable to rounding error, exactly the harness the
 * calibration-tool smoke test used (2026-07-21).
 */
const SYNTH: ControlPoint[] = [
  { label: "P1", lng: -106.13, lat: 38.81, x: 1110, y: 244 },
  { label: "P2", lng: -106.1385, lat: 38.8035, x: 167, y: 1037 },
  { label: "P3", lng: -106.125, lat: 38.808, x: 1665, y: 488 },
  { label: "P4", lng: -106.133, lat: 38.806, x: 777, y: 732 },
];

describe("solveGeoref", () => {
  it("recovers a known affine to sub-pixel residuals (rounding noise only)", () => {
    const fit = solveGeoref(SYNTH);
    expect(fit).not.toBeNull();
    for (const r of fitResidualsPx(fit!, SYNTH)) expect(r).toBeLessThan(1);
  });

  it("round-trips project → invert exactly", () => {
    const fit = solveGeoref(SYNTH)!;
    const back = pixelToLatLng(fit, projectToPixel(fit, { lat: 38.8071, lng: -106.1312 }));
    expect(back.lat).toBeCloseTo(38.8071, 9);
    expect(back.lng).toBeCloseTo(-106.1312, 9);
  });

  it("returns null below 3 points and for collinear points", () => {
    expect(solveGeoref(SYNTH.slice(0, 2))).toBeNull();
    const collinear: ControlPoint[] = [0, 1, 2, 3].map((i) => ({
      label: `C${i}`,
      lng: -106.14 + i * 0.001,
      lat: 38.8 + i * 0.001, // straight line in geo-space
      x: i * 100,
      y: i * 100,
    }));
    expect(solveGeoref(collinear)).toBeNull();
  });

  it("is insensitive to the raw magnitude of lng ≈ −106 (centered solve)", () => {
    // Same geometry translated to lng ≈ 0 must produce identical residuals —
    // the conditioning property the mean-centering exists to guarantee.
    const translated = SYNTH.map((p) => ({ ...p, lng: p.lng + 106.14, lat: p.lat - 38.8 }));
    const fitA = solveGeoref(SYNTH)!;
    const fitB = solveGeoref(translated)!;
    const rA = fitResidualsPx(fitA, SYNTH);
    const rB = fitResidualsPx(fitB, translated);
    rA.forEach((r, i) => expect(r).toBeCloseTo(rB[i], 6));
  });
});

describe("geodesy helpers", () => {
  it("haversine: 0.001° of latitude ≈ 111.1m anywhere", () => {
    const d = haversineMeters({ lat: 38.8, lng: -106.14 }, { lat: 38.801, lng: -106.14 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it("bearing + compass: due north / east / south-west", () => {
    const at = { lat: 38.8, lng: -106.14 };
    expect(compass8(initialBearingDeg(at, { lat: 38.81, lng: -106.14 }))).toBe("N");
    expect(compass8(initialBearingDeg(at, { lat: 38.8, lng: -106.13 }))).toBe("E");
    expect(compass8(initialBearingDeg(at, { lat: 38.79, lng: -106.153 }))).toBe("SW");
  });
});

describe("field-of-vision-2026 committed artifact", () => {
  it("validates against the strict artifact schema", () => {
    expect(() => festivalMapArtifact.parse(artifact)).not.toThrow();
  });

  it("solves to the accepted calibration quality (22 pts, ~28.5m RMS, ~0.93 m/px)", () => {
    const parsed = festivalMapArtifact.parse(artifact);
    const fit = solveGeoref(parsed.controlPoints);
    expect(fit).not.toBeNull();

    const scale = metersPerPixel(fit!, parsed.imageWidth, parsed.imageHeight);
    expect(scale).toBeGreaterThan(0.85);
    expect(scale).toBeLessThan(1.0);

    const residuals = fitResidualsPx(fit!, parsed.controlPoints);
    const rmsM =
      Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length) * scale;
    // Owner accepted 28.5m on 2026-07-22 ("good enough" — within crowd-GPS
    // noise). Guard a band, not an exact float: a silently regenerated artifact
    // that fits dramatically worse should fail loudly here.
    expect(rmsM).toBeGreaterThan(20);
    expect(rmsM).toBeLessThan(35);
  });
});
