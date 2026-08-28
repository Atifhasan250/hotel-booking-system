import type {
  Destination,
  MediaAsset,
  NearbyPlace,
  Property,
  RoomType,
} from "../domain/model";

export interface PublicReviewSummary {
  count: number;
  average: number | null;
}

export interface PublicPropertyRecord {
  property: Property;
  rooms: RoomType[];
  media: MediaAsset[];
  nearbyPlaces: NearbyPlace[];
  destination: Destination | null;
  reviewSummary: PublicReviewSummary;
  startingPriceMinorUnits: number | null;
}

export interface PublicDestinationRecord {
  destination: Destination;
  media: MediaAsset[];
  properties: PublicPropertyCard[];
}

export interface PublicPropertyCard {
  id: string;
  slug: string;
  name: string;
  propertyType: Property["propertyType"];
  propertyClass: Property["propertyClass"];
  districtId: string;
  area: string;
  amenityKeys: string[];
  media: MediaAsset | null;
  reviewSummary: PublicReviewSummary;
  startingPriceMinorUnits: number | null;
}

export interface PublicCatalogRepository {
  listFeaturedProperties(limit: number): Promise<PublicPropertyCard[]>;
  listPublishedDestinations(limit: number): Promise<PublicDestinationRecord[]>;
  findPublishedPropertyBySlug(slug: string): Promise<PublicPropertyRecord | null>;
  findPublishedDestinationBySlug(slug: string): Promise<PublicDestinationRecord | null>;
  listPublishedSlugs(): Promise<{
    properties: Array<{ slug: string; updatedAt: Date }>;
    destinations: Array<{ slug: string; updatedAt: Date }>;
  }>;
}

export interface PublicHomeDiscovery {
  featuredProperties: PublicPropertyCard[];
  budgetProperties: PublicPropertyCard[];
  ecoResorts: PublicPropertyCard[];
  destinations: PublicDestinationRecord[];
}

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class PublicCatalogService {
  constructor(private readonly repository: PublicCatalogRepository) {}

  async home(): Promise<PublicHomeDiscovery> {
    const [featuredProperties, destinations] = await Promise.all([
      this.repository.listFeaturedProperties(18),
      this.repository.listPublishedDestinations(24),
    ]);
    const homepageDestinations = [...destinations]
      .sort((left, right) => Number(right.media.length > 0) - Number(left.media.length > 0)
        || left.destination.name.localeCompare(right.destination.name))
      .slice(0, 8);

    return {
      featuredProperties: featuredProperties.slice(0, 6),
      budgetProperties: featuredProperties.filter((property) => property.propertyClass === "BUDGET").slice(0, 6),
      ecoResorts: featuredProperties.filter((property) => property.propertyType === "ECO_RESORT").slice(0, 6),
      destinations: homepageDestinations,
    };
  }

  property(slug: string): Promise<PublicPropertyRecord | null> {
    if (!SAFE_SLUG.test(slug)) return Promise.resolve(null);
    return this.repository.findPublishedPropertyBySlug(slug);
  }

  destination(slug: string): Promise<PublicDestinationRecord | null> {
    if (!SAFE_SLUG.test(slug)) return Promise.resolve(null);
    return this.repository.findPublishedDestinationBySlug(slug);
  }

  sitemapEntries() {
    return this.repository.listPublishedSlugs();
  }
}

