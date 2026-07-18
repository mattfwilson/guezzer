/**
 * Phase-8 A11Y-02/A11Y-03 (Pitfall 3): the ONE shared visible-viewport height
 * source that NodeSheet's peek, the FilterFab lift, and the ConstellationCanvas
 * camera reframe all read, so they never disagree.
 *
 * Reads `window.visualViewport?.height ?? window.innerHeight`. On iOS Safari
 * `window.innerHeight` is the LARGE viewport (toolbars hidden) and ignores the
 * on-screen keyboard, while `visualViewport.height` tracks the REAL visible box
 * (RESEARCH §"Don't Hand-Roll" / §Pitfall 3). Subscribing to `window` `resize`
 * plus `visualViewport` `resize`+`scroll` (feature-detected) means a keyboard
 * show/hide or address-bar collapse — not just a layout resize — updates the
 * value. The listener idiom mirrors the local add/remove shape at NodeSheet:84-88.
 */
import { useEffect, useState } from "react";

function readVisibleViewportHeight(): number {
  if (typeof window === "undefined") return 0;
  return window.visualViewport?.height ?? window.innerHeight;
}

export function useVisibleViewportHeight(): number {
  const [height, setHeight] = useState(readVisibleViewportHeight);

  useEffect(() => {
    const onResize = () => setHeight(readVisibleViewportHeight());
    // Re-read once on mount in case the viewport changed before the effect ran.
    onResize();
    window.addEventListener("resize", onResize);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onResize);
    vv?.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      vv?.removeEventListener("resize", onResize);
      vv?.removeEventListener("scroll", onResize);
    };
  }, []);

  return height;
}
