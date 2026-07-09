/**
 * Best-effort platform detection primitives for install onboarding
 * (D-03/D-04/D-05, PWA-01). Source: 03-RESEARCH.md §"Install detection +
 * Android prompt capture", Pitfall 3 (iOS Safari detection is genuinely
 * fiddly — treat as best-effort, never a security/trust decision; the
 * permanent AppMenu "Install" entry is the safety net for misfires).
 */

/**
 * True when the app is already running installed to the home screen
 * (standalone display mode on Chromium/Android, or `navigator.standalone`
 * on iOS Safari). Used to hide the install banner entirely once installed.
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Detects "iOS-family WebKit that supports Add-to-Home-Screen" pragmatically:
 * iPhone/iPad/iPod UA, OR Macintosh UA + multi-touch (iPadOS reporting a
 * desktop UA), AND WebKit present, AND NOT one of the iOS-hosted non-Safari
 * browsers (Chrome/Firefox/Edge on iOS are WebKit but cannot install PWAs
 * the same way and never fire `beforeinstallprompt` either), AND not already
 * standalone. Best-effort — see Pitfall 3; ambiguous cases fall through to
 * the "can't auto-install here" fallback copy in InstallBanner.
 */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIosDevice =
    /iP(hone|ad|od)/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const isWebkitNotOtherBrowser =
    /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIosDevice && isWebkitNotOtherBrowser && !isStandalone();
}
