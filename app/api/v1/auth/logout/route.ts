import { NextRequest, NextResponse } from "next/server";

import { getIdentityService } from "../../../../../src/modules/identity/infrastructure/identity-service-factory";
import { safeAuthError, SESSION_COOKIE } from "../../../../../src/modules/identity/presentation/http";
import { requestSecurityContext, requireSameOrigin } from "../../../../../src/platform/request/request-security";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) await (await getIdentityService()).logout(token, requestSecurityContext(request));
    const response = NextResponse.json({ data: { authenticated: false } });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    return safeAuthError(error);
  }
}
