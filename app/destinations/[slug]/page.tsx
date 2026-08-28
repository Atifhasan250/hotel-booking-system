import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs, JsonLd, PropertyCard, PublicHeader, publicStyles as styles } from "../../_components/public-shell";
import { getPublicCatalogService } from "../../../src/modules/catalog/infrastructure/public-catalog-factory";

type Props = { params: Promise<{ slug: string }> };

const getDestination = cache(async (slug: string) => (await getPublicCatalogService()).destination(slug));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const record = await getDestination(slug);
  if (!record) return { title: "Destination not found | Book My Room", robots: { index: false, follow: false } };
  const description = record.destination.summary.slice(0, 155);
  return {
    title: `Stays in ${record.destination.name} | Book My Room`,
    description,
    alternates: { canonical: `/destinations/${record.destination.slug}` },
    openGraph: {
      type: "website",
      url: `/destinations/${record.destination.slug}`,
      title: `Stays in ${record.destination.name}`,
      description,
      images: record.media[0] ? [{ url: record.media[0].url, width: record.media[0].width, height: record.media[0].height, alt: record.media[0].altText }] : undefined,
    },
  };
}

export default async function DestinationPage({ params }: Props) {
  const { slug } = await params;
  const record = await getDestination(slug);
  if (!record) notFound();
  const { destination, properties } = record;

  return (
    <main className={styles.page}>
      <PublicHeader />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: destination.name }]} />
      <JsonLd value={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://bookmyroom.site" },
          { "@type": "ListItem", position: 2, name: destination.name },
        ],
      }} />
      <section className={styles.hero}>
        <div className={styles.destinationIntro}>
          <span className={styles.eyebrow}>{destination.district} · {destination.region}</span>
          <h1>Stay in {destination.name}</h1>
          <p>{destination.summary}</p>
        </div>
        <aside className={styles.trustPanel}>
          <strong>Published inventory only</strong>
          <span>Properties appear here only after vendor, location, policy and media review gates are satisfied.</span>
        </aside>
      </section>
      <section className={styles.content} aria-labelledby="destination-stays">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Approved stays</span><h2 id="destination-stays">Places to stay</h2></div></div>
        {properties.length > 0
          ? <div className={styles.propertyGrid}>{properties.map((property) => <PropertyCard key={property.id} property={property} />)}</div>
          : <div className={styles.empty}><h1>No published stays yet.</h1><p>We do not show placeholder inventory. Check back after local properties complete marketplace review.</p></div>}
      </section>
    </main>
  );
}
