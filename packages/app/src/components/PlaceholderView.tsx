import { config } from "../config";

/**
 * Only the routes that still have a placeholder copy entry (show/explore/dex).
 * `#/settings` renders SettingsView instead (Plan 05-05), so it is excluded
 * here — keeping the `placeholders[route]` index exhaustive under `tsc`.
 */
type PlaceholderRoute = keyof typeof config.copy.placeholders;

export function PlaceholderView({ route }: { route: PlaceholderRoute }) {
  const { heading, body } = config.copy.placeholders[route];
  return (
    <div className="flex flex-col items-center pt-16 px-4 text-center">
      <h1 className="text-[20px] font-semibold leading-tight text-text-primary">
        {heading}
      </h1>
      <p className="mt-2 text-base leading-normal text-text-muted">{body}</p>
    </div>
  );
}
