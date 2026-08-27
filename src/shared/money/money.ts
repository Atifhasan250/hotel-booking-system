export const SUPPORTED_CURRENCIES = ["BDT"] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export type Money = Readonly<{
  minorUnits: number;
  currency: Currency;
}>;

export function money(minorUnits: number, currency: Currency = "BDT"): Money {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new TypeError("Money minor units must be a safe integer");
  }

  return Object.freeze({ minorUnits, currency });
}
