import { config } from "../config";
import type { Route } from "../routing/useHashRoute";

export function PlaceholderView({ route }: { route: Route }) {
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
