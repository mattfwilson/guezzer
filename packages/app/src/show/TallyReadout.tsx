/**
 * The persistent running hit/miss tally (04-UI-SPEC §Layout region 1, SHOW-09 /
 * D-07). Renders `{hits}/{total} · {pct}%` with `tabular-nums` so the digits
 * don't reflow as the show progresses; the zero-state renders `0/0 · —` (never a
 * bare `0%`). Always `text-primary`, NEVER accent — gold stays reserved for
 * Start Show / focus ring (04-UI-SPEC §Color). Analog: VersionStamp.tsx.
 *
 * Dumb + reactive: it renders the `Tally` derived by `useShowSession`
 * (`deriveTally` off the live Dexie entries), so it recomputes automatically
 * after any log / undo / edit — no hand-synced state (SHOW-09).
 */
import { config } from "../config.ts";
import type { Tally } from "./scoring.ts";

interface TallyReadoutProps {
  /** The combined running tally from useShowSession (deriveTally). */
  tally: Tally;
}

export function TallyReadout({ tally }: TallyReadoutProps) {
  const { hits, total, pct } = tally;

  // pct === null is the zero-state (no entries yet) → "0/0 · —" (D-07), never 0%.
  const label =
    pct === null
      ? config.copy.show.tallyZeroState
      : `${hits}/${total} · ${pct}%`;

  return (
    <span
      aria-label={label}
      className="tabular-nums text-[14px] font-semibold leading-tight text-text-primary"
    >
      {label}
    </span>
  );
}
