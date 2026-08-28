import { NextResponse } from "next/server";

import { getPublicCatalogService } from "../../../../../src/modules/catalog/infrastructure/public-catalog-factory";
import { propertyTypeLabel } from "../../../../../src/modules/catalog/presentation/public-format";

export async function GET() {
  try {
    const home = await (await getPublicCatalogService()).home();
    return NextResponse.json({
      stays: home.featuredProperties.map((property) => ({
        id: property.id,
        slug: property.slug,
        name: property.name,
        place: `${property.area}, ${property.districtId}`,
        propertyType: propertyTypeLabel(property.propertyType),
        startingPriceMinorUnits: property.startingPriceMinorUnits,
        rating: property.reviewSummary.average,
        ratingCount: property.reviewSummary.count,
        image: property.media ? { url: property.media.url, altText: property.media.altText, width: property.media.width, height: property.media.height } : null,
      })),
      destinations: home.destinations.map(({ destination, media, properties }) => ({
        id: destination.id,
        slug: destination.slug,
        name: destination.name,
        image: media[0] ? { url: media[0].url, altText: media[0].altText, width: media[0].width, height: media[0].height } : null,
        propertyCount: properties.length,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Public homepage discovery failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Public discovery is temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
