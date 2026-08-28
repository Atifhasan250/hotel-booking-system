const SOURCE_ORIGIN = "https://bookmyroom.site";

export const LEGACY_IMPORT_TAG = "bookmyroom-wordpress-v1";
export const LEGACY_VENDOR_ID = "legacy-bookmyroom-site";

type LegacyRecord = Record<string, unknown>;

export interface SourceMedia {
  sourceKey: string;
  sourceUrl: string;
  ownerType: "PROPERTY" | "ROOM_TYPE" | "DESTINATION";
  ownerId: string;
  altText: string;
  width?: number;
  height?: number;
  bytes?: number;
  sortOrder: number;
}

export interface LegacyCatalog {
  vendor: LegacyRecord;
  properties: LegacyRecord[];
  rooms: LegacyRecord[];
  destinations: LegacyRecord[];
  ratePlans: LegacyRecord[];
  media: SourceMedia[];
  archive: LegacyRecord[];
  warnings: string[];
}

const destinationFacts: Record<string, { district: string; region: string; image?: string }> = {
  bandarban: { district: "Bandarban", region: "Chattogram Division" },
  "coxs-bazar": { district: "Cox's Bazar", region: "Chattogram Division" },
  dhaka: { district: "Dhaka", region: "Dhaka Division" },
  kuakata: { district: "Patuakhali", region: "Barishal Division" },
  "lalakhal-sylhet": { district: "Sylhet", region: "Sylhet Division" },
  rangamati: { district: "Rangamati", region: "Chattogram Division" },
  "ratargul-swamp-forest": {
    district: "Sylhet",
    region: "Sylhet Division",
    image: `${SOURCE_ORIGIN}/wp-content/uploads/2026/07/Ratargul-Swamp-Forest.jpg`,
  },
  "saint-martins-island": {
    district: "Cox's Bazar",
    region: "Chattogram Division",
    image: `${SOURCE_ORIGIN}/wp-content/uploads/2026/07/Saint-Martins-Island.jpg`,
  },
  "sajek-valley": {
    district: "Rangamati",
    region: "Chattogram Division",
    image: `${SOURCE_ORIGIN}/wp-content/uploads/2026/07/Sajek-Valley-a.jpg`,
  },
  sreemangal: {
    district: "Moulvibazar",
    region: "Sylhet Division",
    image: `${SOURCE_ORIGIN}/wp-content/uploads/2026/07/Sreemangal.jpg`,
  },
  sundarbans: {
    district: "Khulna",
    region: "Khulna Division",
    image: `${SOURCE_ORIGIN}/wp-content/uploads/2026/07/Sundarbans.jpg`,
  },
};

function plainText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function sourceDate(value: unknown, fallback: Date): Date {
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function title(record: LegacyRecord): string {
  const rendered = (record.title as LegacyRecord | undefined)?.rendered;
  return plainText(rendered) || `Legacy record ${record.id}`;
}

function legacyId(kind: string, value: unknown): string {
  return `legacy-wp-${kind}-${String(value)}`;
}

function galleryIds(hotel: LegacyRecord): number[] {
  const options = hotel.tf_hotels_opt as LegacyRecord | undefined;
  return String(options?.gallery ?? "")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter(Number.isSafeInteger);
}

function embeddedTerm(record: LegacyRecord, taxonomy: string): LegacyRecord | undefined {
  const groups = ((record._embedded as LegacyRecord | undefined)?.["wp:term"] ?? []) as LegacyRecord[][];
  return groups.flat().find((term) => term.taxonomy === taxonomy);
}

function sourceMediaFromWordPress(
  record: LegacyRecord,
  ownerType: SourceMedia["ownerType"],
  ownerId: string,
  fallbackAlt: string,
  sortOrder: number,
  sourceKey?: string,
): SourceMedia | null {
  const sourceUrl = String(record.source_url ?? record.featured_image ?? "");
  if (!sourceUrl.startsWith(`${SOURCE_ORIGIN}/wp-content/uploads/`)) return null;
  const details = record.media_details as LegacyRecord | undefined;
  return {
    sourceKey: sourceKey ?? (record.id ? `wp-media-${record.id}` : `url-${sourceUrl}`),
    sourceUrl,
    ownerType,
    ownerId,
    altText: plainText(record.alt_text) || fallbackAlt,
    width: nonNegativeInteger(details?.width, 0) || undefined,
    height: nonNegativeInteger(details?.height, 0) || undefined,
    bytes: nonNegativeInteger(record.filesize ?? details?.filesize, 0) || undefined,
    sortOrder,
  };
}

function uniqueMedia(media: SourceMedia[]): SourceMedia[] {
  const seen = new Set<string>();
  return media.filter((asset) => {
    if (seen.has(asset.sourceUrl)) return false;
    seen.add(asset.sourceUrl);
    return true;
  });
}

export function mapLegacyCatalog(input: {
  hotels: LegacyRecord[];
  rooms: LegacyRecord[];
  destinations: LegacyRecord[];
  media: LegacyRecord[];
  now?: Date;
}): LegacyCatalog {
  const now = input.now ?? new Date();
  const mediaById = new Map(input.media.map((asset) => [Number(asset.id), asset]));
  const destinationInputs = new Map<string, { id: unknown; name: string; slug: string }>();

  for (const destination of input.destinations) {
    destinationInputs.set(String(destination.slug), {
      id: destination.id,
      name: plainText(destination.name),
      slug: String(destination.slug),
    });
  }
  for (const hotel of input.hotels) {
    const location = embeddedTerm(hotel, "hotel_location");
    if (location?.slug && !destinationInputs.has(String(location.slug))) {
      destinationInputs.set(String(location.slug), {
        id: `hotel-location-${location.id}`,
        name: plainText(location.name),
        slug: String(location.slug),
      });
    }
  }

  const destinations = [...destinationInputs.values()].map((destination) => {
    const facts = destinationFacts[destination.slug] ?? {
      district: destination.name,
      region: "Bangladesh",
    };
    return {
      _id: legacyId("destination", destination.id),
      publicId: legacyId("destination-public", destination.id),
      name: destination.name,
      slug: destination.slug,
      district: facts.district,
      region: facts.region,
      summary: `Legacy destination imported from bookmyroom.site. The source did not include a destination description for ${destination.name}.`,
      status: "DRAFT",
      schemaVersion: 1,
      migrationTag: LEGACY_IMPORT_TAG,
      createdAt: now,
      updatedAt: now,
    };
  });
  const destinationIdBySlug = new Map(destinations.map((destination) => [destination.slug, destination._id]));

  const properties = input.hotels.map((hotel) => {
    const options = (hotel.tf_hotels_opt ?? {}) as LegacyRecord;
    const map = (options.map ?? {}) as LegacyRecord;
    const location = embeddedTerm(hotel, "hotel_location");
    const slug = String(hotel.slug);
    const name = title(hotel);
    const description = plainText((hotel.content as LegacyRecord | undefined)?.rendered)
      || `Legacy listing imported from bookmyroom.site. The source listing did not include a property description for ${name}.`;
    const createdAt = sourceDate(hotel.date_gmt ?? hotel.date, now);
    const updatedAt = sourceDate(hotel.modified_gmt ?? hotel.modified, now);
    const locationSlug = String(location?.slug ?? "");
    return {
      _id: legacyId("hotel", hotel.id),
      publicId: legacyId("hotel-public", hotel.id),
      vendorId: LEGACY_VENDOR_ID,
      name,
      slug,
      propertyType: "HOTEL",
      propertyClass: "STANDARD",
      description,
      districtId: locationSlug || "legacy-unverified-district",
      ...(destinationIdBySlug.get(locationSlug) ? { destinationId: destinationIdBySlug.get(locationSlug) } : {}),
      timezone: "Asia/Dhaka",
      amenityKeys: ((hotel.hotel_feature ?? []) as unknown[]).length > 0 ? ["swimming-pool"] : [],
      policies: {
        checkInTime: "14:00",
        checkOutTime: "11:00",
        cancellationSummary: "Not provided in the legacy source; requires owner verification before publication.",
        childPolicy: "Not provided in the legacy source; requires owner verification before publication.",
        extraBedPolicy: "Not provided in the legacy source; requires owner verification before publication.",
        petPolicy: "Not provided in the legacy source; requires owner verification before publication.",
        couplePolicy: "Not provided in the legacy source; requires owner verification before publication.",
      },
      location: {
        addressLine: plainText(map.address) || "Address not provided in the legacy source",
        area: plainText(location?.name) || "Area not provided",
        countryCode: "BD",
        validationStatus: "UNVERIFIED",
      },
      status: "DRAFT",
      moderationNote: "Imported from the legacy WordPress site. Verify class, policies, address and media rights before publishing.",
      schemaVersion: 1,
      migrationTag: LEGACY_IMPORT_TAG,
      legacySource: { type: "tf_hotel", id: hotel.id, url: hotel.link },
      createdAt,
      updatedAt,
    };
  });

  const propertyIdByLegacyId = new Map(input.hotels.map((hotel) => [String(hotel.id), legacyId("hotel", hotel.id)]));
  const rooms = input.rooms
    .map((room) => {
      const options = (room.tf_room_opt ?? {}) as LegacyRecord;
      const propertyId = propertyIdByLegacyId.get(String(options.tf_hotel));
      if (!propertyId) return null;
      const createdAt = sourceDate(room.date_gmt ?? room.date, now);
      const updatedAt = sourceDate(room.modified_gmt ?? room.modified, now);
      return {
        _id: legacyId("room", room.id),
        publicId: legacyId("room-public", room.id),
        vendorId: LEGACY_VENDOR_ID,
        propertyId,
        name: title(room),
        description: plainText((room.content as LegacyRecord | undefined)?.rendered)
          || `Legacy room imported from bookmyroom.site. The source did not include a room description for ${title(room)}.`,
        maxAdults: positiveInteger(options.adult, 1),
        maxChildren: nonNegativeInteger(options.child, 0),
        bedConfiguration: plainText(options.bed) ? `${plainText(options.bed)} bed(s), legacy source` : "Not provided in the legacy source",
        baseQuantity: positiveInteger(options["num-room"], 1),
        amenityKeys: [],
        airConditioning: "NON_AC",
        status: "ACTIVE",
        schemaVersion: 1,
        migrationTag: LEGACY_IMPORT_TAG,
        legacySource: { type: "tf_room", id: room.id, url: room.link },
        createdAt,
        updatedAt,
      };
    })
    .filter((room): room is NonNullable<typeof room> => room !== null);

  const ratePlans = input.rooms.flatMap((room) => {
    const options = (room.tf_room_opt ?? {}) as LegacyRecord;
    const price = Number(String(options.price ?? ""));
    if (!Number.isFinite(price) || price < 0 || !propertyIdByLegacyId.has(String(options.tf_hotel))) return [];
    const createdAt = sourceDate(room.date_gmt ?? room.date, now).toISOString();
    const updatedAt = sourceDate(room.modified_gmt ?? room.modified, now).toISOString();
    return [{
      _id: legacyId("rate", room.id),
      roomTypeId: legacyId("room", room.id),
      name: "Legacy base rate",
      cancellationPolicy: "Not provided in the legacy source",
      mealPlan: "Not provided in the legacy source",
      occupancyRules: {
        adults: positiveInteger(options.adult, 1),
        children: nonNegativeInteger(options.child, 0),
      },
      basePrice: Math.round(price * 100),
      status: "ACTIVE",
      migrationTag: LEGACY_IMPORT_TAG,
      createdAt,
      updatedAt,
    }];
  });

  const sourceMedia: SourceMedia[] = [];
  for (const hotel of input.hotels) {
    const ownerId = legacyId("hotel", hotel.id);
    const fallbackAlt = `${title(hotel)} legacy property image`;
    const featured = sourceMediaFromWordPress(hotel, "PROPERTY", ownerId, fallbackAlt, 0, `wp-hotel-${hotel.id}-featured`);
    if (featured) sourceMedia.push(featured);
    galleryIds(hotel).forEach((mediaId, index) => {
      const asset = mediaById.get(mediaId);
      if (!asset) return;
      const mapped = sourceMediaFromWordPress(asset, "PROPERTY", ownerId, `${title(hotel)} gallery image ${index + 1}`, index + 1);
      if (mapped) sourceMedia.push(mapped);
    });
  }
  for (const room of input.rooms) {
    const ownerId = legacyId("room", room.id);
    const featured = sourceMediaFromWordPress(room, "ROOM_TYPE", ownerId, `${title(room)} legacy room image`, 0, `wp-room-${room.id}-featured`);
    if (featured) sourceMedia.push(featured);
  }
  for (const destination of destinations) {
    const facts = destinationFacts[destination.slug];
    if (!facts?.image) continue;
    sourceMedia.push({
      sourceKey: `destination-${destination.slug}`,
      sourceUrl: facts.image,
      ownerType: "DESTINATION",
      ownerId: destination._id,
      altText: `${destination.name}, Bangladesh destination view`,
      sortOrder: 0,
    });
  }

  const archive = [
    ...input.hotels.map((payload) => ({ _id: `tf_hotel:${payload.id}`, sourceType: "tf_hotel", sourceId: payload.id, payload })),
    ...input.rooms.map((payload) => ({ _id: `tf_room:${payload.id}`, sourceType: "tf_room", sourceId: payload.id, payload })),
    ...input.destinations.map((payload) => ({ _id: `tour_destination:${payload.id}`, sourceType: "tour_destination", sourceId: payload.id, payload })),
    ...input.media.map((payload) => ({ _id: `media:${payload.id}`, sourceType: "media", sourceId: payload.id, payload })),
  ];

  const warnings = [
    "Imported properties remain DRAFT because the legacy source omits descriptions or publication-gate business data.",
    "Legacy map coordinates are archived but not promoted to verified catalog location data.",
    "Property class, check-in/out times, room defaults and amenity mapping require owner review before publication.",
    "Imported media remains PENDING moderation until image rights and alt text are reviewed.",
  ];

  return {
    vendor: {
      _id: LEGACY_VENDOR_ID,
      publicId: "legacy-bookmyroom-site-public",
      ownerUserId: "legacy-import-unassigned",
      displayName: "Book My Room legacy catalog",
      legalName: "Unverified legacy import",
      normalizedContactEmail: "legacy-import-unassigned@invalid.example",
      contactPhone: "+8801300000000",
      status: "DRAFT",
      onboardingKey: LEGACY_IMPORT_TAG,
      moderationNote: "System staging record only. Assign a verified owner and legal identity before approval.",
      schemaVersion: 1,
      migrationTag: LEGACY_IMPORT_TAG,
      createdAt: now,
      updatedAt: now,
    },
    properties,
    rooms,
    destinations,
    ratePlans,
    media: uniqueMedia(sourceMedia),
    archive,
    warnings,
  };
}

async function fetchJson(url: string, timeoutMs = 20_000): Promise<{ data: LegacyRecord[]; headers: Headers }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Source request failed (${response.status}) for ${new URL(url).pathname}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(`Expected an array from ${new URL(url).pathname}`);
  return { data: data as LegacyRecord[], headers: response.headers };
}

async function fetchAll(restBase: string): Promise<LegacyRecord[]> {
  const firstUrl = `${SOURCE_ORIGIN}/wp-json/wp/v2/${restBase}?per_page=100&page=1&_embed=1`;
  const first = await fetchJson(firstUrl);
  const totalPages = positiveInteger(first.headers.get("x-wp-totalpages"), 1);
  const pages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchJson(
      `${SOURCE_ORIGIN}/wp-json/wp/v2/${restBase}?per_page=100&page=${index + 2}&_embed=1`,
    ).then((result) => result.data)),
  );
  return [first.data, ...pages].flat();
}

export async function fetchLegacyCatalog(): Promise<LegacyCatalog> {
  const [hotels, rooms, destinations] = await Promise.all([
    fetchAll("tf_hotel"),
    fetchAll("tf_room"),
    fetchAll("tour_destination"),
  ]);
  const mediaIds = [...new Set(hotels.flatMap((hotel) => [Number(hotel.featured_media), ...galleryIds(hotel)]).filter(Boolean))];
  const media = mediaIds.length === 0
    ? []
    : (await fetchJson(`${SOURCE_ORIGIN}/wp-json/wp/v2/media?per_page=100&include=${mediaIds.join(",")}`)).data;
  return mapLegacyCatalog({ hotels, rooms, destinations, media });
}
