import "server-only";

import type { NextRequest } from "next/server";
import { ZodError } from "zod";

import { SESSION_COOKIE } from "../../identity/presentation/http";
import { getActorResolver } from "../../identity/infrastructure/identity-service-factory";
import { CatalogAuthorizationError, CatalogConflictError, CatalogIncompleteError, CatalogNotFoundError, CatalogRateLimitError } from "../application/errors";

export async function resolveCatalogActor(request: NextRequest) {
  const resolver = await getActorResolver();
  return resolver.resolve(request.cookies.get(SESSION_COOKIE)?.value, new Date());
}

export function safeCatalogError(error: unknown): Response {
  if (error instanceof Error && error.name === "InvalidRequestOriginError") {
    return Response.json({ error: { code: "INVALID_ORIGIN", message: "Request origin was rejected." } }, { status: 403 });
  }
  if (error instanceof CatalogAuthorizationError) {
    return Response.json({ error: { code: "FORBIDDEN", message: "You do not have permission for this catalog action." } }, { status: 403 });
  }
  if (error instanceof CatalogNotFoundError) {
    return Response.json({ error: { code: "NOT_FOUND", message: "The catalog resource was not found." } }, { status: 404 });
  }
  if (error instanceof CatalogRateLimitError) {
    return Response.json({ error: { code: "RATE_LIMITED", message: "Too many catalog changes. Try again later." } }, { status: 429 });
  }
  if (error instanceof CatalogIncompleteError) {
    return Response.json({ error: { code: "CHECKLIST_INCOMPLETE", message: "Complete the publish checklist first.", missing: error.missing } }, { status: 409 });
  }
  if (error instanceof CatalogConflictError) {
    return Response.json({ error: { code: "CATALOG_CONFLICT", message: error.message } }, { status: 409 });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return Response.json({ error: { code: "INVALID_INPUT", message: "Check the submitted catalog fields." } }, { status: 400 });
  }
  return Response.json({ error: { code: "UNAVAILABLE", message: "The catalog service is temporarily unavailable." } }, { status: 503 });
}

export const privateJsonHeaders = { "Cache-Control": "private, no-store" };
