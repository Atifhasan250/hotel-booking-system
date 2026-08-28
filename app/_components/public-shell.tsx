import { ArrowRight, MapPin, Star } from "lucide-react";
import Link from "next/link";

import type { PublicPropertyCard as PublicPropertyCardData } from "../../src/modules/catalog/application/public-catalog";
import { formatBdtMinorUnits, propertyTypeLabel } from "../../src/modules/catalog/presentation/public-format";
import { PublicMedia } from "../../src/modules/catalog/presentation/public-media";
import { SiteHeader } from "./site-header";
import styles from "../public.module.css";

export function PublicHeader() {
  return <SiteHeader />;
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PropertyCard({ property }: { property: PublicPropertyCardData }) {
  return (
    <article className={styles.propertyCard}>
      <Link className={styles.cardMedia} href={`/properties/${property.slug}`} aria-label={`View ${property.name}`}>
        <PublicMedia asset={property.media} sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw" />
      </Link>
      <div className={styles.cardBody}>
        <span className={styles.eyebrow}>{propertyTypeLabel(property.propertyType)} · {property.propertyClass.toLowerCase()}</span>
        <h2><Link href={`/properties/${property.slug}`}>{property.name}</Link></h2>
        <p><MapPin size={15} aria-hidden="true" /> {property.area}, {property.districtId}</p>
        <div className={styles.cardMeta}>
          <span>
            {property.startingPriceMinorUnits === null
              ? "Choose dates for price"
              : <>From <strong>{formatBdtMinorUnits(property.startingPriceMinorUnits)}</strong> / night</>}
          </span>
          {property.reviewSummary.count > 0 && property.reviewSummary.average !== null ? (
            <span aria-label={`${property.reviewSummary.average} out of 5 from ${property.reviewSummary.count} verified reviews`}>
              <Star size={14} fill="currentColor" aria-hidden="true" /> {property.reviewSummary.average} ({property.reviewSummary.count})
            </span>
          ) : <span>New listing</span>}
        </div>
        <Link className={styles.cardAction} href={`/properties/${property.slug}`}>View stay <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </article>
  );
}

export function JsonLd({ value }: { value: Record<string, unknown> }) {
  const json = JSON.stringify(value).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export { styles as publicStyles };

