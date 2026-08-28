# Remote asset inventory

Recorded: 2026-08-27 during M0. This is migration input, not proof of ownership or authorization.

## M4 removal status — 2026-08-28

All inventoried `bookmyroom.site/wp-content` and placeholder-avatar URLs were removed from application rendering.
Hard-coded sample property/destination/testimonial records were removed with them. Until the owner supplies rights-
approved launch media and the assets are uploaded through the environment-scoped ImageKit workflow, the homepage
uses `public/media-awaiting-approval.svg` as an explicit local fallback and public catalog routes render only approved
ImageKit records. This is removal evidence, not a claim that production media migration is complete.

## Legacy catalog migration status — 2026-08-28

The owner-requested importer fetched the live WordPress catalog and uploaded 14 hotel, room and destination images
to the configured ImageKit environment. MongoDB now contains stable staged records for 4 properties, 4 rooms,
11 destinations and 4 rate plans, plus the exact source archive and a recovery snapshot. Read-only verification
confirmed all 14 ImageKit delivery URLs are reachable.

This does not approve publication: imported properties are `DRAFT`, locations are `UNVERIFIED`, and media is
`PENDING` moderation because the legacy source omits required policy/content truth and useful alt text. The logo,
hero, general marketing collage, future-service car image, theme-demo imagery and placeholder avatars were not
silently attached to hotel catalog records.

## Verdict

`app/page.tsx` contains 19 remote image occurrences representing 17 unique image URLs: 16 occurrences from the
`bookmyroom.site/wp-content` reference host (14 unique URLs) and three unique placeholder avatars from
`i.pravatar.cc`. The stylesheet also downloads Manrope and DM Sans from Google Fonts.

The existing images remain temporarily in M0 to avoid a homepage visual regression. Before M4 can pass, operations
must confirm rights/source, approved images must be uploaded to environment-scoped ImageKit folders, metadata and
alt text must be persisted, and every reference-host/placeholder image URL must be removed from production UI.

## Reference-host images

| Current URL | Current use | M4 disposition |
|---|---|---|
| `https://bookmyroom.site/wp-content/uploads/2026/06/Book-My-Room-Logo-1.png` | Header/footer logo | Confirm brand authorization; migrate master logo asset to ImageKit |
| `https://bookmyroom.site/wp-content/uploads/2026/06/ptcosiky3tu.jpg` | Hero/LCP image | Rights review; create responsive ImageKit hero variants |
| `https://bookmyroom.site/wp-content/uploads/2026/06/iupgeszsm_m-1.jpg` | Feature collage | Rights review and ImageKit migration |
| `https://bookmyroom.site/wp-content/uploads/2026/06/Nazimgarh-Garden-Resort-2.webp` | Future-service panel background | Rights review and ImageKit migration/replacement |
| `https://bookmyroom.site/wp-content/uploads/2026/08/Attractive-places-in-Kuakata-1.jpg` | Stay card | Replace with approved property media from catalog |
| `https://bookmyroom.site/wp-content/uploads/2026/08/Chattogram-Hilltop-Panorama-Apartment385140-0.jpg` | Stay card | Replace with approved property media from catalog |
| `https://bookmyroom.site/wp-content/uploads/2026/08/asfges.jpg` | Stay card | Replace with approved property media from catalog |
| `https://bookmyroom.site/wp-content/uploads/2026/08/872397871.jpg` | Stay card | Replace with approved property media from catalog |
| `https://bookmyroom.site/wp-content/uploads/2026/07/Sundarbans.jpg` | Stay/destination cards | Replace with approved catalog/destination media |
| `https://bookmyroom.site/wp-content/uploads/2026/07/Saint-Martins-Island.jpg` | Stay/destination cards | Replace with approved catalog/destination media |
| `https://bookmyroom.site/wp-content/uploads/2026/07/Sreemangal.jpg` | Destination/collage | Replace with approved destination media |
| `https://bookmyroom.site/wp-content/uploads/2026/07/Sajek-Valley-a.jpg` | Destination card | Replace with approved destination media |
| `https://bookmyroom.site/wp-content/uploads/2026/07/Ratargul-Swamp-Forest.jpg` | Destination card | Replace with approved destination media |
| `https://bookmyroom.site/wp-content/uploads/2024/12/Sedan-car.jpeg` | Future Car card | Remove or migrate only when the Car module is separately approved |

## Placeholder avatars

- `https://i.pravatar.cc/80?img=47`
- `https://i.pravatar.cc/80?img=12`
- `https://i.pravatar.cc/80?img=32`

These are not verified customer identities or reviews. Remove them when real, eligible, privacy-approved review data
is introduced; never imply that placeholder people supplied genuine testimonials.

## Other remote dependencies

- `app/globals.css` imports Manrope and DM Sans from `fonts.googleapis.com`. M4 must evaluate `next/font` or an
  approved self-hosted path for privacy, performance, caching, and visual-metric parity before changing it.
- Links to `bookmyroom.site`, `/hotels/`, and `/tours/` are navigation references rather than image assets. M4 must
  replace them with canonical in-app routes as those routes become real.

## Owner-authorized catalog activation — 2026-08-28

- Four property images, five destination images, two room images and Hotel 4's three gallery images were copied into
  the configured ImageKit account; application rendering does not hotlink these catalog assets from WordPress.
- All 14 delivery URLs passed a reachability check. Fresh browser checks also proved an imported homepage card,
  search result and property-detail gallery decode successfully from ImageKit.
- The public catalog now exposes 4 published properties and 11 published destinations, prioritizing the five
  destinations that have imported media. The source-only hero, feature and future-service artwork listed above was
  not represented as hotel catalog media and remains subject to its stated review action.
