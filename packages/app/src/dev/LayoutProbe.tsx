/**
 * TEST HARNESS ONLY (Phase 21, D-14 — FOUND-01) — a `?layoutProbe=1` URL flag
 * that renders every number the installed-PWA bottom-gap diagnosis needs, as
 * selectable text in one screenshot.
 *
 * Why it exists: `env(safe-area-inset-bottom)` is `0` in every headless, jsdom
 * and desktop-Safari-tab context, so the FOUND-01 dead gap is invisible outside
 * an INSTALLED home-screen instance by construction (21-VALIDATION §Manual-Only
 * row 1). The fix must follow evidence, not a hunch — so this readout ships
 * first and the diagnosis is read off a real device.
 *
 * The harness pays for itself twice (D-14): it is BOTH the diagnosis and the
 * D-18 before/after evidence, and it makes D-19's "a non-reproduction still
 * satisfies FOUND-01" mechanically checkable — if `GAP` already reads 0 on
 * device, the measurement IS the evidence and no code change is required.
 *
 * The load-bearing lines:
 *   - `bodyH-rootH` — D-15 predicts this equals `sab` if the body-level bottom
 *     inset (`styles.css:220`) is being double-counted against
 *     `BottomTabBar.tsx:25-26`. This single equality is the whole diagnosis.
 *   - `GAP` — `tabTop - mainBottom`, the dead gap itself in one subtraction,
 *     where `mainBottom` is <main>'s CONTENT bottom (border box minus its
 *     computed `padding-bottom`). Measuring the border box instead makes `GAP`
 *     degenerate to a constant once <main> reserves the chrome — see the
 *     comment at the computation. This is the number that goes in
 *     `21-HUMAN-UAT.md`.
 *
 * Overlay geometry: anchored to the TOP of the viewport on purpose — the bottom
 * gap is what gets photographed, so the readout must never occlude it.
 *
 * Note for the D-12 bottom-space source guard (plan 21-10): `src/dev/**` is
 * excluded from that guard by name (see `layerRepro.tsx`). The four
 * `env(safe-area-inset-*)` strings below are MEASUREMENT INPUTS to a probe
 * element, not layout authored against the chrome reserve — they must stay
 * literal for the probe technique to work at all.
 *
 * Safety: inert unless `layoutProbe=1` is EXPLICITLY in the query string. The
 * flag toggles a boolean ONLY; no query-string value is ever read into or
 * rendered as output. The readout does print `navigator.userAgent` and viewport
 * geometry (T-21-03, accepted): those are already available to any script on
 * the page, this is a personal tool with no product users, and the overlay is
 * only reachable behind an explicit flag. It is rendered as escaped React text,
 * never `innerHTML`.
 */
import { useCallback, useEffect, useState } from "react";
import { config } from "../config";

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * True only when `?layoutProbe=1` is explicitly present. Exact-value equality
 * against the literal `"1"` — never truthiness, never a regex over
 * `location.search`. Read once per call — the flag can't change without a
 * reload, so callers may cache the result at module/mount scope.
 */
export function isLayoutProbeEnabled(): boolean {
  if (typeof location === "undefined") return false;
  const flag = new URLSearchParams(location.search).get("layoutProbe");
  return flag === "1";
}

/**
 * The probe-element technique (21-RESEARCH §Measuring on device): `env()`
 * values cannot be read from JS directly, so set them as PADDING on a detached
 * throwaway `div`, append it, read the resolved padding back off
 * `getComputedStyle`, and remove it. Under jsdom (and any engine that does not
 * understand `env()`) the padding never resolves, `parseFloat` yields `NaN`,
 * and all four fall back to `0` — which is exactly the truthful answer there.
 */
export function readSafeAreaInsets(): SafeAreaInsets {
  if (typeof document === "undefined") return { ...ZERO_INSETS };

  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "0";
  el.style.width = "0";
  el.style.height = "0";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.style.paddingTop = "env(safe-area-inset-top)";
  el.style.paddingRight = "env(safe-area-inset-right)";
  el.style.paddingBottom = "env(safe-area-inset-bottom)";
  el.style.paddingLeft = "env(safe-area-inset-left)";
  document.body.appendChild(el);

  const computed = getComputedStyle(el);
  const insets: SafeAreaInsets = {
    top: px(computed.paddingTop),
    right: px(computed.paddingRight),
    bottom: px(computed.paddingBottom),
    left: px(computed.paddingLeft),
  };

  el.remove();
  return insets;
}

/** `parseFloat` with an unresolved/absent value collapsing to 0, never NaN. */
function px(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** A number for display, or the explicit `n/a` when the element was missing. */
function num(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return String(Math.round(value * 100) / 100);
}

/** `offsetHeight` of an element that may not exist on this route/render. */
function offsetHeightOf(el: Element | null): number | null {
  return el instanceof HTMLElement ? el.offsetHeight : null;
}

interface Row {
  label: string;
  value: string;
  /** The two load-bearing lines are visually lifted so a screenshot can't miss them. */
  emphasis?: boolean;
}

/**
 * One full measurement pass. EVERY DOM lookup tolerates a missing element and
 * renders `n/a` rather than throwing — the probe must survive being opened on
 * any route, mid-transition, or in a bare jsdom document with no app tree.
 */
function measure(): Row[] {
  const insets = readSafeAreaInsets();

  const nav = typeof navigator === "undefined" ? null : navigator;
  const navStandalone =
    (nav as (Navigator & { standalone?: boolean }) | null)?.standalone === true;
  const mqStandalone =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)").matches
      : null;

  const doc = typeof document === "undefined" ? null : document;
  const html = doc?.documentElement ?? null;
  const body = doc?.body ?? null;
  const root = doc?.getElementById("root") ?? null;
  const main = doc?.querySelector("main") ?? null;
  const navEl = doc?.querySelector("nav") ?? null;
  const firstTab = navEl?.querySelector("button") ?? null;

  const bodyH = offsetHeightOf(body);
  const rootH = offsetHeightOf(root);
  const bodyMinusRoot = bodyH !== null && rootH !== null ? bodyH - rootH : null;

  // `mainBottom` must be where CONTENT ends, not where <main>'s border box ends.
  // Since plan 21-07, <main> carries `paddingBottom: var(--gz-content-reserve)`
  // on scrolling routes, so its border box runs to the viewport bottom and
  // `getBoundingClientRect().bottom` reports the same number regardless of the
  // real gap — `GAP` degenerated to a constant -(4rem + sab). Subtracting the
  // computed padding restores the content edge, which is the FOUND-01 quantity.
  const mainPadBottom = main
    ? (Number.parseFloat(getComputedStyle(main).paddingBottom) || 0)
    : 0;
  const mainBottom = main
    ? main.getBoundingClientRect().bottom - mainPadBottom
    : null;
  const tabTop = firstTab ? firstTab.getBoundingClientRect().top : null;
  const gap = mainBottom !== null && tabTop !== null ? tabTop - mainBottom : null;

  const innerW = typeof window === "undefined" ? null : window.innerWidth;
  const innerH = typeof window === "undefined" ? null : window.innerHeight;
  const orientation =
    (typeof screen !== "undefined" ? screen.orientation?.type : undefined) ??
    (innerW !== null && innerH !== null
      ? innerW > innerH
        ? "landscape"
        : "portrait"
      : "n/a");

  return [
    // ── The independent variable (D-11: landscape must be captured separately) ──
    { label: "sab", value: num(insets.bottom) },
    { label: "sat", value: num(insets.top) },
    { label: "sal", value: num(insets.left) },
    { label: "sar", value: num(insets.right) },
    // ── Installed vs. Safari tab. iOS uses legacy navigator.standalone;
    //    Android Chrome uses the media query — capture BOTH, separately. ──
    {
      label: "standalone",
      value: `nav=${String(navStandalone)} mq=${mqStandalone === null ? "n/a" : String(mqStandalone)}`,
    },
    // ── Viewport-sizing story vs. box-model story ──
    { label: "innerH", value: num(innerH) },
    {
      label: "clientH",
      value: num(html ? html.clientHeight : null),
    },
    {
      label: "vvH",
      value: num(
        typeof window === "undefined" ? null : (window.visualViewport?.height ?? null),
      ),
    },
    // ── The box-model chain ──
    { label: "htmlH", value: num(offsetHeightOf(html)) },
    { label: "bodyH", value: num(bodyH) },
    { label: "rootH", value: num(rootH) },
    { label: "mainH", value: num(offsetHeightOf(main)) },
    // ── D-15's single falsifiable equality: this should equal `sab`. ──
    { label: "bodyH-rootH", value: num(bodyMinusRoot), emphasis: true },
    // ── The gap itself, in one subtraction. ──
    // `mainPadB` is shown so the border-box correction above is auditable from
    // the screenshot alone: border-box bottom == mainBottom + mainPadB.
    { label: "mainPadB", value: num(mainPadBottom) },
    { label: "mainBottom", value: num(mainBottom) },
    { label: "tabTop", value: num(tabTop) },
    { label: ">>> GAP", value: num(gap), emphasis: true },
    // ── Context so a rem-based reading is interpretable (D-18). ──
    {
      label: "dpr",
      value: num(typeof window === "undefined" ? null : window.devicePixelRatio),
    },
    {
      label: "htmlFont",
      value: html ? getComputedStyle(html).fontSize || "n/a" : "n/a",
    },
    { label: "orient", value: orientation },
    { label: "ua", value: nav?.userAgent ?? "n/a" },
  ];
}

/**
 * The FOUND-01 readout. Fixed to the TOP of the viewport (never over the bottom
 * gap being photographed), on the `sheet` tier so nothing paints over it, and
 * text-selectable so the numbers can be copied as well as screenshotted.
 */
export function LayoutProbe() {
  const [rows, setRows] = useState<Row[]>(() => measure());

  const remeasure = useCallback(() => setRows(measure()), []);

  useEffect(() => {
    // Re-read after the first paint so the app tree is laid out before <main>
    // and the tab bar are measured.
    remeasure();

    window.addEventListener("resize", remeasure);
    window.addEventListener("orientationchange", remeasure);
    const vv = window.visualViewport ?? null;
    vv?.addEventListener("resize", remeasure);

    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("orientationchange", remeasure);
      vv?.removeEventListener("resize", remeasure);
    };
  }, [remeasure]);

  return (
    <div
      data-layout-probe
      role="status"
      className="fixed left-0 right-0 top-0 max-h-[60vh] overflow-y-auto bg-surface/95 px-2 py-1 font-mono text-[11px] leading-tight text-text-primary"
      style={{
        zIndex: config.ui.z.sheet,
        userSelect: "text",
        WebkitUserSelect: "text",
        pointerEvents: "auto",
      }}
    >
      <p className="font-semibold">layoutProbe · FOUND-01 (D-14) · dev only</p>
      {rows.map((row) => (
        <p
          key={row.label}
          className={`break-all ${row.emphasis ? "font-semibold text-accent" : ""}`}
        >
          {row.label}: {row.value}
        </p>
      ))}
    </div>
  );
}
