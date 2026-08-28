import type { Metadata } from "next";
import { BedDouble, Clock3, MapPin, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs, JsonLd, PublicHeader, publicStyles as styles } from "../../_components/public-shell";
import { getPublicCatalogService } from "../../../src/modules/catalog/infrastructure/public-catalog-factory";
import { formatBdtMinorUnits, propertyTypeLabel } from "../../../src/modules/catalog/presentation/public-format";
import { PublicMedia } from "../../../src/modules/catalog/presentation/public-media";

type Props = { params: Promise<{ slug: string }> };

const getProperty = cache(async (slug: string) => (await getPublicCatalogService()).property(slug));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const record = await getProperty(slug);
  if (!record) return { title: "Stay not found | Book My Room", robots: { index: false, follow: false } };
  const description = record.property.description.slice(0, 155);
  return {
    title: `${record.property.name} | Book My Room`,
    description,
    alternates: { canonical: `/properties/${record.property.slug}` },
    openGraph: {
      type: "website",
      url: `/properties/${record.property.slug}`,
      title: record.property.name,
      description,
      images: record.media[0] ? [{ url: record.media[0].url, width: record.media[0].width, height: record.media[0].height, alt: record.media[0].altText }] : undefined,
    },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  const record = await getProperty(slug);
  if (!record) notFound();

  const { property, rooms, media, nearbyPlaces, destination, reviewSummary, startingPriceMinorUnits } = record;
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    ...(destination ? [{ label: destination.name, href: `/destinations/${destination.slug}` }] : []),
    { label: property.name },
  ];
  const lodgingSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: property.name,
    description: property.description,
    url: `https://bookmyroom.site/properties/${property.slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: property.location.addressLine,
      addressLocality: property.location.area,
      addressRegion: property.districtId,
      addressCountry: "BD",
      ...(property.location.postalCode ? { postalCode: property.location.postalCode } : {}),
    },
    ...(media.length > 0 ? { image: media.map((asset) => asset.url) } : {}),
    ...(reviewSummary.count > 0 && reviewSummary.average !== null ? {
      aggregateRating: { "@type": "AggregateRating", ratingValue: reviewSummary.average, reviewCount: reviewSummary.count, bestRating: 5, worstRating: 1 },
    } : {}),
  };

  return (
    <main className={styles.page}>
      <PublicHeader />
      <Breadcrumbs items={breadcrumbItems} />
      <JsonLd value={lodgingSchema} />
      <JsonLd value={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.label,
          ...(item.href ? { item: `https://bookmyroom.site${item.href}` } : {}),
        })),
      }} />

      <div className={styles.content}>
        {media.length > 0 ? (
          <section className={styles.gallery} aria-label={`${property.name} gallery`}>
            {media.slice(0, 3).map((asset, index) => (
              <figure className={styles.galleryFigure} key={asset.id}>
                <PublicMedia asset={asset} sizes={index === 0 ? "(max-width: 620px) 100vw, 66vw" : "(max-width: 620px) 100vw, 34vw"} preload={index === 0} />
              </figure>
            ))}
          </section>
        ) : <div className={styles.galleryFigure} aria-label="Property images are awaiting approval" />}

        <div className={styles.detailGrid}>
          <article>
            <span className={styles.eyebrow}>{propertyTypeLabel(property.propertyType)} · {property.propertyClass.toLowerCase()}</span>
            <h1 className={styles.detailTitle}>{property.name}</h1>
            <p className={styles.lede}><MapPin size={18} aria-hidden="true" /> {property.location.area}, {property.districtId}</p>

            <section className={styles.detailSection}>
              <h2>About this stay</h2>
              <p>{property.description}</p>
              <ul className={styles.pills}>{property.amenityKeys.map((amenity) => <li key={amenity}>{amenity.replaceAll("-", " ")}</li>)}</ul>
            </section>

            <section className={styles.detailSection}>
              <h2>Rooms</h2>
              {rooms.length === 0 ? <p>Room details are not currently published.</p> : rooms.map((room) => (
                <article key={room.id}>
                  <h3>{room.name}</h3>
                  <p>{room.description}</p>
                  <ul className={styles.pills}>
                    <li><Users size={14} aria-hidden="true" /> Up to {room.maxAdults} adults and {room.maxChildren} children</li>
                    <li><BedDouble size={14} aria-hidden="true" /> {room.bedConfiguration}</li>
                    <li>{room.airConditioning === "AC" ? "Air conditioned" : "Non-AC"}</li>
                  </ul>
                </article>
              ))}
            </section>

            <section className={styles.detailSection}>
              <h2>Stay policies</h2>
              <p><Clock3 size={15} aria-hidden="true" /> Check-in {property.policies.checkInTime}; check-out {property.policies.checkOutTime}.</p>
              <p>{property.policies.cancellationSummary}</p>
              <p>{property.policies.childPolicy} {property.policies.extraBedPolicy}</p>
              <p>{property.policies.petPolicy} {property.policies.couplePolicy}</p>
            </section>

            <section className={styles.detailSection}>
              <h2>Location and nearby places</h2>
              <p>{property.location.addressLine}, {property.location.area}, {property.districtId}. Map navigation will appear only after a provider and coordinates are verified.</p>
              {nearbyPlaces.length > 0 && <ul>{nearbyPlaces.map((place) => <li key={place.id}>{place.name} · {Math.round(place.distanceMeters / 100) / 10} km</li>)}</ul>}
            </section>

            <section className={styles.detailSection}>
              <h2>Verified guest reviews</h2>
              {reviewSummary.count > 0 && reviewSummary.average !== null
                ? <p>{reviewSummary.average} out of 5 from {reviewSummary.count} eligible published review{reviewSummary.count === 1 ? "" : "s"}. Review text will be shown when the verified-review module is complete.</p>
                : <p>No eligible published reviews yet.</p>}
            </section>
          </article>

          <aside className={styles.bookingPanel} aria-label="Check stay availability">
            <span className={styles.eyebrow}>Live stay search</span>
            <strong>{startingPriceMinorUnits === null ? "Choose dates for pricing" : `From ${formatBdtMinorUnits(startingPriceMinorUnits)} per night`}</strong>
            <p>Displayed rates are starting values, not a final quote. Select dates and guests to evaluate inventory; booking and payment are not enabled in this milestone.</p>
            <Link className={styles.primaryAction} href={`/search?destination=${encodeURIComponent(property.location.area)}`}>Check dates and guests</Link>
            <p><ShieldCheck size={14} aria-hidden="true" /> The server rechecks availability before any future hold.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
