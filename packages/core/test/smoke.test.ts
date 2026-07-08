import { describe, expect, it } from "vitest";
import rr1010 from "../../../data/samples/rr1010.json" with { type: "json" };

describe("smoke: JSON sample import wiring", () => {
  it("imports the rr1010 sample as JSON in the vitest node project", () => {
    expect(rr1010.data.length).toBe(27);
    expect(rr1010).toHaveProperty("error");
    expect(rr1010).toHaveProperty("error_message");
    expect(rr1010).toHaveProperty("data");
  });
});
