import { describe, expect, it } from "vitest";
import { createBookingDraftSchema } from "../../src/modules/booking/domain/schemas";
import { assertBookingTransition, canTransitionBooking, InvalidBookingTransitionError } from "../../src/modules/booking/domain/state-machine";
import { createPolicySnapshot, createQuoteSnapshot } from "../../src/modules/booking/domain/snapshots";

const validDraft = {
  propertyId: "property_123",
  roomTypeId: "room_123",
  ratePlanId: "rate_123",
  quoteId: "quote_123",
  checkInDate: "2026-12-01",
  checkOutDate: "2026-12-03",
  roomQuantity: 1,
  occupants: { adults: 2, children: 0 },
  primaryGuest: { fullName: "Test Guest", email: "GUEST@example.com", phone: "+880 1700-000000" },
  consent: { accepted: true as const, policyVersion: "policy_v1" },
  idempotencyKey: "booking:request:001",
};

describe("booking boundary validation", () => {
  it("normalizes a valid guest email and accepts explicit consent", () => {
    const result = createBookingDraftSchema.parse(validDraft);
    expect(result.primaryGuest.email).toBe("guest@example.com");
    expect(result.consent.accepted).toBe(true);
  });

  it("rejects invalid local-date order and absent consent", () => {
    expect(createBookingDraftSchema.safeParse({ ...validDraft, checkOutDate: validDraft.checkInDate }).success).toBe(false);
    expect(createBookingDraftSchema.safeParse({ ...validDraft, consent: { ...validDraft.consent, accepted: false } }).success).toBe(false);
  });

  it("rejects non-integer room and occupant counts", () => {
    expect(createBookingDraftSchema.safeParse({ ...validDraft, roomQuantity: 1.5 }).success).toBe(false);
    expect(createBookingDraftSchema.safeParse({ ...validDraft, occupants: { adults: 1.2, children: 0 } }).success).toBe(false);
  });
});

describe("booking lifecycle", () => {
  it("allows the canonical happy path", () => {
    expect(canTransitionBooking("DRAFT", "HELD")).toBe(true);
    expect(canTransitionBooking("HELD", "PENDING_PAYMENT")).toBe(true);
    expect(canTransitionBooking("PENDING_PAYMENT", "CONFIRMED")).toBe(true);
    expect(canTransitionBooking("CONFIRMED", "CHECKED_IN")).toBe(true);
    expect(canTransitionBooking("CHECKED_IN", "COMPLETED")).toBe(true);
  });

  it("rejects skips, reversals, and transitions out of terminal states", () => {
    expect(() => assertBookingTransition("DRAFT", "CONFIRMED")).toThrow(InvalidBookingTransitionError);
    expect(() => assertBookingTransition("CONFIRMED", "PENDING_PAYMENT")).toThrow("Booking cannot transition");
    expect(() => assertBookingTransition("COMPLETED", "CANCEL_REQUESTED")).toThrow(InvalidBookingTransitionError);
  });

  it("supports explicit payment retry without treating failure as confirmation", () => {
    expect(canTransitionBooking("PENDING_PAYMENT", "PAYMENT_FAILED")).toBe(true);
    expect(canTransitionBooking("PAYMENT_FAILED", "PENDING_PAYMENT")).toBe(true);
    expect(canTransitionBooking("PAYMENT_FAILED", "CONFIRMED")).toBe(false);
  });
});

describe("immutable booking snapshots", () => {
  it("derives integer totals and detaches the quote from mutable inputs", () => {
    const nightlyLines = [{ localDate: "2026-12-01", ratePlanId: "rate_123", baseMinorUnits: 10_000, discountMinorUnits: 1_000, finalMinorUnits: 9_000 }];
    const snapshot = createQuoteSnapshot({
      quoteId: "quote_123",
      currency: "BDT",
      nightlyLines,
      taxLines: [{ code: "approved-tax", label: "Approved tax", minorUnits: 1_350, ruleRevision: "tax_v1", refundableOnCancellation: true }],
      feeLines: [{ code: "approved-fee", label: "Approved fee", minorUnits: 200, ruleRevision: "fee_v1", refundableOnCancellation: false }],
      expiresAt: "2026-12-01T10:15:00.000Z",
      capturedAt: "2026-12-01T10:00:00.000Z",
    });

    nightlyLines[0].baseMinorUnits = 99_999;
    expect(snapshot.subtotalMinorUnits).toBe(10_000);
    expect(snapshot.discountMinorUnits).toBe(1_000);
    expect(snapshot.totalMinorUnits).toBe(10_550);
    expect(snapshot.nightlyLines[0].baseMinorUnits).toBe(10_000);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.nightlyLines[0])).toBe(true);
  });

  it("rejects fractional money and inconsistent nightly arithmetic", () => {
    const base = {
      quoteId: "quote_123", currency: "BDT" as const,
      taxLines: [], feeLines: [], expiresAt: "2026-12-01T10:15:00.000Z", capturedAt: "2026-12-01T10:00:00.000Z",
    };
    expect(() => createQuoteSnapshot({ ...base, nightlyLines: [{ localDate: "2026-12-01", ratePlanId: "rate_123", baseMinorUnits: 100.5, discountMinorUnits: 0, finalMinorUnits: 100.5 }] })).toThrow("safe integer");
    expect(() => createQuoteSnapshot({ ...base, nightlyLines: [{ localDate: "2026-12-01", ratePlanId: "rate_123", baseMinorUnits: 100, discountMinorUnits: 10, finalMinorUnits: 95 }] })).toThrow("arithmetic");
  });

  it("copies and freezes a policy snapshot", () => {
    const input = {
      version: "policy_v1", propertyPolicyRevision: "property_v3", ratePlanPolicyRevision: "rate_v2",
      checkInTime: "14:00", checkOutTime: "11:00", cancellationPolicy: "Owner-approved cancellation text",
      childPolicy: "Owner-approved child policy", extraBedPolicy: "Owner-approved extra-bed policy",
      petPolicy: "Owner-approved pet policy", couplePolicy: "Owner-approved couple policy",
      capturedAt: "2026-12-01T10:00:00.000Z",
    };
    const snapshot = createPolicySnapshot(input);
    input.cancellationPolicy = "changed later";
    expect(snapshot.cancellationPolicy).toBe("Owner-approved cancellation text");
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});
