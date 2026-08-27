import { NextRequest, NextResponse } from "next/server";

import { getIdentityService } from "../../../../../src/modules/identity/infrastructure/identity-service-factory";
import { safeAuthError, SESSION_COOKIE, sessionCookieOptions } from "../../../../../src/modules/identity/presentation/http";
import { requestSecurityContext, requireSameOrigin } from "../../../../../src/platform/request/request-security";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const currentToken = request.cookies.get(SESSION_COOKIE)?.value;
    if (!currentToken) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Sign in is required." } }, { status: 401 });
    const result = await (await getIdentityService()).rotateSession(currentToken, requestSecurityContext(request));
    const response = NextResponse.json({ data: { refreshed: true } });
    response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(result.expiresAt));
    return response;
  } catch (error) {
    return safeAuthError(error);
  }
}
