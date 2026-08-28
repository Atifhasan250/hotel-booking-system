import type { Metadata } from "next";
import Link from "next/link";
import BookingForm from "./booking-form";
import styles from "../booking.module.css";

export const metadata: Metadata = { title: "Reserve your stay | Book My Room", robots: { index: false, follow: false } };
export default function NewBookingPage() {
  return <main className={styles.page}><div className={styles.shell}><Link className={styles.brand} href="/">Book My Room</Link><section className={styles.card}><p className={styles.eyebrow}>Secure reservation</p><h1>Guest details and policy consent</h1><p>Your server quote and room availability are rechecked before a 15-minute hold is created. Payment is not enabled until the verified provider milestone.</p><BookingForm /></section></div></main>;
}
