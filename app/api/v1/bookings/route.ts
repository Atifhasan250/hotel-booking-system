import type { NextRequest } from "next/server";
import { createBookingDraftSchema } from "../../../../src/modules/booking/domain/schemas";
import { getBookingService } from "../../../../src/modules/booking/infrastructure/booking-service-factory";
import { privateBookingHeaders, resolveBookingActor, safeBookingError } from "../../../../src/modules/booking/presentation/http";
import { requestSecurityContext, requireSameOrigin } from "../../../../src/platform/request/request-security";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const [service, actor, input] = await Promise.all([getBookingService(), resolveBookingActor(request), request.json().then((body) => createBookingDraftSchema.parse(body))]);
    const result = await service.create(actor, input, { requestId: requestSecurityContext(request).requestId });
    return Response.json({ data: result }, { status: result.idempotentReplay ? 200 : 201, headers: privateBookingHeaders });
  } catch (error) { return safeBookingError(error); }
}
