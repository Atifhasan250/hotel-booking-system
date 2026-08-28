import { describe, expect, it } from "vitest";

import { PublicCatalogService, type PublicCatalogRepository, type PublicPropertyCard } from "../../src/modules/catalog/application/public-catalog";
import { formatBdtMinorUnits, propertyTypeLabel, publicPlaceLabel } from "../../src/modules/catalog/presentation/public-format";

function card(overrides: Partial<PublicPropertyCard> = {}): PublicPropertyCard {
  return {
    id: "property-1",
    slug: "green-valley",
    name: "Green Valley",
    propertyType: "HOTEL",
    propertyClass: "STANDARD",
    districtId: "sylhet",
    area: "Sylhet",
    amenityKeys: ["wifi"],
    media: null,
    reviewSummary: { count: 0, average: null },
    startingPriceMinorUnits: null,
    ...overrides,
  };
}

function repository(properties: PublicPropertyCard[]): PublicCatalogRepository {
  return {
    listFeaturedProperties: async () => properties,
    listPublishedDestinations: async () => [],
    findPublishedPropertyBySlug: async () => null,
    findPublishedDestinationBySlug: async () => null,
    listPublishedSlugs: async () => ({ properties: [], destinations: [] }),
  };
}

describe("public catalog application boundary", () => {
  it("derives truthful budget and eco sections from published cards", async () => {
    const service = new PublicCatalogService(repository([
      card({ id: "budget", propertyClass: "BUDGET" }),
      card({ id: "eco", propertyType: "ECO_RESORT" }),
    ]));

    const home = await service.home();
    expect(home.budgetProperties.map((property) => property.id)).toEqual(["budget"]);
    expect(home.ecoResorts.map((property) => property.id)).toEqual(["eco"]);
  });

  it("rejects unsafe or malformed slugs without querying storage", async () => {
    let queried = false;
    const repo = repository([]);
    repo.findPublishedPropertyBySlug = async () => { queried = true; return null; };
    const service = new PublicCatalogService(repo);

    await expect(service.property("{$ne:null}")).resolves.toBeNull();
    expect(queried).toBe(false);
  });

  it("formats integer BDT minor units without floating-point storage semantics", () => {
    expect(formatBdtMinorUnits(125_050)).toContain("1,250.50");
    expect(propertyTypeLabel("ECO_RESORT")).toBe("Eco Resort");
    expect(() => formatBdtMinorUnits(1.5)).toThrow(/safe integer/);
  });

  it("does not repeat an area when its district id is the same slug", () => {
    expect(publicPlaceLabel("Dhaka", "dhaka")).toBe("Dhaka");
    expect(publicPlaceLabel("Sreemangal", "moulvibazar")).toBe("Sreemangal, Moulvibazar");
  });
});

