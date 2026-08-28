import type { Metadata } from "next";

import { PropertyCard, PublicHeader, publicStyles as styles } from "../_components/public-shell";
import { getSearchService, type SearchQuery, type SearchResultProperty } from "../../src/modules/availability/application/search-service";
import type { MediaAsset } from "../../src/modules/catalog/domain/model";

export const metadata: Metadata = {
  title: "Search stays | Book My Room",
  description: "Search approved stays by dates, guests, type and destination.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function value(input: string | string[] | undefined): string | undefined {
  return typeof input === "string" && input.length > 0 ? input : undefined;
}

function positiveInteger(input: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(input);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

function parseQuery(raw: Record<string, string | string[] | undefined>): SearchQuery {
  const sortValues: SearchQuery["sort"][] = ["PRICE_ASC", "PRICE_DESC", "NEWEST"];
  const sort = value(raw.sort) as SearchQuery["sort"] | undefined;
  const propertyType = value(raw.propertyType);
  const childrenValue = Number(value(raw.children));
  return {
    destination: value(raw.destination)?.slice(0, 200),
    checkIn: /^\d{4}-\d{2}-\d{2}$/.test(value(raw.checkIn) ?? "") ? value(raw.checkIn) : undefined,
    checkOut: /^\d{4}-\d{2}-\d{2}$/.test(value(raw.checkOut) ?? "") ? value(raw.checkOut) : undefined,
    adults: positiveInteger(value(raw.adults), 2, 30),
    children: Number.isInteger(childrenValue) && childrenValue >= 0 && childrenValue <= 20 ? childrenValue : 0,
    rooms: positiveInteger(value(raw.rooms), 1, 10),
    propertyTypes: propertyType && ["HOTEL", "RESORT", "ECO_RESORT", "HOMESTAY", "COTTAGE", "VILLA"].includes(propertyType) ? [propertyType] : undefined,
    page: positiveInteger(value(raw.page), 1, 10_000),
    limit: 12,
    sort: sort && sortValues.includes(sort) ? sort : "PRICE_ASC",
  };
}

function validDateRange(query: SearchQuery): boolean {
  return !query.checkIn || !query.checkOut || query.checkOut > query.checkIn;
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseQuery(await searchParams);
  const dateRangeValid = validDateRange(query);
  let discoveryUnavailable = false;
  let result = { data: [] as SearchResultProperty[], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };
  if (dateRangeValid) {
    try {
      result = await (await getSearchService()).search(query);
    } catch (error) {
      discoveryUnavailable = true;
      console.error("Stay search failed", error instanceof Error ? error.name : "UnknownError");
    }
  }

  return (
    <main className={styles.page}>
      <PublicHeader />
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Real catalog · conservative availability</span>
          <h1>Find a stay that fits the journey.</h1>
          <p>Search published properties and date-aware inventory. A final price and hold are created only during the separately verified booking flow.</p>
        </div>
        <aside className={styles.trustPanel}><strong>{result.pagination.total} matching properties</strong><span>Prices are starting nightly rates, not a final stay quote. Taxes and fees are not calculated on this page.</span></aside>
      </section>

      <section className={styles.content} aria-labelledby="search-results">
        <form className={styles.filters} method="get" action="/search">
          <label>Destination or district<input name="destination" defaultValue={query.destination} placeholder="Sreemangal" maxLength={200} /></label>
          <label>Check in<input type="date" name="checkIn" defaultValue={query.checkIn} /></label>
          <label>Check out<input type="date" name="checkOut" defaultValue={query.checkOut} /></label>
          <label>Property type<select name="propertyType" defaultValue={query.propertyTypes?.[0] ?? ""}><option value="">All stay types</option><option value="HOTEL">Hotel</option><option value="RESORT">Resort</option><option value="ECO_RESORT">Eco Resort</option><option value="HOMESTAY">Homestay</option><option value="COTTAGE">Cottage</option><option value="VILLA">Villa</option></select></label>
          <label>Sort<select name="sort" defaultValue={query.sort}><option value="PRICE_ASC">Price: low to high</option><option value="PRICE_DESC">Price: high to low</option><option value="NEWEST">Newest listings</option></select></label>
          <input type="hidden" name="adults" value={query.adults} /><input type="hidden" name="children" value={query.children} /><input type="hidden" name="rooms" value={query.rooms} />
          <button type="submit">Search approved stays</button>
        </form>

        {!dateRangeValid ? (
          <div className={styles.empty} role="alert"><h1>Check-out must follow check-in.</h1><p>Choose at least one night before availability can be evaluated.</p></div>
        ) : discoveryUnavailable ? (
          <div className={styles.empty} role="status"><h1>Search is temporarily unavailable.</h1><p>No availability or price result is being claimed. Please try again after the catalog connection is restored.</p></div>
        ) : result.data.length === 0 ? (
          <div className={styles.empty}><h1>No published match yet.</h1><p>Try a broader destination or property type. We do not add placeholder stays to fill an empty result.</p></div>
        ) : (
          <>
            <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Search results</span><h2 id="search-results">Published stays</h2></div></div>
            <div className={styles.propertyGrid}>
              {result.data.map((property) => <PropertyCard key={property.id} property={{
                id: property.id,
                slug: property.slug,
                name: property.name,
                propertyType: property.propertyType as "HOTEL" | "RESORT" | "ECO_RESORT" | "HOMESTAY" | "COTTAGE" | "VILLA",
                propertyClass: property.propertyClass as "LUXURY" | "STANDARD" | "BUDGET",
                districtId: property.districtId,
                area: property.location.area,
                amenityKeys: property.amenityKeys,
                media: property.thumbnail ? {
                  id: property.thumbnail.id, publicId: property.thumbnail.id, vendorId: "public", ownerType: "PROPERTY", ownerId: property.id,
                  provider: "IMAGEKIT", providerFileId: property.thumbnail.id, filePath: "", url: property.thumbnail.url,
                  width: property.thumbnail.width, height: property.thumbnail.height, format: "webp", bytes: 0,
                  altText: property.thumbnail.altText, sortOrder: 0, moderationStatus: "APPROVED", status: "ACTIVE",
                  createdAt: new Date(0), updatedAt: new Date(0),
                } satisfies MediaAsset : null,
                reviewSummary: { count: property.ratingCount, average: property.ratingCount > 0 ? property.rating : null },
                startingPriceMinorUnits: property.startingPrice > 0 ? property.startingPrice : null,
              }} />)}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
