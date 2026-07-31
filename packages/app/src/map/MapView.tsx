/**
 * GizzMap — the friend map over the georeferenced illustrated festival map
 * (owner-approved exploration 2026-07-21; GSD bypassed by owner).
 *
 * Render pipeline: `loadFestivalMap()` (bundled artifact → memoized georef
 * fit) → `projectToPixel` for every marker → one pan/zoom world div. Friends
 * render at HONEST staleness (core `stalenessTier`: opacity + explicit age
 * copy; `gone` never renders); off-map friends clamp to the stage border
 * with distance + compass toward them. Own dot renders from the LIVE
 * geolocation fix (never the synced echo). All friend-crossing strings
 * (names, statuses, pin labels) render as React text only.
 *
 * Identity is the Phase-18 auth record — no group phrase, no join flow
 * (retired 2026-07-30): everyone signed in is on the map. Degradation ladder
 * (each a calm state, never an error): offline → last-synced state; GPS
 * denied → check-ins/pins still work.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { MapPin as MapPinIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  ageLabel,
  describeOffset,
  pixelToLatLng,
  projectToPixel,
  stalenessTier,
  type GeoPoint,
} from "@guezzer/core";
import { useAuthIdentity } from "../auth/useAuthIdentity.ts";
import { config } from "../config.ts";
import { db, type FriendBeaconRow, type MapPinRow } from "../db/db.ts";
import { AvatarSheet } from "./AvatarSheet.tsx";
import { loadFestivalMap } from "./festival-map.ts";
import {
  clearLegacyGroupMeta,
  getShareLocation,
  MAP_META_KEYS,
  setMyAvatar,
  setMyStatus,
  setShareLocation,
} from "./mapPrefs.ts";
import { deletePinRemote } from "./mapSync.ts";
import { PinSheet, type PinSheetState } from "./PinSheet.tsx";
import { useGeoPosition } from "./useGeoPosition.ts";
import { useMapSync } from "./useMapSync.ts";
import { usePanZoom } from "./usePanZoom.ts";

/** Stable member → palette hue (people are not rarities — disjoint palette, B3). */
function memberColor(memberId: string): string {
  let hash = 0;
  for (let i = 0; i < memberId.length; i++) hash = (hash * 31 + memberId.charCodeAt(i)) | 0;
  const palette = config.map.MEMBER_COLORS;
  return palette[Math.abs(hash) % palette.length];
}

/**
 * Off-map directional pointer: a triangle riding the dot's rim, rotated toward
 * the person's true position (screen-space angle from `place()`, so the map's
 * slight non-north-up rotation is already accounted for).
 */
function OffMapArrow({
  angleDeg,
  color,
  dotRadius,
}: {
  angleDeg: number;
  color: string;
  dotRadius: number;
}) {
  const size = config.map.OFF_MAP_ARROW_SIZE_PX;
  return (
    <span
      aria-hidden
      className="absolute left-1/2 top-1/2"
      style={{ transform: `rotate(${angleDeg}deg)` }}
    >
      <span
        className="block"
        style={{
          transform: `translate(${dotRadius + 3}px, -50%)`,
          width: 0,
          height: 0,
          borderTop: `${size}px solid transparent`,
          borderBottom: `${size}px solid transparent`,
          borderLeft: `${size * 1.6}px solid ${color}`,
          filter: "drop-shadow(0 0 1px #0C0C10)",
        }}
      />
    </span>
  );
}

export function MapView() {
  const mapResult = useMemo(loadFestivalMap, []);
  const identity = useAuthIdentity();
  const [shareLocation, setShare] = useState(true);
  const [pinSheet, setPinSheet] = useState<PinSheetState>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Share preference load + one-time phrase-era credential cleanup.
  useEffect(() => {
    let cancelled = false;
    void clearLegacyGroupMeta();
    void getShareLocation().then((loadedShare) => {
      if (!cancelled) setShare(loadedShare);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Honest-age ticker — staleness opacity/labels re-derive on this cadence.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), config.map.AGE_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const { fix, error: geoError } = useGeoPosition(identity !== null);
  const sync = useMapSync(identity, fix, shareLocation);

  const friends = useLiveQuery(() => db.friendBeacons.toArray(), [], [] as FriendBeaconRow[]);
  const pins = useLiveQuery(() => db.mapPins.toArray(), [], [] as MapPinRow[]);
  const myStatus =
    useLiveQuery(
      async () => (await db.meta.get(MAP_META_KEYS.myStatus))?.value as string | null,
      [],
      null,
    ) ?? null;
  const myAvatar =
    useLiveQuery(
      async () => (await db.meta.get(MAP_META_KEYS.myAvatar))?.value as string | null,
      [],
      null,
    ) ?? null;

  const imageWidth = mapResult.ok ? mapResult.artifact.imageWidth : 0;
  const imageHeight = mapResult.ok ? mapResult.artifact.imageHeight : 0;

  const onLongPress = useCallback(
    (imagePoint: { x: number; y: number }) => {
      if (!mapResult.ok) return;
      const at = pixelToLatLng(mapResult.fit, imagePoint);
      setPinSheet({ kind: "draft", lat: at.lat, lng: at.lng });
    },
    [mapResult],
  );

  const { transform, stageRef, movedRef } = usePanZoom(imageWidth, imageHeight, onLongPress);

  if (!mapResult.ok) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <h2 className="text-[17px] font-semibold">{config.copy.map.loadFailureHeading}</h2>
        <p className="text-[14px] text-text-muted">{config.copy.map.loadFailureBody}</p>
      </div>
    );
  }
  // AuthGate guarantees a signed-in identity before any tab renders — this
  // guard is defensive only (a mid-session sign-out unmounts via the gate).
  if (!identity) return <div className="h-full" />;

  const { fit } = mapResult;
  const copy = config.copy.map;
  const inset = config.map.OFF_MAP_INSET_PX;

  /** Project + clamp; off-map markers pick up a distance chip + directional arrow. */
  const place = (at: GeoPoint) => {
    const px = projectToPixel(fit, at);
    const offMap = px.x < 0 || px.y < 0 || px.x > imageWidth || px.y > imageHeight;
    const x = Math.min(imageWidth - inset / transform.scale, Math.max(inset / transform.scale, px.x));
    const y = Math.min(imageHeight - inset / transform.scale, Math.max(inset / transform.scale, px.y));
    return {
      x,
      y,
      offMap,
      /** Screen-space angle (deg, CSS-rotate clockwise) from the clamped dot toward the person's true position. */
      arrowDeg: offMap ? (Math.atan2(px.y - y, px.x - x) * 180) / Math.PI : 0,
    };
  };
  const offsetOrigin: GeoPoint = fix ?? pixelToLatLng(fit, { x: imageWidth / 2, y: imageHeight / 2 });

  const visibleFriends = friends
    .filter((f) => f.memberId !== identity.userId)
    .map((f) => ({ ...f, tier: stalenessTier(f.updatedAt, now) }))
    .filter(
      (f): f is FriendBeaconRow & { tier: "fresh" | "recent" | "stale" } =>
        f.tier !== "gone",
    );

  return (
    <div className="relative h-full overflow-hidden bg-surface">
      {/* stage — owns pan/zoom/long-press */}
      <div ref={stageRef} className="absolute inset-0 touch-none select-none" style={{ cursor: "grab" }}>
        <div
          className="absolute"
          style={
            {
              transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
              transformOrigin: "0 0",
              "--inv": 1 / transform.scale,
            } as CSSProperties
          }
        >
          <img
            src={mapResult.imageUrl}
            width={imageWidth}
            height={imageHeight}
            alt={`${mapResult.artifact.festival} festival map`}
            draggable={false}
            className="pointer-events-none block max-w-none select-none [-webkit-user-drag:none]"
          />

          {/* meeting pins */}
          {pins.map((pin) => {
            const at = place(pin);
            return (
              <button
                key={pin.pinId}
                type="button"
                onClick={() => {
                  if (!movedRef.current) setPinSheet({ kind: "inspect", pin });
                }}
                className="absolute flex min-h-11 min-w-11 flex-col items-center justify-end"
                style={{
                  left: at.x,
                  top: at.y,
                  transform: "translate(-50%, -100%) scale(var(--inv))",
                  transformOrigin: "50% 100%",
                  opacity: pin.synced === 1 ? 1 : 0.6, // offline-created pins read as pending
                }}
              >
                <span className="rounded-md bg-elevated/90 px-1.5 py-0.5 text-[11px] font-medium">
                  {pin.label}
                </span>
                <MapPinIcon size={26} color={config.share.wordmarkGold} fill="#0C0C10" />
              </button>
            );
          })}

          {/* friends — honest staleness: opacity by tier + explicit age copy */}
          {visibleFriends.map((friend) => {
            const at = place(friend);
            const color = memberColor(friend.memberId);
            const offset = at.offMap
              ? describeOffset(offsetOrigin, { lat: friend.lat, lng: friend.lng })
              : null;
            return (
              <div
                key={friend.memberId}
                className="pointer-events-none absolute flex flex-col items-center"
                style={{
                  left: at.x,
                  top: at.y,
                  transform: "translate(-50%, -50%) scale(var(--inv))",
                  transformOrigin: "50% 50%",
                  opacity: config.map.STALENESS_OPACITY[friend.tier],
                }}
              >
                <span className="relative flex items-center justify-center">
                  {at.offMap && (
                    <OffMapArrow
                      angleDeg={at.arrowDeg}
                      color={color}
                      dotRadius={config.map.MARKER_DIAMETER / 2}
                    />
                  )}
                  <span
                    className="flex items-center justify-center rounded-full font-bold text-surface"
                    style={{
                      width: config.map.MARKER_DIAMETER,
                      height: config.map.MARKER_DIAMETER,
                      backgroundColor: color,
                      boxShadow: "0 0 0 2px #0C0C10",
                      fontSize: friend.avatar ? 16 : 13,
                    }}
                  >
                    {friend.avatar ?? friend.name.slice(0, 1).toUpperCase()}
                  </span>
                </span>
                <span className="mt-0.5 whitespace-nowrap rounded-md bg-elevated/90 px-1.5 py-0.5 text-center text-[11px] leading-tight">
                  <span className="font-semibold">{friend.name}</span>
                  <span className="text-text-muted"> · {ageLabel(friend.updatedAt, now)}</span>
                  {offset && (
                    <span className="block text-text-muted">
                      {copy.offMap((offset.meters / 1000).toFixed(1), offset.compass)}
                    </span>
                  )}
                  {friend.status && <span className="block" style={{ color }}>{friend.status}</span>}
                </span>
              </div>
            );
          })}

          {/* own dot — live fix only, never the synced echo. Clamped to the map
              edge like friends when you're away from the venue (the pre-festival
              at-home state), with distance + compass from the venue toward you. */}
          {fix &&
            (() => {
              const at = place(fix);
              const selfOffset = at.offMap
                ? describeOffset(
                    pixelToLatLng(fit, { x: imageWidth / 2, y: imageHeight / 2 }),
                    fix,
                  )
                : null;
              const ringRadiusPx =
                fix.accuracyM !== null ? fix.accuracyM / mapResult.scaleMPerPx : null;
              const showRing =
                !at.offMap &&
                ringRadiusPx !== null &&
                ringRadiusPx <= imageWidth * config.map.ACCURACY_RING_MAX_FRACTION;
              return (
                <div
                  className="pointer-events-none absolute flex flex-col items-center"
                  style={{
                    left: at.x,
                    top: at.y,
                    transform: "translate(-50%, -50%) scale(var(--inv))",
                    transformOrigin: "50% 50%",
                  }}
                >
                  <span className="relative flex items-center justify-center">
                    {at.offMap && (
                      <OffMapArrow
                        angleDeg={at.arrowDeg}
                        color="#22D3EE"
                        dotRadius={
                          (myAvatar
                            ? config.map.MARKER_DIAMETER
                            : config.map.SELF_MARKER_DIAMETER) / 2
                        }
                      />
                    )}
                    {showRing && (
                      <span
                        className="absolute rounded-full"
                        style={{
                          width: ringRadiusPx * 2,
                          height: ringRadiusPx * 2,
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%) scale(calc(1 / var(--inv)))",
                          backgroundColor: "#22D3EE14",
                          border: "1px solid #22D3EE40",
                        }}
                      />
                    )}
                    {myAvatar ? (
                      <span
                        className="relative flex items-center justify-center rounded-full"
                        style={{
                          width: config.map.MARKER_DIAMETER,
                          height: config.map.MARKER_DIAMETER,
                          backgroundColor: "#22D3EE",
                          boxShadow: "0 0 0 3px #0C0C10",
                          fontSize: 16,
                        }}
                      >
                        {myAvatar}
                      </span>
                    ) : (
                      <span
                        className="relative block rounded-full"
                        style={{
                          width: config.map.SELF_MARKER_DIAMETER,
                          height: config.map.SELF_MARKER_DIAMETER,
                          backgroundColor: "#22D3EE",
                          boxShadow: "0 0 0 3px #0C0C10",
                        }}
                      />
                    )}
                  </span>
                  <span className="mt-0.5 whitespace-nowrap rounded-md bg-elevated/90 px-1.5 py-0.5 text-center text-[11px] leading-tight">
                    <span className="font-semibold" style={{ color: "#22D3EE" }}>
                      {copy.selfLabel}
                    </span>
                    {selfOffset && (
                      <span className="block text-text-muted">
                        {copy.offMap(
                          (selfOffset.meters / 1000).toFixed(1),
                          selfOffset.compass,
                        )}
                      </span>
                    )}
                  </span>
                </div>
              );
            })()}
        </div>
      </div>

      {/* top overlay: sync/share/leave */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 flex items-center gap-2 px-3 pt-2 text-[12px]"
        style={{ zIndex: config.ui.z.content }}
      >
        <span
          aria-label={sync.synced ? "Synced" : "Not synced"}
          className="rounded-full"
          style={{
            width: config.ui.SYNC_DOT_DIAMETER,
            height: config.ui.SYNC_DOT_DIAMETER,
            backgroundColor: sync.synced ? "#22C55E" : "transparent",
            border: sync.synced ? "none" : "1.5px solid #A1A1AA",
          }}
        />
        {geoError !== null && <span className="text-text-muted">{copy.geoDenied}</span>}
        {/* Waiting on the first fix (permission prompt up / GPS searching) — without
            this the no-dot state reads as silent breakage (owner report 2026-07-22). */}
        {geoError === null && !fix && (
          <span className="text-text-muted">{copy.geoLocating}</span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          aria-label={copy.avatarCta}
          title={copy.avatarCta}
          onClick={() => setAvatarOpen(true)}
          className="pointer-events-auto flex min-h-11 min-w-11 items-center justify-center"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-elevated text-[15px]"
            aria-hidden
          >
            {myAvatar ?? identity.displayName.slice(0, 1).toUpperCase()}
          </span>
        </button>
        <label className="pointer-events-auto flex min-h-11 items-center gap-1.5 text-text-muted">
          <input
            type="checkbox"
            checked={shareLocation}
            onChange={(e) => {
              setShare(e.target.checked);
              void setShareLocation(e.target.checked);
            }}
          />
          {copy.shareToggle}
        </label>
      </div>

      {/* status chips — one-tap check-ins; tapping the active chip clears it */}
      <div
        className="absolute bottom-0 left-0 right-0 flex gap-2 overflow-x-auto px-3 pb-3 pt-6"
        style={{
          zIndex: config.ui.z.content,
          background: "linear-gradient(transparent, #0C0C10E6)",
        }}
      >
        {copy.statusPresets.map((preset) => {
          const active = myStatus === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => void setMyStatus(active ? null : preset)}
              className={`min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-[13px] font-medium ${
                active
                  ? "border-accent bg-accent text-surface"
                  : "border-hairline bg-elevated text-text-muted"
              }`}
            >
              {preset}
            </button>
          );
        })}
      </div>

      <PinSheet
        state={pinSheet}
        creator={identity}
        onClose={() => setPinSheet(null)}
        onDeleted={(pinId) => {
          // Best-effort remote delete; a failure means the pin reappears next
          // pull (honest, retryable) rather than silently forking group state.
          void deletePinRemote(pinId);
        }}
      />

      <AvatarSheet
        open={avatarOpen}
        current={myAvatar}
        onClose={() => setAvatarOpen(false)}
        onPick={(avatar) => {
          void setMyAvatar(avatar);
          setAvatarOpen(false);
        }}
      />

    </div>
  );
}
