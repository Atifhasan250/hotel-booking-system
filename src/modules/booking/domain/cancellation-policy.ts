import type { Currency } from "../../../shared/money/money";
import type { BookingQuoteSnapshot } from "./model";

export interface CancellationPolicyRuleSnapshot {
  version: "FLEXIBLE_48H_V1";
  source: "PLATFORM_FALLBACK" | "PROPERTY_APPROVED";
  propertyTimezone: string;
  checkInLocalDate: string;
  checkInLocalTime: string;
  freeCancellationCutoffAt: string;
  latePenalty: "FIRST_DISCOUNTED_ROOM_NIGHT";
  noShowPenalty: "FIRST_DISCOUNTED_ROOM_NIGHT";
  capturedAt: string;
}

export interface CancellationPreview {
  policyVersion: string;
  outcome: "NO_ROOM_PENALTY" | "LATE_CANCELLATION" | "NO_SHOW";
  penaltyMinorUnits: number;
  refundableMinorUnits: number;
  currency: Currency;
}

export function evaluateCancellation(input: {
  policy: CancellationPolicyRuleSnapshot;
  quote: BookingQuoteSnapshot;
  requestedAt: Date;
  noShow?: boolean;
}): CancellationPreview {
  const firstNight = input.quote.nightlyLines[0];
  if (!firstNight) throw new TypeError("Cancellation requires a quoted room night");
  const nonRefundableFees = [...input.quote.taxLines, ...input.quote.feeLines]
    .filter((line) => !line.refundableOnCancellation)
    .reduce((sum, line) => sum + line.minorUnits, 0);
  const beforeCutoff = input.requestedAt.toISOString() <= input.policy.freeCancellationCutoffAt;
  const roomPenalty = input.noShow || !beforeCutoff ? firstNight.finalMinorUnits : 0;
  const penaltyMinorUnits = Math.min(input.quote.totalMinorUnits, roomPenalty + nonRefundableFees);
  return Object.freeze({
    policyVersion: input.policy.version,
    outcome: input.noShow ? "NO_SHOW" : beforeCutoff ? "NO_ROOM_PENALTY" : "LATE_CANCELLATION",
    penaltyMinorUnits,
    refundableMinorUnits: input.quote.totalMinorUnits - penaltyMinorUnits,
    currency: input.quote.currency,
  });
}
