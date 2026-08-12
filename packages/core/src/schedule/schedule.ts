/**
 * Festival schedule domain (owner request 2026-07-30): the committed
 * data/schedule/fov-2026.json artifact (transcribed from the official FOV
 * 2026 poster + Timeland Workshops panel), pick validation at the Supabase
 * read boundary, and the pure who's-going grouping the Sched tab renders.
 *
 * Times are MINUTES from the festival day's midnight; late-night sets keep
 * their poster column by exceeding 1440 (Nikki Nair "Friday 1:30AM" → 1530), so
 * chronological sort within a day never interleaves the previous evening.
 * `endMin: null` = open-ended ("11:30AM start" hikes).
 */
import { z } from "zod";

const eventSchema = z.strictObject({
  /** Stable slug ("fri-castle-1300") — the id friends' picks reference forever. */
  id: z.string().min(1),
  /** Festival day (poster column), ISO date. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venue: z.string().min(1),
  title: z.string().min(1),
  /** Minutes from the day's midnight; past-midnight sets exceed 1440. */
  startMin: z.number().int().min(0).max(2 * 1440),
  endMin: z.number().int().min(0).max(2 * 1440).nullable(),
});

export const scheduleArtifactSchema = z.strictObject({
  schemaVersion: z.literal(1),
  festival: z.string().min(1),
  source: z.string(),
  days: z.array(z.strictObject({ date: z.string(), label: z.string() })).min(1),
  venues: z.array(z.string().min(1)).min(1),
  events: z.array(eventSchema).min(1),
});

export type ScheduleArtifact = z.infer<typeof scheduleArtifactSchema>;
export type ScheduleEvent = ScheduleArtifact["events"][number];

/** Parse the bundled artifact; null on any shape failure (caller shows a calm failure state). */
export function parseScheduleArtifact(raw: unknown): ScheduleArtifact | null {
  const parsed = scheduleArtifactSchema.safeParse(raw);
  if (!parsed.success) return null;
  // Event ids must be unique — a duplicate would silently merge two events'
  // attendee lists, so fail the whole artifact loudly instead.
  const ids = new Set(parsed.data.events.map((e) => e.id));
  if (ids.size !== parsed.data.events.length) return null;
  return parsed.data;
}

/**
 * Validate one untrusted picks payload (a friend's `event_ids` jsonb column)
 * at the read boundary. RLS is write-own, so a friend fully controls their
 * row: non-arrays / non-string members reject the payload (null → row
 * skipped, the validateFriendRow discipline), while UNKNOWN ids are silently
 * DROPPED rather than rejecting — a friend on a newer bundled artifact may
 * legitimately reference events this build doesn't know. Deduped; bounded by
 * the artifact's own event count (a hostile 10k-element array can never
 * bloat state).
 */
export function sanitizeEventIds(
  raw: unknown,
  validIds: ReadonlySet<string>,
): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== "string") return null;
    if (!validIds.has(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= validIds.size) break;
  }
  return out;
}

/** One member's validated picks row (app supplies these from its cache). */
export interface SchedulePicksRow {
  userId: string;
  displayName: string;
  eventIds: string[];
}

export interface EventAttendee {
  userId: string;
  displayName: string;
}

/**
 * The who's-going index: eventId → attendees, each list sorted by
 * displayName then userId so renders are stable across pulls. Pure — the
 * Sched tab looks up each row's event id; events nobody picked are simply
 * absent.
 */
export function attendeesByEvent(
  rows: readonly SchedulePicksRow[],
): Map<string, EventAttendee[]> {
  const index = new Map<string, EventAttendee[]>();
  for (const row of rows) {
    for (const eventId of row.eventIds) {
      const list = index.get(eventId) ?? [];
      list.push({ userId: row.userId, displayName: row.displayName });
      index.set(eventId, list);
    }
  }
  for (const list of index.values()) {
    list.sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName) || a.userId.localeCompare(b.userId),
    );
  }
  return index;
}

/** "600" → "10:00 AM", "1530" → "1:30 AM" (past-midnight wraps to clock time). */
export function minToClock(min: number): string {
  const dayMin = ((min % 1440) + 1440) % 1440;
  const hour24 = Math.floor(dayMin / 60);
  const minute = dayMin % 60;
  const meridiem = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

/** "8:00 PM – 11:00 PM", or just "9:00 AM" for open-ended events. */
export function formatEventTime(startMin: number, endMin: number | null): string {
  return endMin === null
    ? minToClock(startMin)
    : `${minToClock(startMin)} – ${minToClock(endMin)}`;
}
