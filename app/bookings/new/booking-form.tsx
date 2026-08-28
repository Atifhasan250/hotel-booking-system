"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "../booking.module.css";

export default function BookingForm() {
  const query = useSearchParams(); const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget);
    const body = { propertyId: query.get("propertyId"), roomTypeId: query.get("roomTypeId"), ratePlanId: query.get("ratePlanId"), quoteId: query.get("quoteId"), checkInDate: query.get("checkIn"), checkOutDate: query.get("checkOut"), roomQuantity: Number(query.get("rooms") ?? 1), occupants: { adults: Number(query.get("adults") ?? 1), children: Number(query.get("children") ?? 0) }, primaryGuest: { fullName: data.get("fullName"), email: data.get("email"), phone: data.get("phone") }, specialRequests: data.get("specialRequests") || undefined, consent: { accepted: data.get("consent") === "on", policyVersion: query.get("policyVersion") ?? "policy_v1" }, idempotencyKey: crypto.randomUUID() };
    try { const response = await fetch("/api/v1/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? "Reservation failed"); router.push(`/bookings/${payload.data.booking.publicReference}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Reservation failed"); setBusy(false); }
  }
  return <form onSubmit={submit}><div className={styles.grid}><label className={styles.field}><span>Full name</span><input name="fullName" required minLength={2} autoComplete="name" /></label><label className={styles.field}><span>Email</span><input name="email" required type="email" autoComplete="email" /></label><label className={styles.field}><span>Phone</span><input name="phone" required type="tel" autoComplete="tel" /></label><label className={`${styles.field} ${styles.wide}`}><span>Special requests (optional)</span><textarea name="specialRequests" maxLength={500} /></label></div><label className={styles.consent}><input name="consent" type="checkbox" required /><span>I agree to the displayed property, cancellation and guest policies and understand the hold expires.</span></label>{error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.button} disabled={busy}>{busy ? "Holding room…" : "Create reservation hold"}</button></form>;
}
