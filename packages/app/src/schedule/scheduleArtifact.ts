/**
 * Bundle-imported FOV 2026 schedule artifact, validated ONCE through core's
 * `parseScheduleArtifact` and memoized (the loadFestivalMap idiom). A failed
 * parse returns null → ScheduleView renders the calm failure state (a bad
 * transcription must never render a half-schedule).
 */
import artifactRaw from "@schedule";
import { parseScheduleArtifact, type ScheduleArtifact } from "@guezzer/core";

let cached: { artifact: ScheduleArtifact | null } | null = null;

export function loadSchedule(): ScheduleArtifact | null {
  cached ??= { artifact: parseScheduleArtifact(artifactRaw) };
  return cached.artifact;
}

let cachedIds: ReadonlySet<string> | null = null;

/** The valid event-id universe — the read-boundary allow-list for picks. */
export function scheduleEventIds(): ReadonlySet<string> {
  cachedIds ??= new Set(loadSchedule()?.events.map((e) => e.id) ?? []);
  return cachedIds;
}
