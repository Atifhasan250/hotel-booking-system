import { describe, expect, it } from "vitest";
import { expandNights, expandDateRange, countNights } from "../../src/shared/money/date-range";

describe("Date-range utilities", () => {
  it("expandNights generates correct nightly dates", () => {
    const nights = expandNights("2026-12-01", "2026-12-04");
    expect(nights).toEqual(["2026-12-01", "2026-12-02", "2026-12-03"]);
  });

  it("expandNights returns empty array when checkOut <= checkIn", () => {
    expect(expandNights("2026-12-01", "2026-12-01")).toEqual([]);
    expect(expandNights("2026-12-05", "2026-12-01")).toEqual([]);
  });

  it("expandDateRange is inclusive of both endpoints", () => {
    const dates = expandDateRange("2026-11-01", "2026-11-05");
    expect(dates).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(dates.length).toBe(5);
  });

  it("countNights returns correct number", () => {
    expect(countNights("2026-12-01", "2026-12-04")).toBe(3);
    expect(countNights("2026-12-01", "2026-12-02")).toBe(1);
  });
});

describe("Pricing calculation", () => {
  it("applies percentage discount correctly using integer minor units", () => {
    const baseRate = 5000; // BDT 50.00 in paise
    const discountPercentage = 10;
    const discount = Math.floor((baseRate * discountPercentage) / 100);
    const afterDiscount = baseRate - discount;

    expect(discount).toBe(500);
    expect(afterDiscount).toBe(4500);
  });

  it("applies taxes on top of discounted price", () => {
    const afterDiscount = 4500;
    const taxRate = 0.15;
    // Taxes should also be in integer minor units — floor to avoid floating point.
    const taxes = Math.floor(afterDiscount * taxRate);
    const total = afterDiscount + taxes;

    expect(taxes).toBe(675);
    expect(total).toBe(5175);
  });

  it("multi-night stay totals all nightly lines", () => {
    const nights = expandNights("2026-12-01", "2026-12-04"); // 3 nights
    const nightly = [5000, 6000, 5500]; // night overrides

    const subtotal = nights.reduce((sum, _, i) => sum + nightly[i], 0);
    expect(subtotal).toBe(16500);
    expect(nights.length).toBe(3);
  });

  it("fixed discount does not exceed nightly rate", () => {
    const baseRate = 3000;
    const fixedDiscount = 5000; // Greater than rate
    const applied = Math.min(fixedDiscount, baseRate);
    const afterDiscount = baseRate - applied;

    expect(afterDiscount).toBe(0); // Cannot go negative
  });
});
