import "server-only";
import type { NextRequest } from "next/server";
import { ZodError } from "zod";
import { SESSION_COOKIE } from "../../identity/presentation/http";
import { getActorResolver } from "../../identity/infrastructure/identity-service-factory";
import { BookingAuthorizationError, BookingConflictError, BookingConfirmationUnavailableError, BookingNotFoundError, BookingRateLimitError } from "../application/errors";
import type { BookingInvoice } from "../domain/model";

export async function resolveBookingActor(request: NextRequest) {
  return (await getActorResolver()).resolve(request.cookies.get(SESSION_COOKIE)?.value, new Date());
}
export const privateBookingHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export function safeBookingError(error: unknown): Response {
  if (error instanceof Error && error.name === "InvalidRequestOriginError") return Response.json({ error: { code: "INVALID_ORIGIN", message: "Request origin was rejected." } }, { status: 403, headers: privateBookingHeaders });
  if (error instanceof BookingAuthorizationError) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in to manage bookings." } }, { status: 401, headers: privateBookingHeaders });
  if (error instanceof BookingNotFoundError) return Response.json({ error: { code: "NOT_FOUND", message: "Booking was not found." } }, { status: 404, headers: privateBookingHeaders });
  if (error instanceof BookingConflictError || error instanceof BookingConfirmationUnavailableError) return Response.json({ error: { code: "BOOKING_CONFLICT", message: error.message } }, { status: 409, headers: privateBookingHeaders });
  if (error instanceof BookingRateLimitError) return Response.json({ error: { code: "RATE_LIMITED", message: "Too many booking attempts. Try later." } }, { status: 429, headers: privateBookingHeaders });
  if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: { code: "INVALID_INPUT", message: "Check the booking details." } }, { status: 400, headers: privateBookingHeaders });
  return Response.json({ error: { code: "UNAVAILABLE", message: "Booking is temporarily unavailable." } }, { status: 503, headers: privateBookingHeaders });
}

export function renderInvoiceHtml(invoice: BookingInvoice) {
  const e = (value: string | number) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const money = (minor: number) => `BDT ${(minor / 100).toFixed(2)}`;
  const rows = invoice.lineItems.map((line) => `<tr><td>${e(line.description)}</td><td>${e(line.quantity)}</td><td>${e(money(line.unitMinorUnits))}</td><td>${e(money(line.totalMinorUnits))}</td></tr>`).join("");
  const taxes = invoice.quote.taxLines.map((line) => `<tr><td colspan="3">${e(line.label)}</td><td>${e(money(line.minorUnits))}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${e(invoice.invoiceNumber)}</title><style>body{font:14px system-ui;margin:40px;color:#17251b}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ccd5ce;text-align:left}.total{font-weight:700}</style></head><body><h1>Book My Room invoice</h1><p><b>${e(invoice.invoiceNumber)}</b><br>Issued ${e(invoice.issuedAt)}</p><h2>Supplier</h2><p>${e(invoice.merchant.legalName)}<br>${e(invoice.merchant.issueAddress)}${invoice.merchant.bin ? `<br>BIN: ${e(invoice.merchant.bin)}` : ""}</p><h2>Purchaser</h2><p>${e(invoice.purchaser.name)}</p><table><thead><tr><th>Supply</th><th>Quantity</th><th>Unit value</th><th>Value</th></tr></thead><tbody>${rows}${taxes}<tr class="total"><td colspan="3">Total</td><td>${e(money(invoice.quote.totalMinorUnits))}</td></tr></tbody></table><p>Booking reference: ${e(invoice.bookingReference)}</p></body></html>`;
}
