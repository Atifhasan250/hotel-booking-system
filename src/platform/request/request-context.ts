import { createHash, randomUUID } from "node:crypto";

import type { RequestSecurityContext } from "../../modules/identity/application/identity-service";

function safeHash(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function createRequestSecurityContext(headers: Headers): RequestSecurityContext {
  const requestIdHeader = headers.get("x-request-id");
  const requestId = requestIdHeader && /^[a-zA-Z0-9_-]{8,80}$/.test(requestIdHeader) ? requestIdHeader : randomUUID();
  const userAgent = headers.get("user-agent") ?? "unknown";
  return {
    requestId,
    abuseKey: "server-enforced",
    ipHash: undefined,
    userAgentHash: userAgent === "unknown" ? undefined : safeHash(userAgent),
  };
}
