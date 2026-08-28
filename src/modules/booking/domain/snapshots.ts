import type { BookingPolicySnapshot, BookingQuoteSnapshot } from "./model";

type QuoteSnapshotInput = Omit<BookingQuoteSnapshot,
  "nightlyLines" | "taxLines" | "feeLines" | "subtotalMinorUnits" | "discountMinorUnits" |
  "taxMinorUnits" | "feeMinorUnits" | "totalMinorUnits"
> & {
  nightlyLines: Array<BookingQuoteSnapshot["nightlyLines"][number]>;
  taxLines: Array<BookingQuoteSnapshot["taxLines"][number]>;
  feeLines: Array<BookingQuoteSnapshot["feeLines"][number]>;
};

function assertNonNegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }
}

function immutable<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

export function createQuoteSnapshot(input: QuoteSnapshotInput): BookingQuoteSnapshot {
  if (input.nightlyLines.length === 0) throw new TypeError("A quote requires at least one nightly line");

  const nightlyLines = input.nightlyLines.map((line) => {
    assertNonNegativeSafeInteger(line.baseMinorUnits, "baseMinorUnits");
    assertNonNegativeSafeInteger(line.discountMinorUnits, "discountMinorUnits");
    assertNonNegativeSafeInteger(line.finalMinorUnits, "finalMinorUnits");
    if (line.discountMinorUnits > line.baseMinorUnits || line.finalMinorUnits !== line.baseMinorUnits - line.discountMinorUnits) {
      throw new TypeError("Nightly quote line arithmetic is inconsistent");
    }
    return { ...line };
  });
  const taxLines = input.taxLines.map((line) => ({ ...line }));
  const feeLines = input.feeLines.map((line) => ({ ...line }));
  for (const line of [...taxLines, ...feeLines]) assertNonNegativeSafeInteger(line.minorUnits, "line minorUnits");

  const subtotalMinorUnits = nightlyLines.reduce((sum, line) => sum + line.baseMinorUnits, 0);
  const discountMinorUnits = nightlyLines.reduce((sum, line) => sum + line.discountMinorUnits, 0);
  const taxMinorUnits = taxLines.reduce((sum, line) => sum + line.minorUnits, 0);
  const feeMinorUnits = feeLines.reduce((sum, line) => sum + line.minorUnits, 0);
  const totalMinorUnits = subtotalMinorUnits - discountMinorUnits + taxMinorUnits + feeMinorUnits;
  for (const [field, value] of Object.entries({ subtotalMinorUnits, discountMinorUnits, taxMinorUnits, feeMinorUnits, totalMinorUnits })) {
    assertNonNegativeSafeInteger(value, field);
  }

  const snapshot: BookingQuoteSnapshot = {
    ...input,
    nightlyLines,
    taxLines,
    feeLines,
    subtotalMinorUnits,
    discountMinorUnits,
    taxMinorUnits,
    feeMinorUnits,
    totalMinorUnits,
  };
  return immutable(snapshot) as BookingQuoteSnapshot;
}

export function createPolicySnapshot(input: BookingPolicySnapshot): BookingPolicySnapshot {
  return immutable({ ...input }) as BookingPolicySnapshot;
}
