import { describe, expect, it } from "vitest";

import { mapLegacyCatalog } from "../../scripts/lib/bookmyroom-import.mts";

describe("legacy Book My Room import mapping", () => {
  it("keeps sparse legacy listings staged while preserving room price and media", () => {
    const now = new Date("2026-08-28T12:00:00.000Z");
    const catalog = mapLegacyCatalog({
      now,
      hotels: [{
        id: 971,
        slug: "hotel-1",
        title: { rendered: "Hotel 1" },
        content: { rendered: "" },
        date_gmt: "2026-08-20T16:08:34",
        modified_gmt: "2026-08-20T16:21:41",
        featured_image: "https://bookmyroom.site/wp-content/uploads/2026/08/872397871.jpg",
        hotel_feature: [48],
        tf_hotels_opt: { gallery: "698", map: { address: "Dhaka, Bangladesh" } },
        _embedded: { "wp:term": [[{ id: 86, name: "Dhaka", slug: "dhaka", taxonomy: "hotel_location" }], [], []] },
      }],
      rooms: [{
        id: 973,
        slug: "room-1",
        title: { rendered: "Room 1" },
        content: { rendered: "" },
        tf_room_opt: { tf_hotel: "971", adult: "5", child: "2", bed: "3", "num-room": "10", price: "2998" },
      }],
      destinations: [],
      media: [{
        id: 698,
        source_url: "https://bookmyroom.site/wp-content/uploads/2026/08/gallery.jpg",
        alt_text: "",
        media_details: { width: 1200, height: 800, filesize: 12345 },
      }],
    });

    expect(catalog.properties).toHaveLength(1);
    expect(catalog.properties[0]).toMatchObject({
      _id: "legacy-wp-hotel-971",
      status: "DRAFT",
      districtId: "dhaka",
      location: { validationStatus: "UNVERIFIED" },
    });
    expect(catalog.rooms[0]).toMatchObject({ maxAdults: 5, maxChildren: 2, baseQuantity: 10 });
    expect(catalog.ratePlans[0]).toMatchObject({ roomTypeId: "legacy-wp-room-973", basePrice: 299800 });
    expect(catalog.media.map((asset) => asset.sourceKey)).toEqual(["wp-hotel-971-featured", "wp-media-698"]);
    expect(catalog.destinations[0]).toMatchObject({ slug: "dhaka", status: "DRAFT" });
  });

  it("never maps orphan rooms into the catalog", () => {
    const catalog = mapLegacyCatalog({
      hotels: [],
      rooms: [{ id: 1, title: { rendered: "Orphan" }, tf_room_opt: { tf_hotel: 999, price: "100" } }],
      destinations: [],
      media: [],
    });
    expect(catalog.rooms).toEqual([]);
    expect(catalog.ratePlans).toEqual([]);
  });
});
