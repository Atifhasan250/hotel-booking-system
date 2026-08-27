import { NextResponse } from "next/server";
import { z } from "zod";
import { getSearchService } from "../../../../src/modules/availability/application/search-service";

// Supported sort values per PROJECT-SPEC §4.
const sortValues = ["PRICE_ASC", "PRICE_DESC", "RATING_DESC", "NEWEST", "MOST_BOOKED"] as const;

const searchSchema = z.object({
  destination: z.string().max(200).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  adults: z.coerce.number().int().min(1).optional(),
  children: z.coerce.number().int().min(0).optional(),
  rooms: z.coerce.number().int().min(1).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  // Comma-separated property types, e.g. "HOTEL,ECO_RESORT"
  propertyTypes: z.string().max(200).optional(),
  // Comma-separated amenity keys, e.g. "wifi,swimming-pool"
  amenities: z.string().max(500).optional(),
  propertyClass: z.enum(["LUXURY", "STANDARD", "BUDGET"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  sort: z.enum(sortValues).default("PRICE_ASC"),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = searchSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search parameters", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const q = parsed.data;

    // Validate that checkOut > checkIn when both are supplied.
    if (q.checkIn && q.checkOut && q.checkOut <= q.checkIn) {
      return NextResponse.json(
        { error: "checkOut must be after checkIn" },
        { status: 400 },
      );
    }

    const service = await getSearchService();

    const result = await service.search({
      destination: q.destination,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      adults: q.adults,
      children: q.children,
      rooms: q.rooms,
      minPrice: q.minPrice,
      maxPrice: q.maxPrice,
      propertyTypes: q.propertyTypes ? q.propertyTypes.split(",").map((t) => t.trim().toUpperCase()) : undefined,
      amenityKeys: q.amenities ? q.amenities.split(",").map((a) => a.trim().toLowerCase()) : undefined,
      propertyClass: q.propertyClass,
      page: q.page,
      limit: q.limit,
      sort: q.sort,
    });

    return NextResponse.json(result, {
      headers: {
        // Do not cache search results; they depend on live availability.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[search] internal error", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
