import type { Property } from "../domain/model";

const propertyTypeLabels: Record<Property["propertyType"], string> = {
  HOTEL: "Hotel",
  RESORT: "Resort",
  ECO_RESORT: "Eco Resort",
  HOMESTAY: "Homestay",
  COTTAGE: "Cottage",
  VILLA: "Villa",
};

export function propertyTypeLabel(type: Property["propertyType"]): string {
  return propertyTypeLabels[type];
}

export function publicPlaceLabel(area: string, districtId: string): string {
  const normalizedArea = area.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (normalizedArea === districtId.toLowerCase()) return area;
  const district = districtId.split("-").map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "").join(" ");
  return `${area}, ${district}`;
}

export function formatBdtMinorUnits(value: number): string {
  if (!Number.isSafeInteger(value)) throw new TypeError("BDT minor units must be a safe integer");
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: value % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

