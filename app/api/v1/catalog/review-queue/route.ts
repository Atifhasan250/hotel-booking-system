import type { NextRequest } from "next/server";

import { getCatalogService } from "../../../../../src/modules/catalog/infrastructure/catalog-service-factory";
import { privateJsonHeaders, resolveCatalogActor, safeCatalogError } from "../../../../../src/modules/catalog/presentation/http";
import { requestSecurityContext } from "../../../../../src/platform/request/request-security";

export async function GET(request: NextRequest) {
  try {
    const [service, actor] = await Promise.all([getCatalogService(), resolveCatalogActor(request)]);
    const context = requestSecurityContext(request);
    const data = await service.reviewQueue(actor, { requestId: context.requestId });
    return Response.json({ data }, { headers: privateJsonHeaders });
  } catch (error) {
    return safeCatalogError(error);
  }
}
