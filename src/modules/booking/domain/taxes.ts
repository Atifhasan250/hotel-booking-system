import type { BookingQuoteSnapshot, MerchantTaxProfile } from "./model";

export class TaxProfileNotReadyError extends Error {
  readonly code = "TAX_PROFILE_NOT_READY";

  constructor(message = "An approved, effective merchant tax profile is required") {
    super(message);
    this.name = "TaxProfileNotReadyError";
  }
}

function assertSafeMinorUnits(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError("Taxable amount must be a non-negative safe integer");
}

export function calculateConfiguredTaxLines(
  profile: MerchantTaxProfile,
  roomSubtotalMinorUnits: number,
  at: Date,
): Array<BookingQuoteSnapshot["taxLines"][number]> {
  assertSafeMinorUnits(roomSubtotalMinorUnits);
  const atIso = at.toISOString();
  if (profile.status !== "APPROVED" || !profile.approvedBy || !profile.approvedAt
    || atIso < profile.effectiveFrom || (profile.effectiveTo && atIso >= profile.effectiveTo)) {
    throw new TaxProfileNotReadyError();
  }
  if (profile.priceMode !== "TAX_EXCLUSIVE") throw new TaxProfileNotReadyError("Unsupported merchant tax price mode");

  let previousTaxMinorUnits = 0;
  return profile.rules.map((rule) => {
    if (!Number.isInteger(rule.rateBasisPoints) || rule.rateBasisPoints < 0 || rule.rateBasisPoints > 100_000) {
      throw new TaxProfileNotReadyError("Tax rate must use approved integer basis points");
    }
    const basis = rule.basis === "ROOM_SUBTOTAL"
      ? roomSubtotalMinorUnits
      : roomSubtotalMinorUnits + previousTaxMinorUnits;
    const numerator = BigInt(basis) * BigInt(rule.rateBasisPoints) + BigInt(5_000);
    const minorUnits = Number(numerator / BigInt(10_000));
    assertSafeMinorUnits(minorUnits);
    previousTaxMinorUnits += minorUnits;
    return {
      code: rule.code,
      label: rule.label,
      minorUnits,
      ruleRevision: `${profile.revision}:${rule.code}`,
      refundableOnCancellation: rule.refundableOnCancellation,
    };
  });
}
