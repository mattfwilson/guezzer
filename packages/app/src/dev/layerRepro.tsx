/**
 * TEST HARNESS ONLY (Phase 21, D-29 — FOUND-03) — a `?layerRepro=1` URL flag
 * that force-shows a band on the `toast` tier so the layer-ordering defect can
 * be reproduced on demand, in a plain desktop browser, in about 30 seconds.
 *
 * Why it exists: FOUND-03's defect is that a sheet-tier surface rendered INSIDE
 * ShowView's `zIndex: config.ui.z.content` (10) stacking context loses to a
 * top-level `toast` (20) sibling of `AppShell` — a nesting problem, not a tier
 * problem (D-20). Reproducing it normally means waiting for a real toast
 * (a service-worker update, an inbound wave, a finished backup) to coincide
 * with an open sheet, which is not something a developer can arrange. With this
 * flag the toast tier is simply always occupied, so any sheet (`SearchSheet`)
 * or the `FabMenu` can be opened over it whenever you like and the paint order
 * + tap-eating can be observed directly. Reproducible for the Phase 22–24
 * authors, not just once here (D-29).
 *
 * It is deliberately NOT `pointer-events-none`: the whole point of the repro is
 * that this band can EAT TAPS from a surface nested inside the `content: 10`
 * stacking context, which is the FabMenu half of the defect (D-27) and the part
 * that would hit the live-logging loop mid-show.
 *
 * Note for the D-12 bottom-space source guard (plan 21-10): `src/dev/**` is
 * excluded from that guard BY NAME — exactly as `dev/OrbFitHarness.tsx` is
 * already the one permitted Tailwind `z-*` site in the tree. This band
 * intentionally imitates the shipped toast geometry (`bottom-16`) so it
 * reproduces the real stacking situation; that literal must NOT be rewritten to
 * the chrome reserve, and its exclusion from the guard is deliberate, not an
 * oversight.
 *
 * Safety: inert unless `layerRepro=1` is EXPLICITLY in the query string —
 * normal loads render nothing and shipped behavior is byte-identical. The flag
 * toggles a boolean ONLY; no query-string value is ever read into, or rendered
 * as, output (the band's text is a fixed literal + a config number). A personal
 * tool (no product users to confuse); the flag is documented here, in
 * `21-HUMAN-UAT.md` test 7, and in the plan summary.
 */
import { config } from "../config";

/**
 * True only when `?layerRepro=1` is explicitly present. Exact-value equality
 * against the literal `"1"` — never truthiness, never a regex over
 * `location.search`. Read once per call — the flag can't change without a
 * reload, so callers may cache the result at module/mount scope.
 */
export function isLayerReproEnabled(): boolean {
  if (typeof location === "undefined") return false;
  const flag = new URLSearchParams(location.search).get("layerRepro");
  return flag === "1";
}

/**
 * A persistent, non-dismissable band occupying the `toast` tier, with the same
 * geometry the shipped toasts use (`UpdateToast.tsx:33`) so the reproduction is
 * faithful. `zIndex` comes from `config.ui.z.toast` via inline style — never a
 * Tailwind `z-*` class (config.ts §ui.z is the single source of truth).
 */
export function LayerReproToast() {
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-16 flex items-center border-t border-hairline bg-elevated px-4 py-4"
      style={{ zIndex: config.ui.z.toast }}
    >
      <p className="text-base leading-normal text-text-primary">
        layerRepro: toast tier {config.ui.z.toast}
      </p>
    </div>
  );
}
