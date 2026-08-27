import type { MediaAsset, Property, PublishChecklist, RoomType, VendorOrganization } from "../domain/model";

export function evaluatePublishChecklist(input: {
  vendor: VendorOrganization;
  property: Property;
  rooms: RoomType[];
  media: MediaAsset[];
}): PublishChecklist {
  const missing: string[] = [];
  if (input.vendor.status !== "APPROVED") missing.push("vendor approval");
  if (input.property.description.trim().length < 40) missing.push("property description");
  if (!input.property.districtId) missing.push("district");
  if (!input.property.location.addressLine || !input.property.location.area) missing.push("address");
  if (input.property.location.validationStatus !== "VERIFIED") missing.push("verified location");
  if (!input.property.policies.cancellationSummary) missing.push("cancellation policy");
  if (input.rooms.length === 0) missing.push("active room type");
  if (!input.media.some((asset) => asset.moderationStatus === "APPROVED" && asset.altText.length >= 8)) {
    missing.push("approved property media with alt text");
  }
  return { complete: missing.length === 0, missing };
}
