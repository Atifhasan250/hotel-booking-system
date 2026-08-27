import type { MapAdapter } from "../application/ports";
import type { Property } from "../domain/model";

export class UnconfiguredMapAdapter implements MapAdapter {
  present(property: Property) {
    return {
      provider: "UNCONFIGURED" as const,
      label: `${property.location.addressLine}, ${property.location.area}`,
    };
  }
}
