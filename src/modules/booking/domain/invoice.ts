import type { BookingInvoice, BookingQuoteSnapshot, InvoiceMerchantSnapshot } from "./model";

export class InvoiceProfileNotReadyError extends Error {
  readonly code = "INVOICE_PROFILE_NOT_READY";

  constructor(message: string) {
    super(message);
    this.name = "InvoiceProfileNotReadyError";
  }
}

export function formatInvoiceNumber(merchantCode: string, year: number, sequence: number): string {
  if (!/^[A-Z0-9]{3,12}$/.test(merchantCode)) throw new InvoiceProfileNotReadyError("Merchant code is invalid");
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new TypeError("Invoice year is invalid");
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99_999_999) throw new TypeError("Invoice sequence is invalid");
  return `BMR-${merchantCode}-${year}-${sequence.toString().padStart(8, "0")}`;
}

export function assertInvoiceMerchantReady(merchant: InvoiceMerchantSnapshot): void {
  if (!merchant.merchantId || !merchant.legalName.trim() || !merchant.issueAddress.trim() || !merchant.profileRevision) {
    throw new InvoiceProfileNotReadyError("Verified merchant legal identity and issue address are required");
  }
  if (merchant.vatRegistered && !merchant.bin?.trim()) {
    throw new InvoiceProfileNotReadyError("A VAT-registered merchant requires a BIN");
  }
  formatInvoiceNumber(merchant.merchantCode, 2000, 1);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function createInvoiceSnapshot(input: {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  bookingReference: string;
  merchant: InvoiceMerchantSnapshot;
  purchaser: { name: string; bin?: string };
  quote: BookingQuoteSnapshot;
  roomDescription: string;
  roomQuantity: number;
  issuedAt: string;
  renderVersion: string;
}): BookingInvoice {
  assertInvoiceMerchantReady(input.merchant);
  if (!input.purchaser.name.trim()) throw new InvoiceProfileNotReadyError("Purchaser name is required");
  if (!Number.isSafeInteger(input.roomQuantity) || input.roomQuantity < 1) throw new TypeError("Room quantity is invalid");
  if (!input.invoiceNumber.startsWith(`BMR-${input.merchant.merchantCode}-`)) {
    throw new InvoiceProfileNotReadyError("Invoice number does not belong to the merchant sequence");
  }
  for (const line of input.quote.nightlyLines) {
    if (line.finalMinorUnits % input.roomQuantity !== 0) {
      throw new TypeError("Nightly total cannot be represented by the invoiced room quantity");
    }
  }
  const invoice: BookingInvoice = {
    id: input.id,
    invoiceNumber: input.invoiceNumber,
    bookingId: input.bookingId,
    bookingReference: input.bookingReference,
    merchant: { ...input.merchant },
    purchaser: { ...input.purchaser },
    lineItems: input.quote.nightlyLines.map((line) => ({
      description: `${input.roomDescription} — ${line.localDate}`,
      quantity: input.roomQuantity,
      unitMinorUnits: line.finalMinorUnits / input.roomQuantity,
      totalMinorUnits: line.finalMinorUnits,
    })),
    quote: {
      ...input.quote,
      nightlyLines: input.quote.nightlyLines.map((line) => ({ ...line })),
      taxLines: input.quote.taxLines.map((line) => ({ ...line })),
      feeLines: input.quote.feeLines.map((line) => ({ ...line })),
    },
    issuedAt: input.issuedAt,
    currency: input.quote.currency,
    renderVersion: input.renderVersion,
  };
  return deepFreeze(invoice);
}
