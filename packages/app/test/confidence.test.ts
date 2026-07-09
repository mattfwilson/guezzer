import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import { formatOrbPercent, isWeakFan } from "../src/show/confidence.ts";

/**
 * Honest confidence display (D-09/D-10, EVAL-04). The orb % is the model's
 * ABSOLUTE score — never a renormalized share of the fan.
 */
describe("formatOrbPercent — orb percent display (absolute, no renormalization)", () => {
  it("orb percent renders the absolute score as round(score*100)%", () => {
    expect(formatOrbPercent(0.24)).toBe("24%");
    expect(formatOrbPercent(0.2)).toBe("20%");
    expect(formatOrbPercent(0.97)).toBe("97%");
  });

  it("orb percent floors a sub-1% score to '<1%', never a bare 0%", () => {
    expect(formatOrbPercent(0.003)).toBe("<1%");
    expect(formatOrbPercent(0)).toBe("<1%");
  });

  it("orb percent never renormalizes — two 0.2 orbs each render 20%, not 50%", () => {
    const fan = [0.2, 0.2];
    const shown = fan.map(formatOrbPercent);
    expect(shown).toEqual(["20%", "20%"]);
  });
});

describe("isWeakFan — weak-fan softening (D-10)", () => {
  it("softening trips when the top orb is below WEAK_FAN_THRESHOLD", () => {
    expect(isWeakFan([{ score: 0.12 }, { score: 0.08 }])).toBe(true);
  });

  it("softening does NOT trip at a healthy 0.20 top score", () => {
    expect(isWeakFan([{ score: 0.2 }, { score: 0.1 }])).toBe(false);
  });

  it("softening reads the config threshold, not an inline literal", () => {
    const justUnder = config.show.WEAK_FAN_THRESHOLD - 0.001;
    const justOver = config.show.WEAK_FAN_THRESHOLD + 0.001;
    expect(isWeakFan([{ score: justUnder }])).toBe(true);
    expect(isWeakFan([{ score: justOver }])).toBe(false);
  });

  it("softening is false for an empty fan (no orbs, nothing to soften)", () => {
    expect(isWeakFan([])).toBe(false);
  });
});
