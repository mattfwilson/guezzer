import { describe, expect, it } from "vitest";
import { config as core } from "@guezzer/core/config";
import { config as app } from "../src/config.ts";

/**
 * WR-01 drift guard. Five Explore constants plus `dex.OWNER_NAME_MAX_LENGTH`
 * are duplicated between `packages/app/src/config.ts` and `@guezzer/core/config`,
 * each annotated "MIRRORS ... the two MUST stay equal." Nothing bound them, so a
 * silent edit to one side could desync — e.g. a lowered core
 * `OWNER_NAME_MAX_LENGTH` the app `maxLength` doesn't follow lets the Settings
 * input accept a name the core schema then hard-rejects at import, failing a
 * legitimate backup merge. This test fails CI loudly on any such drift; delete
 * it only when the constants become a single re-exported source of truth.
 */
describe("app/core config mirror", () => {
  it("explore + dex mirrored keys stay equal", () => {
    expect(app.explore.BARS_TOP_N).toBe(core.explore.BARS_TOP_N);
    expect(app.explore.ROTATION_WINDOW_SHOWS).toBe(
      core.explore.ROTATION_WINDOW_SHOWS,
    );
    expect(app.explore.TOP_K_PER_NODE_DEFAULT).toBe(
      core.explore.TOP_K_PER_NODE_DEFAULT,
    );
    expect(app.explore.TOP_K_PER_NODE_MIN).toBe(core.explore.TOP_K_PER_NODE_MIN);
    expect(app.explore.TOP_K_PER_NODE_MAX).toBe(core.explore.TOP_K_PER_NODE_MAX);
    expect(app.dex.OWNER_NAME_MAX_LENGTH).toBe(core.dex.OWNER_NAME_MAX_LENGTH);
  });
});
