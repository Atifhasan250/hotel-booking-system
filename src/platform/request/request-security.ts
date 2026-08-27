import "server-only";

import type { RequestSecurityContext } from "../../modules/identity/application/identity-service";
import { getServerEnv } from "../config/server-env";
import { isAllowedRequestOrigin } from "./origin-policy";
import { createRequestSecurityContext } from "./request-context";

export class InvalidRequestOriginError extends Error {
  constructor() {
    super("Invalid request origin");
    this.name = "InvalidRequestOriginError";
  }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!isAllowedRequestOrigin(origin, getServerEnv().APP_ORIGIN)) {
    throw new InvalidRequestOriginError();
  }
}

export function requestSecurityContext(request: Request): RequestSecurityContext {
  return createRequestSecurityContext(request.headers);
}
