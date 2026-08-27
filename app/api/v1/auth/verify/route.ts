import { getIdentityService } from "../../../../../src/modules/identity/infrastructure/identity-service-factory";
import { safeAuthError } from "../../../../../src/modules/identity/presentation/http";
import { requestSecurityContext, requireSameOrigin } from "../../../../../src/platform/request/request-security";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    await (await getIdentityService()).verifyContact(body.token, requestSecurityContext(request));
    return Response.json({ data: { verified: true } });
  } catch (error) {
    return safeAuthError(error);
  }
}
