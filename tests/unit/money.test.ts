import { describe, expect, it } from "vitest";

import { money } from "../../src/shared/money/money";

describe("money", () => {
  it("stores BDT as integer minor units", () => {
    expect(money(125_050)).toEqual({ minorUnits: 125_050, currency: "BDT" });
  });

  it.each([12.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects non-integer or unsafe values: %s",
    (value) => {
      expect(() => money(value)).toThrow("Money minor units must be a safe integer");
    },
  );
});
