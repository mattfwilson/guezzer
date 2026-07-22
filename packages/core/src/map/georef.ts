/**
 * GizzMap georeferencing (owner-approved design, exploration 2026-07-21).
 *
 * Maps GPS lat/lng onto the ILLUSTRATED festival map via control points + a
 * mean-centered least-squares affine. A global affine is the deliberate,
 * data-justified model — the Field of Vision 2026 illustration was measured
 * against 22 real control points: 0.5° off north-up, near-isotropic scale
 * (0.914 vs 0.941 m/px), residuals local rather than regional, 28.5m RMS vs
 * ±20–50m crowd-GPS noise. Piecewise-affine/TPS were evaluated and REJECTED
 * (no regional warp for them to fix). Re-run that analysis before swapping
 * models if a future festival's map is drawn less faithfully.
 *
 * Everything here is pure and deterministic: solve → project → invert are
 * plain math over plain data, Node-testable, zero I/O. The affine is solved
 * on MEAN-CENTERED inputs (lng ≈ -106 spans ~0.02° here; centering keeps the
 * normal equations well-conditioned) — `GeorefFit` therefore carries the
 * centroid alongside the six coefficients, and the artifact's `fit` block is
 * convenience output only: consumers MUST re-solve from `controlPoints`, the
 * single source of truth.
 */
import { z } from "zod";

/** A real-world WGS-84 coordinate. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** A pixel position on the illustrated map image (origin top-left). */
export interface PixelPoint {
  x: number;
  y: number;
}

/** One calibrated correspondence: this lat/lng IS this pixel on the illustration. */
export interface ControlPoint extends GeoPoint, PixelPoint {
  label: string;
}

/**
 * The solved centered affine: px = (mX + c) + a·(lng−mLng) + b·(lat−mLat),
 * py = (mY + f) + d·(lng−mLng) + e·(lat−mLat).
 */
export interface GeorefFit {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  mLng: number;
  mLat: number;
  mX: number;
  mY: number;
}

/** One control point of the committed calibration artifact. */
export const controlPointSchema = z.strictObject({
  label: z.string(),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  x: z.number(),
  y: z.number(),
});

/**
 * The festival-map calibration artifact (data/festival-maps/*.json), produced
 * by the desktop calibration tool. `fit` is tool-side convenience output —
 * tolerated but IGNORED by consumers (they re-solve from controlPoints), so it
 * is passthrough-loose while everything load-bearing is strict.
 */
export const festivalMapArtifact = z.strictObject({
  schemaVersion: z.literal(1),
  festival: z.string(),
  venue: z.string().optional(),
  image: z.string(),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  generatedAt: z.string().optional(),
  controlPoints: z.array(controlPointSchema).min(3),
  fit: z.unknown().optional(),
});

export type FestivalMapArtifact = z.infer<typeof festivalMapArtifact>;

/** Gaussian elimination with partial pivoting on a 3×3 system; null when singular. */
function solve3(M: number[][], v: number[]): number[] | null {
  const A = M.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) {
      if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    }
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const factor = A[r][c] / A[c][c];
      for (let k = c; k < 4; k++) A[r][k] -= factor * A[c][k];
    }
  }
  return [A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
}

/**
 * Least-squares affine (lng,lat)→(x,y) over ≥3 control points, solved on
 * mean-centered data. Returns null on degenerate input (collinear points, or
 * a solution whose 2×2 linear part is non-invertible — projection would be
 * meaningless and pixelToLatLng would divide by ~0).
 *
 * No map projection is involved by design: over a ~2 km site the lat/lng
 * degree-size anisotropy is a constant scale the affine absorbs, and Earth
 * curvature contributes centimeters (exploration 2026-07-21).
 */
export function solveGeoref(points: readonly ControlPoint[]): GeorefFit | null {
  if (points.length < 3) return null;
  const n = points.length;
  const mLng = points.reduce((s, p) => s + p.lng, 0) / n;
  const mLat = points.reduce((s, p) => s + p.lat, 0) / n;
  const mX = points.reduce((s, p) => s + p.x, 0) / n;
  const mY = points.reduce((s, p) => s + p.y, 0) / n;

  const S = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const bx = [0, 0, 0];
  const by = [0, 0, 0];
  for (const p of points) {
    const row = [p.lng - mLng, p.lat - mLat, 1];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) S[i][j] += row[i] * row[j];
      bx[i] += row[i] * (p.x - mX);
      by[i] += row[i] * (p.y - mY);
    }
  }

  const X = solve3(S, bx);
  const Y = solve3(S, by);
  if (!X || !Y) return null;

  const fit: GeorefFit = {
    a: X[0],
    b: X[1],
    c: X[2],
    d: Y[0],
    e: Y[1],
    f: Y[2],
    mLng,
    mLat,
    mX,
    mY,
  };
  if (Math.abs(fit.a * fit.e - fit.b * fit.d) < 1e-9) return null;
  return fit;
}

/** Project a real-world coordinate onto the illustration. */
export function projectToPixel(fit: GeorefFit, p: GeoPoint): PixelPoint {
  return {
    x: fit.mX + fit.c + fit.a * (p.lng - fit.mLng) + fit.b * (p.lat - fit.mLat),
    y: fit.mY + fit.f + fit.d * (p.lng - fit.mLng) + fit.e * (p.lat - fit.mLat),
  };
}

/**
 * Invert a pixel back to lat/lng — the "meet here" pin path (pins sync in
 * lat/lng, ALWAYS, so every device renders them through its own fit).
 */
export function pixelToLatLng(fit: GeorefFit, p: PixelPoint): GeoPoint {
  const u = p.x - fit.mX - fit.c;
  const v = p.y - fit.mY - fit.f;
  const det = fit.a * fit.e - fit.b * fit.d;
  return {
    lng: fit.mLng + (fit.e * u - fit.b * v) / det,
    lat: fit.mLat + (-fit.d * u + fit.a * v) / det,
  };
}

/** Great-circle distance in meters (haversine, spherical Earth R=6371km — cm-accurate at venue scale). */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Initial great-circle bearing from `a` to `b`, degrees clockwise from true north in [0, 360). */
export function initialBearingDeg(a: GeoPoint, b: GeoPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLng = rad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Compass8 = (typeof COMPASS_8)[number];

/** Bucket a bearing into the 8-point compass label used by "~120m NE" copy. */
export function compass8(bearingDeg: number): Compass8 {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  return COMPASS_8[Math.round(normalized / 45) % 8];
}

/**
 * Ground scale at the image center, meters per pixel (mean of the horizontal
 * and vertical axes — near-identical for this artifact, see header note).
 */
export function metersPerPixel(
  fit: GeorefFit,
  imageWidth: number,
  imageHeight: number,
): number {
  const center = { x: imageWidth / 2, y: imageHeight / 2 };
  const at = pixelToLatLng(fit, center);
  const h = haversineMeters(at, pixelToLatLng(fit, { x: center.x + 1, y: center.y }));
  const v = haversineMeters(at, pixelToLatLng(fit, { x: center.x, y: center.y + 1 }));
  return (h + v) / 2;
}

/** Per-point pixel residual of a fit over its control points (calibration QA / tests). */
export function fitResidualsPx(
  fit: GeorefFit,
  points: readonly ControlPoint[],
): number[] {
  return points.map((p) => {
    const projected = projectToPixel(fit, p);
    return Math.hypot(projected.x - p.x, projected.y - p.y);
  });
}
