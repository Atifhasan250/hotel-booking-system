import type { NextRequest } from "next/server";
import { getBookingService } from "../../../../../src/modules/booking/infrastructure/booking-service-factory";
import { privateBookingHeaders, resolveBookingActor, safeBookingError } from "../../../../../src/modules/booking/presentation/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  try {
    const [service, actor, { reference }] = await Promise.all([getBookingService(), resolveBookingActor(request), params]);
    return Response.json({ data: await service.get(actor, reference) }, { headers: privateBookingHeaders });
  } catch (error) { return safeBookingError(error); }
}
