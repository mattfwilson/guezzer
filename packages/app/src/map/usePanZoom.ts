/**
 * Pan/zoom/long-press gesture engine for the GizzMap stage — one-thumb,
 * touch-first (pinch via the two-pointer cache pattern, wheel for desktop),
 * declarative-CSS gesture suppression assumed by the host (App.tsx mounts
 * #/map non-scrolling, the Phase-4 seam).
 *
 * Transform model: screen = translate(tx,ty) + scale(zoom) over an
 * image-coordinate world div, transform-origin 0 0 — the calibration tool's
 * exact math, now in React. Zoom is expressed RELATIVE to the fitted scale
 * (fit = 1), clamped by config.map.ZOOM_MIN/MAX.
 *
 * Long-press (drop a pin): single pointer, ≤LONG_PRESS_MOVE_PX of travel,
 * LONG_PRESS_MS held — mirrors the orb info-gesture constants' semantics.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "../config.ts";

// The stage element lives in STATE (not a ref): the map can mount AFTER the
// first render (join-card-first flow), and the listener/fit effects must
// re-run when it appears — a ref mutation would never re-trigger them.

export interface PanZoomTransform {
  tx: number;
  ty: number;
  /** Absolute CSS scale (fitScale × relative zoom). */
  scale: number;
}

export interface PanZoom {
  transform: PanZoomTransform;
  /** Attach to the stage (viewport) element. */
  stageRef: (el: HTMLDivElement | null) => void;
  /** Re-fit the image into the viewport (initial mount + double-tap). */
  fitView: () => void;
  /**
   * True while the just-ended gesture actually panned/pinched — marker onClick
   * handlers consult this to swallow the browser's post-drag synthetic click.
   */
  movedRef: { readonly current: boolean };
}

export function usePanZoom(
  imageWidth: number,
  imageHeight: number,
  onLongPress: (imagePoint: { x: number; y: number }) => void,
): PanZoom {
  const [transform, setTransform] = useState<PanZoomTransform>({ tx: 0, ty: 0, scale: 1 });
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const fitScale = useRef(1);

  // Gesture state lives in refs — pointer events must never re-render mid-drag.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startTx: number;
    startTy: number;
    startScale: number;
    startCenter: { x: number; y: number };
    startDistance: number | null;
    moved: boolean;
  } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);
  const current = useRef(transform);
  current.current = transform;

  const clampScale = useCallback((s: number) => {
    const min = fitScale.current * config.map.ZOOM_MIN;
    const max = fitScale.current * config.map.ZOOM_MAX;
    return Math.min(max, Math.max(min, s));
  }, []);

  const fitView = useCallback(() => {
    if (!stageEl || imageWidth === 0) return;
    const scale =
      Math.min(stageEl.clientWidth / imageWidth, stageEl.clientHeight / imageHeight) * 0.98;
    fitScale.current = scale;
    setTransform({
      tx: (stageEl.clientWidth - imageWidth * scale) / 2,
      ty: (stageEl.clientHeight - imageHeight * scale) / 2,
      scale,
    });
  }, [stageEl, imageWidth, imageHeight]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const stageRef = useCallback((el: HTMLDivElement | null) => {
    setStageEl(el);
  }, []);

  // Initial fit — re-runs when the stage mounts (join-first flow) or resizes deps.
  useEffect(() => {
    fitView();
  }, [fitView]);

  useEffect(() => {
    const el = stageEl;
    if (!el) return;

    const localPoint = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const toImage = (p: { x: number; y: number }) => ({
      x: (p.x - current.current.tx) / current.current.scale,
      y: (p.y - current.current.ty) / current.current.scale,
    });

    const onPointerDown = (e: PointerEvent) => {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // A capture failure (pointer already gone) must not kill the gesture.
      }
      pointers.current.set(e.pointerId, localPoint(e));
      const pts = [...pointers.current.values()];
      const center =
        pts.length === 2
          ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
          : pts[0];
      gesture.current = {
        startTx: current.current.tx,
        startTy: current.current.ty,
        startScale: current.current.scale,
        startCenter: center,
        startDistance: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : null,
        moved: false,
      };
      moved.current = false; // a fresh press clears the post-drag click guard
      cancelLongPress();
      if (pts.length === 1) {
        const at = toImage(pts[0]);
        longPressTimer.current = setTimeout(() => {
          longPressTimer.current = null;
          if (
            !gesture.current?.moved &&
            at.x >= 0 && at.y >= 0 && at.x <= imageWidth && at.y <= imageHeight
          ) {
            pointers.current.clear();
            gesture.current = null;
            onLongPress(at);
          }
        }, config.map.LONG_PRESS_MS);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId) || !gesture.current) return;
      pointers.current.set(e.pointerId, localPoint(e));
      const g = gesture.current;
      const pts = [...pointers.current.values()];

      if (pts.length === 2 && g.startDistance !== null && g.startDistance > 0) {
        // Pinch: scale about the gesture-start midpoint, pan with midpoint drift.
        const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const nextScale = clampScale(g.startScale * (distance / g.startDistance));
        const ratio = nextScale / g.startScale;
        g.moved = true;
        moved.current = true;
        cancelLongPress();
        setTransform({
          tx: center.x - (g.startCenter.x - g.startTx) * ratio,
          ty: center.y - (g.startCenter.y - g.startTy) * ratio,
          scale: nextScale,
        });
      } else if (pts.length === 1) {
        const dx = pts[0].x - g.startCenter.x;
        const dy = pts[0].y - g.startCenter.y;
        if (Math.hypot(dx, dy) > config.map.LONG_PRESS_MOVE_PX) {
          g.moved = true;
          moved.current = true;
          cancelLongPress();
        }
        if (g.moved) {
          setTransform({ tx: g.startTx + dx, ty: g.startTy + dy, scale: g.startScale });
        }
      }
    };

    const endPointer = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      cancelLongPress();
      if (pointers.current.size === 0) gesture.current = null;
      else {
        // Two→one finger: rebase the gesture so the remaining finger pans cleanly.
        const [p] = [...pointers.current.values()];
        gesture.current = {
          startTx: current.current.tx,
          startTy: current.current.ty,
          startScale: current.current.scale,
          startCenter: p,
          startDistance: null,
          moved: true,
        };
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const t = current.current;
      const nextScale = clampScale(t.scale * Math.exp(-e.deltaY * 0.0015));
      setTransform({
        tx: cx - ((cx - t.tx) / t.scale) * nextScale,
        ty: cy - ((cy - t.ty) / t.scale) * nextScale,
        scale: nextScale,
      });
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endPointer);
    el.addEventListener("pointercancel", endPointer);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endPointer);
      el.removeEventListener("pointercancel", endPointer);
      el.removeEventListener("wheel", onWheel);
      cancelLongPress();
    };
  }, [stageEl, imageWidth, imageHeight, onLongPress, clampScale, cancelLongPress]);

  return { transform, stageRef, fitView, movedRef: moved };
}
