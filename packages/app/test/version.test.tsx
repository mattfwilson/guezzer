import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VersionStamp } from "../src/components/VersionStamp.tsx";

describe("VersionStamp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders v<version> · <sha> · built <date> from the build-time globals", () => {
    vi.stubGlobal("__APP_VERSION__", "1.0.0");
    vi.stubGlobal("__GIT_SHA__", "a1b2c3d");
    vi.stubGlobal("__BUILD_DATE__", "2026-08-15");

    const { container } = render(<VersionStamp />);

    // Use container.textContent (not getByText, whose default node-text
    // matcher only looks at direct text-node children) since the SHA
    // segment is wrapped in a nested <span> for tabular-nums styling.
    expect(container.textContent).toBe(
      "v1.0.0 · a1b2c3d · built 2026-08-15",
    );
    expect(container.textContent).toContain("v1.0.0");
    expect(container.textContent).toContain("a1b2c3d");
    expect(container.textContent).toMatch(/built 2026-08-15/);
  });
});
