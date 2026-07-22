/**
 * GizzMap meeting-pin sheet — the shared <Sheet> primitive in both roles:
 * `draft` (long-press → name it → drop) and `inspect` (tap an existing pin →
 * who dropped it → remove). Pins are stored in lat/lng ALWAYS (each device
 * renders through its own georef fit); creation writes locally with synced=0
 * so an offline drop still lands for the group when signal returns.
 *
 * Anyone can remove any pin — a deliberate 5-friend-scale simplification.
 * Friend-crossing strings (creator name, label) render as React text only.
 */
import { useRef, useState } from "react";
import { config as coreConfig } from "@guezzer/core/config";
import { Sheet } from "../components/Sheet.tsx";
import { config } from "../config.ts";
import { db, type MapPinRow } from "../db/db.ts";
import { randomUUID } from "../uuid.ts";

export type PinSheetState =
  | { kind: "draft"; lat: number; lng: number }
  | { kind: "inspect"; pin: MapPinRow }
  | null;

export function PinSheet({
  state,
  createdBy,
  onClose,
  onDeleted,
}: {
  state: PinSheetState;
  /** Own display name — stamped as the pin creator. */
  createdBy: string;
  onClose: () => void;
  /** Called AFTER the local delete so the view can fire the best-effort relay delete. */
  onDeleted: (pinId: string) => void;
}) {
  const [label, setLabel] = useState("");
  const labelInputRef = useRef<HTMLInputElement>(null);
  const copy = config.copy.map;

  const close = () => {
    setLabel("");
    onClose();
  };

  const drop = async () => {
    if (state?.kind !== "draft") return;
    const trimmed = label.trim().slice(0, coreConfig.map.PIN_LABEL_MAX_LENGTH);
    if (trimmed.length === 0) return;
    await db.mapPins.put({
      pinId: randomUUID(),
      createdBy,
      label: trimmed,
      lat: state.lat,
      lng: state.lng,
      createdAt: Date.now(),
      synced: 0, // the sync loop pushes it (works offline — lands on reconnect)
    });
    close();
  };

  const remove = async () => {
    if (state?.kind !== "inspect") return;
    const { pinId } = state.pin;
    await db.mapPins.delete(pinId); // optimistic local delete
    close();
    onDeleted(pinId);
  };

  if (state?.kind === "draft") {
    return (
      <Sheet
        open
        onClose={close}
        ariaLabel={copy.pinHeading}
        initialFocusRef={labelInputRef}
      >
        <h2 className="text-[17px] font-semibold">{copy.pinHeading}</h2>
        <input
          ref={labelInputRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void drop();
          }}
          placeholder={copy.pinLabelPlaceholder}
          maxLength={coreConfig.map.PIN_LABEL_MAX_LENGTH}
          className="mt-3 w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-[15px]"
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void drop()}
            disabled={label.trim().length === 0}
            className="min-h-11 flex-1 rounded-xl bg-accent font-semibold text-surface disabled:opacity-40"
          >
            {copy.pinCta}
          </button>
          <button
            type="button"
            onClick={close}
            className="min-h-11 flex-1 rounded-xl border border-hairline"
          >
            {copy.pinCancel}
          </button>
        </div>
      </Sheet>
    );
  }

  if (state?.kind === "inspect") {
    return (
      <Sheet open onClose={close} ariaLabel={state.pin.label}>
        <h2 className="text-[17px] font-semibold">{state.pin.label}</h2>
        <p className="mt-1 text-[13px] text-text-muted">
          {copy.pinByLine(state.pin.createdBy)}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void remove()}
            className="min-h-11 flex-1 rounded-xl border border-hairline text-[#EF4444]"
          >
            {copy.pinDelete}
          </button>
          <button
            type="button"
            onClick={close}
            className="min-h-11 flex-1 rounded-xl border border-hairline"
          >
            {copy.pinCancel}
          </button>
        </div>
      </Sheet>
    );
  }

  return null;
}
