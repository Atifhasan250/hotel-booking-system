import { describe, expect, it } from "vitest";

import { PROPERTY_CLASSES, PROPERTY_TYPES, REQUIRED_AMENITY_KEYS } from "../../src/modules/catalog/domain/model";
import { amenityDefinitions, catalogMutationSchema } from "../../src/modules/catalog/domain/schemas";

describe("catalog canonical values", () => {
  it("covers every required property type, class, and search amenity", () => {
    expect(PROPERTY_TYPES).toEqual(["HOTEL", "RESORT", "ECO_RESORT", "HOMESTAY", "COTTAGE", "VILLA"]);
    expect(PROPERTY_CLASSES).toEqual(["LUXURY", "STANDARD", "BUDGET"]);
    expect(amenityDefinitions.map((item) => item.key)).toEqual(REQUIRED_AMENITY_KEYS);
  });

  it("rejects unsafe upload extensions and malformed Bangladesh vendor contacts", () => {
    expect(() => catalogMutationSchema.parse({ action: "REQUEST_MEDIA_UPLOAD", vendorId: "vendor-1", propertyId: "property-1", fileName: "payload.svg", mimeType: "image/png" })).toThrow();
    expect(() => catalogMutationSchema.parse({ action: "ONBOARD_VENDOR", idempotencyKey: "request-123456", displayName: "Stay", legalName: "Stay Ltd", contactEmail: "owner@example.test", contactPhone: "+8801111111111" })).toThrow();
  });
});
