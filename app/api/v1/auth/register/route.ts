import { getIdentityService } from "../../../../../src/modules/identity/infrastructure/identity-service-factory";
import { safeAuthError } from "../../../../../src/modules/identity/presentation/http";
import { requestSecurityContext, requireSameOrigin } from "../../../../../src/platform/request/request-security";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const service = await getIdentityService();
    await service.register(await request.json(), requestSecurityContext(request));
    return Response.json({ data: { accepted: true, verificationDelivery: "PENDING" } }, { status: 202 });
  } catch (error) {
    return safeAuthError(error);
  }
}
