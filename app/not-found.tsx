import type { Metadata } from "next";
import Link from "next/link";

import { PublicHeader, publicStyles as styles } from "./_components/public-shell";

export const metadata: Metadata = { title: "Page not found | Book My Room", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main className={styles.page}>
      <PublicHeader />
      <section className={`${styles.content} ${styles.empty}`}>
        <span className={styles.eyebrow}>404 · Trail not found</span>
        <h1>This route ends here.</h1>
        <p>The stay or destination may be unpublished, archived, or the address may be incorrect.</p>
        <Link className={styles.primaryAction} href="/">Return home</Link>
      </section>
    </main>
  );
}
