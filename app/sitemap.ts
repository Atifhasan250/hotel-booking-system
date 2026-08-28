import type { MetadataRoute } from "next";

import { getPublicCatalogService } from "../src/modules/catalog/infrastructure/public-catalog-factory";

const origin = "https://bookmyroom.site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const service = await getPublicCatalogService();
  const entries = await service.sitemapEntries();
  return [
    { url: origin, changeFrequency: "daily", priority: 1 },
    ...entries.destinations.map((entry) => ({
      url: `${origin}/destinations/${entry.slug}`,
      lastModified: entry.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...entries.properties.map((entry) => ({
      url: `${origin}/properties/${entry.slug}`,
      lastModified: entry.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];
}
