import { NextResponse } from "next/server";

import { getIdentityService } from "../../../../../src/modules/identity/infrastructure/identity-service-factory";
import { safeAuthError, SESSION_COOKIE, sessionCookieOptions } from "../../../../../src/modules/identity/presentation/http";
import { requestSecurityContext, requireSameOrigin } from "../../../../../src/platform/request/request-security";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const service = await getIdentityService();
    const result = await service.login(await request.json(), requestSecurityContext(request));
    const response = NextResponse.json({ data: { authenticated: true } });
    response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(result.expiresAt));
    return response;
  } catch (error) {
    return safeAuthError(error);
  }
}
