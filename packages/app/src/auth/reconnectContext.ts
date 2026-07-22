/**
 * The reconnecting affordance channel (Plan 18-06, AUTH-08 / D-07). The boot
 * gate ({@link AuthGate}) owns the background auth reconciler and derives a
 * single `reconnecting` boolean — identity present AND (offline OR the Supabase
 * session not yet refreshed while online). It publishes that value here so the
 * Show header's `SyncDot` can render the calm amber "Reconnecting…" glyph
 * WITHOUT prop-drilling through `App` and the route switch.
 *
 * The default is `false` (calm/online) so any component rendered outside the
 * gate's provider — including isolated tests of `ShowView` — reads a stable,
 * non-reconnecting value and behaves exactly as before this seam existed.
 *
 * A pending/failed token refresh is a RECONNECT, never a sign-out (threat
 * T-18-05-A): this channel only tints the dot; it NEVER gates boot or clears
 * the identity (that is the gate's `SIGNED_OUT`-only teardown, D-10).
 */
import { createContext } from "react";

export const ReconnectContext = createContext<boolean>(false);
