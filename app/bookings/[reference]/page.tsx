import type { Metadata } from "next";
import Link from "next/link";
import BookingDetail from "./booking-detail";
import styles from "../booking.module.css";
export const metadata: Metadata = { title: "Booking details | Book My Room", robots: { index: false, follow: false } };
export default async function BookingPage({ params }: { params: Promise<{ reference: string }> }) { const { reference } = await params; return <main className={styles.page}><div className={styles.shell}><Link className={styles.brand} href="/">Book My Room</Link><section className={styles.card}><BookingDetail reference={reference} /></section></div></main>; }
