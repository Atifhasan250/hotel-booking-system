import type { NextRequest } from "next/server";
import { getBookingService } from "../../../../../../src/modules/booking/infrastructure/booking-service-factory";
import { renderInvoiceHtml, resolveBookingActor, safeBookingError } from "../../../../../../src/modules/booking/presentation/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  try {
    const [service, actor, { reference }] = await Promise.all([getBookingService(), resolveBookingActor(request), params]);
    const invoice = await service.getInvoice(actor, reference);
    return new Response(renderInvoiceHtml(invoice), { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.html"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) { return safeBookingError(error); }
}
