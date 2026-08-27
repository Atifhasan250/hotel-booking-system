import type { NextRequest } from "next/server";
import { z } from "zod";

import { getCatalogService } from "../../../../../src/modules/catalog/infrastructure/catalog-service-factory";
import { privateJsonHeaders, resolveCatalogActor, safeCatalogError } from "../../../../../src/modules/catalog/presentation/http";
import { requestSecurityContext } from "../../../../../src/platform/request/request-security";

const querySchema = z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/);

export async function GET(request: NextRequest) {
  try {
    const vendorId = querySchema.parse(request.nextUrl.searchParams.get("vendorId"));
    const [service, actor] = await Promise.all([getCatalogService(), resolveCatalogActor(request)]);
    const context = requestSecurityContext(request);
    const data = await service.vendorWorkspace(actor, vendorId, { requestId: context.requestId });
    return Response.json({ data }, { headers: privateJsonHeaders });
  } catch (error) {
    return safeCatalogError(error);
  }
}
