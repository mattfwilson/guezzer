/**
 * The Sched tab (owner request 2026-07-30): the FOV 2026 schedule as a
 * day-tabbed chronological list where tapping a row toggles "I'm going" and
 * every row wears the attendee dots of whoever's in — the whole crew sees
 * who's going to the same things.
 *
 * Data flow: bundled artifact (core-validated, memoized) + the reactive
 * `schedulePicks` Dexie cache (own row = instant offline toggles;
 * friend rows = last pull/realtime push-through, useScheduleSync). All
 * derivations are pure core (`attendeesByEvent`, time formatting). Friend
 * display names are UNTRUSTED — rendered as React text only.
 */
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  attendeesByEvent,
  formatEventTime,
  identityColorIndex,
  type EventAttendee,
  type ScheduleEvent,
} from "@guezzer/core";
import { useAuthIdentity } from "../auth/useAuthIdentity.ts";
import { config } from "../config.ts";
import { db, type SchedulePickRow } from "../db/db.ts";
import { loadSchedule } from "./scheduleArtifact.ts";
import { toggleOwnPick, useScheduleSync } from "./useScheduleSync.ts";

function venueColor(venue: string): string {
  return config.schedule.VENUE_COLORS[venue] ?? config.schedule.VENUE_COLOR_FALLBACK;
}

/** Small colored initial dot for one attendee (identity palette, D-13 reuse). */
function AttendeeDot({ attendee, isSelf }: { attendee: EventAttendee; isSelf: boolean }) {
  const palette = config.auth.IDENTITY_COLORS;
  const color = palette[identityColorIndex(attendee.userId, palette.length)];
  const label = isSelf ? config.copy.schedule.youLabel : attendee.displayName;
  return (
    <span
      title={label}
      aria-label={label}
      className="flex items-center justify-center rounded-full text-[11px] font-bold"
      style={{
        width: config.schedule.ATTENDEE_DOT_PX,
        height: config.schedule.ATTENDEE_DOT_PX,
        backgroundColor: color,
        color: "#0C0C10",
        boxShadow: isSelf ? "0 0 0 2px #E4E4E7" : "0 0 0 1.5px #0C0C10",
      }}
    >
      {attendee.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function EventRow({
  event,
  going,
  attendees,
  myUserId,
  onToggle,
}: {
  event: ScheduleEvent;
  going: boolean;
  attendees: EventAttendee[];
  myUserId: string | null;
  onToggle: () => void;
}) {
  const copy = config.copy.schedule;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-label={copy.goingAria(event.title, going)}
        aria-pressed={going}
        className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
          going ? "border-accent bg-elevated" : "border-hairline"
        }`}
      >
        {/* time column — fixed width so rows align into a scannable rail */}
        <span className="w-[76px] shrink-0 text-[12px] leading-tight tabular-nums text-text-muted">
          {formatEventTime(event.startMin, event.endMin)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-tight">
            {event.title}
          </span>
          <span
            className="mt-0.5 block text-[11px] font-medium leading-tight"
            style={{ color: venueColor(event.venue) }}
          >
            {event.venue}
          </span>
          {attendees.length > 0 && (
            <span className="mt-1 flex flex-wrap items-center gap-1">
              {attendees.map((attendee) => (
                <AttendeeDot
                  key={attendee.userId}
                  attendee={attendee}
                  isSelf={attendee.userId === myUserId}
                />
              ))}
            </span>
          )}
        </span>

        {/* going check — reinforcement only; the border/bg carries the state too */}
        <span
          aria-hidden
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
            going ? "border-accent bg-accent text-surface" : "border-hairline text-transparent"
          }`}
        >
          <Check size={16} />
        </span>
      </button>
    </li>
  );
}

/** Default to today's column mid-festival; day 1 otherwise. App-tier wall clock only. */
function initialDayIndex(dates: string[]): number {
  const today = new Date().toISOString().slice(0, 10);
  const index = dates.indexOf(today);
  return index >= 0 ? index : 0;
}

export function ScheduleView() {
  const identity = useAuthIdentity();
  const artifact = loadSchedule();
  useScheduleSync(identity);

  const [dayIndex, setDayIndex] = useState(() =>
    initialDayIndex(artifact?.days.map((d) => d.date) ?? []),
  );

  const rows = useLiveQuery(
    () => db.schedulePicks.toArray(),
    [],
    [] as SchedulePickRow[],
  );
  const attendeeIndex = useMemo(() => attendeesByEvent(rows), [rows]);
  const ownPicks = useMemo(
    () => new Set(rows.find((r) => r.userId === identity?.userId)?.eventIds ?? []),
    [rows, identity?.userId],
  );

  const copy = config.copy.schedule;

  if (!artifact) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <h2 className="text-[17px] font-semibold">{copy.loadFailureHeading}</h2>
        <p className="text-[14px] text-text-muted">{copy.loadFailureBody}</p>
      </div>
    );
  }

  const day = artifact.days[Math.min(dayIndex, artifact.days.length - 1)];
  const events = artifact.events
    .filter((event) => event.date === day.date)
    .sort((a, b) => a.startMin - b.startMin || a.venue.localeCompare(b.venue));

  return (
    <div className="flex flex-col gap-3 px-4 pb-6 pt-3">
      <header>
        <h2 className="text-[20px] font-semibold leading-tight">{copy.heading}</h2>
        <p className="mt-0.5 text-[13px] leading-snug text-text-muted">{copy.subheading}</p>
      </header>

      {/* day segmented control */}
      <div className="flex gap-2" role="tablist" aria-label={copy.heading}>
        {artifact.days.map((d, index) => {
          const active = index === dayIndex;
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDayIndex(index)}
              className={`min-h-11 flex-1 rounded-xl border text-[14px] font-semibold ${
                active
                  ? "border-accent bg-accent text-surface"
                  : "border-hairline text-text-muted"
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col gap-2">
        {events.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            going={ownPicks.has(event.id)}
            attendees={attendeeIndex.get(event.id) ?? []}
            myUserId={identity?.userId ?? null}
            onToggle={() => {
              if (identity) void toggleOwnPick(identity, event.id);
            }}
          />
        ))}
      </ul>
    </div>
  );
}
