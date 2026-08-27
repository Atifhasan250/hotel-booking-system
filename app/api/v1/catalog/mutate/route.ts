import type { NextRequest } from "next/server";

import { catalogMutationSchema } from "../../../../../src/modules/catalog/domain/schemas";
import { getCatalogService } from "../../../../../src/modules/catalog/infrastructure/catalog-service-factory";
import { privateJsonHeaders, resolveCatalogActor, safeCatalogError } from "../../../../../src/modules/catalog/presentation/http";
import { requestSecurityContext, requireSameOrigin } from "../../../../../src/platform/request/request-security";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const [service, actor, input] = await Promise.all([
      getCatalogService(),
      resolveCatalogActor(request),
      request.json().then((value) => catalogMutationSchema.parse(value)),
    ]);
    const context = requestSecurityContext(request);
    const data = await service.mutate(actor, input, { requestId: context.requestId });
    return Response.json({ data }, { headers: privateJsonHeaders });
  } catch (error) {
    return safeCatalogError(error);
  }
}
