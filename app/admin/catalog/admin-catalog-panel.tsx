"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, BadgeCheck, Building2, ClipboardCheck, MapPinned } from "lucide-react";
import Link from "next/link";

import styles from "../../vendor/onboarding/catalog-shell.module.css";

export default function AdminCatalogPanel() {
  const [message, setMessage] = useState("Review actions require current server-side admin grants.");

  async function submit(event: FormEvent<HTMLFormElement>, action: "REVIEW_VENDOR" | "REVIEW_PROPERTY") {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const payload = action === "REVIEW_VENDOR"
      ? { action, vendorId: values.get("vendorId"), decision: values.get("decision"), note: values.get("note") }
      : { action, propertyId: values.get("propertyId"), decision: values.get("decision"), note: values.get("note"), locationVerified: values.get("locationVerified") === "on", mediaApproved: values.get("mediaApproved") === "on" };
    setMessage("Recording the reviewed decision…");
    const response = await fetch("/api/v1/catalog/mutate", { method: "POST", headers: { "Content-Type": "application/json", "X-Request-Id": crypto.randomUUID() }, body: JSON.stringify(payload) });
    const result = await response.json();
    setMessage(response.ok ? "Decision recorded with an audit event." : result.error?.message ?? "Review could not be recorded.");
  }

  async function createDestination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setMessage("Creating a private destination draft…");
    const response = await fetch("/api/v1/catalog/mutate", { method: "POST", headers: { "Content-Type": "application/json", "X-Request-Id": crypto.randomUUID() }, body: JSON.stringify({ action: "CREATE_DESTINATION", idempotencyKey: crypto.randomUUID(), name: values.get("name"), slug: values.get("slug"), district: values.get("district"), region: values.get("region"), summary: values.get("summary") }) });
    const result = await response.json();
    setMessage(response.ok ? "Destination saved as a private draft; no launch content was published." : result.error?.message ?? "Destination draft could not be saved.");
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.header}><Link className={styles.brand} href="/"><span>B</span> Book My Room</Link><Link className={styles.back} href="/auth"><ArrowLeft size={17} /> Account</Link></header>
      <section className={styles.hero}><div><p className={styles.kicker}>MARKETPLACE CONTROL · CATALOG</p><h1>Publish evidence, not promises.</h1><p>Vendor ownership, location, media, room facts, and policies must align before a listing becomes public.</p></div><div className={styles.trustCard}><ClipboardCheck /><div><strong>Deny by default.</strong><span>Every decision is permission-checked, state-checked, transaction-coupled, and audited.</span></div></div></section>
      <section className={styles.adminGrid}>
        <form className={styles.card} onSubmit={(event) => submit(event, "REVIEW_VENDOR")}>
          <div className={styles.cardHeading}><Building2 /><div><span>Vendor review</span><h2>Approve the operator</h2></div></div>
          <label>Vendor ID<input name="vendorId" required /></label>
          <label>Decision<select name="decision"><option value="APPROVE">Approve</option><option value="REQUEST_CHANGES">Request changes</option><option value="SUSPEND">Suspend</option></select></label>
          <label>Moderation note<textarea name="note" minLength={3} required rows={4} /></label>
          <button className={styles.primary} type="submit"><BadgeCheck size={17} /> Record vendor decision</button>
        </form>
        <form className={styles.card} onSubmit={(event) => submit(event, "REVIEW_PROPERTY")}>
          <div className={styles.cardHeading}><MapPinned /><div><span>Property review</span><h2>Verify the publish checklist</h2></div></div>
          <label>Property ID<input name="propertyId" required /></label>
          <label>Decision<select name="decision"><option value="PUBLISH">Publish</option><option value="REQUEST_CHANGES">Request changes</option></select></label>
          <div className={styles.checks}><label><input type="checkbox" name="locationVerified" /> Location evidence verified</label><label><input type="checkbox" name="mediaApproved" /> Media rights and metadata approved</label></div>
          <label>Moderation note<textarea name="note" minLength={3} required rows={4} /></label>
          <button className={styles.primary} type="submit"><ClipboardCheck size={17} /> Record property decision</button>
        </form>
        <form className={styles.card} onSubmit={createDestination}>
          <div className={styles.cardHeading}><MapPinned /><div><span>Destination governance</span><h2>Create a private destination draft</h2></div></div>
          <div className={styles.twoCol}><label>Name<input name="name" required /></label><label>Stable slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label><label>District<input name="district" required /></label><label>Region<input name="region" required /></label></div>
          <label>Verified editorial summary<textarea name="summary" minLength={40} required rows={4} /></label>
          <p className={styles.note}>Launch districts, copy, and image rights remain owner/operations decisions. This action never publishes the draft.</p>
          <button className={styles.primary} type="submit"><MapPinned size={17} /> Save destination draft</button>
        </form>
      </section>
      <div className={styles.status} role="status" aria-live="polite">{message}</div>
    </main>
  );
}
