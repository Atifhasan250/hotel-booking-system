import { getIdentityService } from "../../../../../src/modules/identity/infrastructure/identity-service-factory";
import { safeAuthError } from "../../../../../src/modules/identity/presentation/http";
import { requestSecurityContext, requireSameOrigin } from "../../../../../src/platform/request/request-security";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await (await getIdentityService()).resetPassword(await request.json(), requestSecurityContext(request));
    return Response.json({ data: { passwordReset: true } });
  } catch (error) {
    return safeAuthError(error);
  }
}
