import { describe, expect, it } from "vitest";
import { createQuoteSnapshot } from "../../src/modules/booking/domain/snapshots";
import { evaluateCancellation, type CancellationPolicyRuleSnapshot } from "../../src/modules/booking/domain/cancellation-policy";
import { calculateConfiguredTaxLines, TaxProfileNotReadyError } from "../../src/modules/booking/domain/taxes";
import { createInvoiceSnapshot, formatInvoiceNumber, InvoiceProfileNotReadyError } from "../../src/modules/booking/domain/invoice";
import type { InvoiceMerchantSnapshot, MerchantTaxProfile } from "../../src/modules/booking/domain/model";

const approvedTaxProfile: MerchantTaxProfile = {
  id: "tax_profile_1", merchantId: "merchant_1", revision: "tax_2026_1", status: "APPROVED",
  priceMode: "TAX_EXCLUSIVE", effectiveFrom: "2026-01-01T00:00:00.000Z",
  rules: [
    { code: "configured-duty", label: "Configured duty", rateBasisPoints: 1_000, basis: "ROOM_SUBTOTAL", refundableOnCancellation: true },
    { code: "configured-vat", label: "Configured VAT", rateBasisPoints: 1_500, basis: "SUBTOTAL_PLUS_PREVIOUS_TAX", refundableOnCancellation: true },
  ],
  approvedBy: "admin_1", approvedAt: "2025-12-15T00:00:00.000Z",
};

const policy: CancellationPolicyRuleSnapshot = {
  version: "FLEXIBLE_48H_V1", source: "PLATFORM_FALLBACK", propertyTimezone: "Asia/Dhaka",
  checkInLocalDate: "2026-12-10", checkInLocalTime: "14:00",
  freeCancellationCutoffAt: "2026-12-08T08:00:00.000Z", latePenalty: "FIRST_DISCOUNTED_ROOM_NIGHT",
  noShowPenalty: "FIRST_DISCOUNTED_ROOM_NIGHT", capturedAt: "2026-10-01T00:00:00.000Z",
};

function quote() {
  return createQuoteSnapshot({
    quoteId: "quote_123", currency: "BDT",
    nightlyLines: [
      { localDate: "2026-12-10", ratePlanId: "rate_1", baseMinorUnits: 10_000, discountMinorUnits: 1_000, finalMinorUnits: 9_000 },
      { localDate: "2026-12-11", ratePlanId: "rate_1", baseMinorUnits: 10_000, discountMinorUnits: 0, finalMinorUnits: 10_000 },
    ],
    taxLines: calculateConfiguredTaxLines(approvedTaxProfile, 19_000, new Date("2026-10-01T00:00:00.000Z")),
    feeLines: [{ code: "merchant-fee", label: "Approved merchant fee", minorUnits: 200, ruleRevision: "fee_v1", refundableOnCancellation: false }],
    expiresAt: "2026-10-01T00:15:00.000Z", capturedAt: "2026-10-01T00:00:00.000Z",
  });
}

describe("approved merchant tax configuration", () => {
  it("applies ordered integer-basis-point rules with half-up rounding", () => {
    const lines = calculateConfiguredTaxLines(approvedTaxProfile, 10_001, new Date("2026-06-01T00:00:00.000Z"));
    expect(lines.map((line) => line.minorUnits)).toEqual([1_000, 1_650]);
    expect(lines[1].ruleRevision).toBe("tax_2026_1:configured-vat");
  });

  it("fails closed for draft, unapproved, or ineffective profiles", () => {
    expect(() => calculateConfiguredTaxLines({ ...approvedTaxProfile, status: "DRAFT" }, 10_000, new Date("2026-06-01"))).toThrow(TaxProfileNotReadyError);
    expect(() => calculateConfiguredTaxLines({ ...approvedTaxProfile, approvedBy: undefined }, 10_000, new Date("2026-06-01"))).toThrow(TaxProfileNotReadyError);
    expect(() => calculateConfiguredTaxLines(approvedTaxProfile, 10_000, new Date("2025-06-01"))).toThrow(TaxProfileNotReadyError);
  });
});

describe("FLEXIBLE_48H_V1 cancellation preview", () => {
  it("has no room penalty at the exact 48-hour cutoff but keeps explicit non-refundable fees", () => {
    const result = evaluateCancellation({ policy, quote: quote(), requestedAt: new Date(policy.freeCancellationCutoffAt) });
    expect(result.outcome).toBe("NO_ROOM_PENALTY");
    expect(result.penaltyMinorUnits).toBe(200);
  });

  it("charges one discounted night plus configured non-refundable fees after cutoff and for no-show", () => {
    const late = evaluateCancellation({ policy, quote: quote(), requestedAt: new Date("2026-12-08T08:00:00.001Z") });
    const noShow = evaluateCancellation({ policy, quote: quote(), requestedAt: new Date("2026-12-10T08:00:00.000Z"), noShow: true });
    expect(late.penaltyMinorUnits).toBe(9_200);
    expect(noShow.penaltyMinorUnits).toBe(9_200);
  });
});

describe("invoice identity and immutable snapshot", () => {
  const merchant: InvoiceMerchantSnapshot = {
    merchantId: "merchant_1", merchantCode: "DHK001", legalName: "Verified Merchant Ltd",
    issueAddress: "Verified Dhaka address", vatRegistered: true, bin: "VERIFIED-BIN",
    profileRevision: "merchant_v2",
  };

  it("formats an atomic merchant/year sequence and freezes issued facts", () => {
    const invoiceNumber = formatInvoiceNumber("DHK001", 2026, 42);
    const invoice = createInvoiceSnapshot({
      id: "invoice_1", invoiceNumber, bookingId: "booking_1", bookingReference: "BMR-BOOKING-1",
      merchant, purchaser: { name: "Test Guest" }, quote: quote(), roomDescription: "Room stay",
      roomQuantity: 1, issuedAt: "2026-10-01T00:05:00.000Z", renderVersion: "invoice_v1",
    });
    merchant.legalName = "Changed later";
    expect(invoice.invoiceNumber).toBe("BMR-DHK001-2026-00000042");
    expect(invoice.merchant.legalName).toBe("Verified Merchant Ltd");
    expect(Object.isFrozen(invoice.quote.nightlyLines[0])).toBe(true);
  });

  it("rejects missing registered-merchant BIN and mismatched sequence ownership", () => {
    expect(() => createInvoiceSnapshot({
      id: "invoice_1", invoiceNumber: "BMR-DHK001-2026-00000001", bookingId: "booking_1", bookingReference: "booking_ref",
      merchant: { ...merchant, bin: undefined }, purchaser: { name: "Guest" }, quote: quote(), roomDescription: "Room",
      roomQuantity: 1, issuedAt: "2026-10-01T00:05:00.000Z", renderVersion: "invoice_v1",
    })).toThrow(InvoiceProfileNotReadyError);
    expect(() => createInvoiceSnapshot({
      id: "invoice_1", invoiceNumber: "BMR-OTHER-2026-00000001", bookingId: "booking_1", bookingReference: "booking_ref",
      merchant, purchaser: { name: "Guest" }, quote: quote(), roomDescription: "Room",
      roomQuantity: 1, issuedAt: "2026-10-01T00:05:00.000Z", renderVersion: "invoice_v1",
    })).toThrow("does not belong");
  });
});
