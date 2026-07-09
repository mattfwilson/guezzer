import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TallyReadout } from "../src/show/TallyReadout.tsx";
import { config } from "../src/config.ts";
import type { Tally } from "../src/show/scoring.ts";

/**
 * TallyReadout render contract (SHOW-09 / D-07). The persistent tally must show
 * the zero-state `0/0 · —` (never a bare 0%), the `{hits}/{total} · {pct}%`
 * form once songs are logged, use `tabular-nums`, and stay text-primary (never
 * accent). Complements the pure deriveTally math in tally.test.ts.
 */
describe("TallyReadout tally rendering (SHOW-09)", () => {
  afterEach(cleanup);

  it("tally zero-state: renders 0/0 · — (never a bare 0%)", () => {
    const zero: Tally = { hits: 0, total: 0, pct: null };
    const { container } = render(<TallyReadout tally={zero} />);

    expect(container.textContent).toBe(config.copy.show.tallyZeroState);
    expect(container.textContent).toBe("0/0 · —");
    expect(container.textContent).not.toMatch(/0%/);
  });

  it("tally populated: renders {hits}/{total} · {pct}% with tabular-nums, not accent", () => {
    const tally: Tally = { hits: 3, total: 4, pct: 75 };
    const { container } = render(<TallyReadout tally={tally} />);
    const el = container.firstElementChild as HTMLElement;

    expect(container.textContent).toBe("3/4 · 75%");
    expect(el.className).toContain("tabular-nums");
    expect(el.className).toContain("text-text-primary");
    // Gold accent is reserved for Start Show / focus ring — never the tally.
    expect(el.className).not.toContain("accent");
  });
});
