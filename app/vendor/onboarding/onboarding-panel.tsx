"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Building2, CheckCircle2, ImagePlus, KeyRound, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";

import styles from "./catalog-shell.module.css";

type Status = { tone: "idle" | "busy" | "success" | "error"; message: string };

const initialStatus: Status = { tone: "idle", message: "Start with your organization details." };

export default function OnboardingPanel() {
  const [vendorId, setVendorId] = useState("");
  const [vendorStatus, setVendorStatus] = useState("NOT_STARTED");
  const [propertyId, setPropertyId] = useState("");
  const [status, setStatus] = useState<Status>(initialStatus);
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function mutate(payload: Record<string, unknown>, success: string) {
    setStatus({ tone: "busy", message: "Saving securely…" });
    try {
      const response = await fetch("/api/v1/catalog/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-Id": crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "The request could not be completed.");
      setStatus({ tone: "success", message: success });
      return result.data;
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "The request could not be completed." });
      return null;
    }
  }

  async function onboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const data = await mutate({
      action: "ONBOARD_VENDOR",
      idempotencyKey: crypto.randomUUID(),
      displayName: values.get("displayName"), legalName: values.get("legalName"),
      contactEmail: values.get("contactEmail"), contactPhone: values.get("contactPhone"),
    }, "Organization saved as a draft. Keep the vendor ID for this workspace.");
    if (data?.vendor?.id) {
      setVendorId(data.vendor.id);
      setVendorStatus(data.vendor.status ?? "DRAFT");
    }
  }

  async function submitVendor() {
    const data = await mutate({ action: "SUBMIT_VENDOR", vendorId }, "Organization sent for admin review.");
    if (data?.status) setVendorStatus(data.status);
  }

  async function refreshApproval() {
    setStatus({ tone: "busy", message: "Refreshing approval state…" });
    try {
      const response = await fetch(`/api/v1/catalog/workspace?vendorId=${encodeURIComponent(vendorId)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Approval state could not be refreshed.");
      setVendorStatus(result.data.vendor.status);
      setStatus({ tone: "success", message: result.data.vendor.status === "APPROVED" ? "Organization approved. Property tools are unlocked." : `Current organization state: ${result.data.vendor.status}.` });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Approval state could not be refreshed." });
    }
  }

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const data = await mutate({
      action: "CREATE_PROPERTY", idempotencyKey: crypto.randomUUID(), vendorId,
      name: values.get("name"), slug: values.get("slug"), propertyType: values.get("propertyType"),
      propertyClass: values.get("propertyClass"), description: values.get("description"),
      districtId: values.get("districtId"), ...(values.get("destinationId") ? { destinationId: values.get("destinationId") } : {}), timezone: "Asia/Dhaka",
      amenityKeys: values.getAll("amenities"),
      location: { addressLine: values.get("addressLine"), area: values.get("area"), countryCode: "BD" },
      policies: {
        checkInTime: values.get("checkInTime"), checkOutTime: values.get("checkOutTime"),
        cancellationSummary: values.get("cancellationSummary"), childPolicy: values.get("childPolicy"),
        extraBedPolicy: values.get("extraBedPolicy"), petPolicy: values.get("petPolicy"), couplePolicy: values.get("couplePolicy"),
      },
    }, "Property draft created. Add a room and approved media before review.");
    if (data?.property?.id) setPropertyId(data.property.id);
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await mutate({
      action: "CREATE_ROOM_TYPE", idempotencyKey: crypto.randomUUID(), vendorId, propertyId,
      name: values.get("roomName"), description: values.get("roomDescription"),
      maxAdults: Number(values.get("maxAdults")), maxChildren: Number(values.get("maxChildren")),
      bedConfiguration: values.get("beds"), baseQuantity: Number(values.get("quantity")), amenityKeys: ["wifi"],
      airConditioning: values.get("airConditioning"),
    }, "Room type added to the property draft.");
  }

  async function createNearbyPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await mutate({
      action: "CREATE_NEARBY_PLACE", idempotencyKey: crypto.randomUUID(), vendorId, propertyId,
      name: values.get("nearbyName"), type: values.get("nearbyType"), distanceMeters: Number(values.get("distanceMeters")),
    }, "Nearby place added for admin verification.");
  }

  async function authorizeUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const file = values.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setStatus({ tone: "error", message: "Choose a JPEG, PNG, or WebP image first." });
      return;
    }
    const credential = await mutate({ action: "REQUEST_MEDIA_UPLOAD", vendorId, propertyId, fileName: file.name, mimeType: file.type }, "Scoped credential created. Uploading directly to ImageKit…");
    if (!credential?.authorization) return;
    try {
      const authorization = credential.authorization;
      const uploadBody = new FormData();
      uploadBody.set("file", file);
      uploadBody.set("fileName", authorization.payload.fileName);
      uploadBody.set("folder", authorization.payload.folder);
      uploadBody.set("useUniqueFileName", "true");
      uploadBody.set("checks", authorization.payload.checks);
      uploadBody.set("tags", JSON.stringify(authorization.payload.tags));
      uploadBody.set("token", authorization.token);
      uploadBody.set("publicKey", authorization.publicKey);
      const upload = await fetch(authorization.uploadUrl, { method: "POST", body: uploadBody });
      const asset = await upload.json();
      if (!upload.ok) throw new Error("ImageKit rejected the scoped upload.");
      const registered = await mutate({
        action: "REGISTER_MEDIA", idempotencyKey: crypto.randomUUID(), vendorId, propertyId,
        providerFileId: asset.fileId, filePath: asset.filePath, url: asset.url,
        width: asset.width, height: asset.height, format: String(asset.filePath).split(".").pop()?.toLowerCase(),
        bytes: asset.size, altText: values.get("altText"), sortOrder: Number(values.get("sortOrder")),
      }, "Image uploaded and registered for admin media review.");
      if (registered) event.currentTarget.reset();
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "The image upload failed." });
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Book My Room home"><span>B</span> Book My Room</Link>
        <Link className={styles.back} href="/auth"><ArrowLeft size={17} /> Account</Link>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>PARTNER STUDIO · BANGLADESH</p>
          <h1 ref={headingRef}>Turn a beautiful stay into a trusted listing.</h1>
          <p>Draft safely, prove the details, then hand it to our marketplace team for a deliberate review.</p>
        </div>
        <div className={styles.trustCard}>
          <ShieldCheck aria-hidden="true" />
          <div><strong>Nothing publishes by accident.</strong><span>Location, media, policies, and ownership are checked before a property can go live.</span></div>
        </div>
      </section>

      <div className={styles.progress} aria-label="Onboarding stages">
        {["Organization", "Property", "Rooms", "Media", "Review"].map((label, index) => <div key={label}><span>{String(index + 1).padStart(2, "0")}</span>{label}</div>)}
      </div>

      <section className={styles.workspace}>
        <aside className={styles.aside}>
          <p className={styles.kicker}>WORKSPACE</p>
          <h2>Your listing dossier</h2>
          <p>Every field becomes part of the admin publish checklist. Use verified facts only.</p>
          <dl>
            <div><dt>Vendor ID</dt><dd>{vendorId || "Created after step one"}</dd></div>
            <div><dt>Approval</dt><dd>{vendorStatus}</dd></div>
            <div><dt>Property ID</dt><dd>{propertyId || "Created after step two"}</dd></div>
            <div><dt>Map provider</dt><dd>Pending owner selection</dd></div>
          </dl>
        </aside>

        <div className={styles.forms}>
          <div className={`${styles.status} ${styles[status.tone]}`} role="status" aria-live="polite">
            {status.tone === "success" && <CheckCircle2 size={18} aria-hidden="true" />}{status.message}
          </div>

          <form className={styles.card} onSubmit={onboard}>
            <div className={styles.cardHeading}><Building2 aria-hidden="true" /><div><span>01 · Organization</span><h2>Who operates this stay?</h2></div></div>
            <div className={styles.twoCol}>
              <label>Public business name<input name="displayName" minLength={2} maxLength={120} required placeholder="Megh Bari Hospitality" /></label>
              <label>Legal business name<input name="legalName" minLength={2} maxLength={180} required placeholder="Megh Bari Hospitality Ltd." /></label>
              <label>Contact email<input name="contactEmail" type="email" autoComplete="email" required placeholder="partner@example.com" /></label>
              <label>Bangladesh mobile<input name="contactPhone" type="tel" required pattern="\+8801[3-9][0-9]{8}" placeholder="+8801712345678" /></label>
            </div>
            <button className={styles.primary} type="submit">Save organization <span>→</span></button>
          </form>

          {vendorId && vendorStatus !== "APPROVED" && <div className={styles.approvalBar}>
            <div><span>Approval gate</span><strong>{vendorStatus === "DRAFT" ? "Submit the organization for marketplace review." : "An admin must approve the organization before property work unlocks."}</strong></div>
            <div>{vendorStatus === "DRAFT" && <button className={styles.primary} type="button" onClick={submitVendor}>Submit organization</button>}<button className={styles.secondary} type="button" onClick={refreshApproval}>Refresh approval</button></div>
          </div>}

          <form className={styles.card} onSubmit={createProperty}>
            <div className={styles.cardHeading}><MapPin aria-hidden="true" /><div><span>02 · Property dossier</span><h2>Describe the real place.</h2></div></div>
            <fieldset disabled={vendorStatus !== "APPROVED"}>
              <div className={styles.twoCol}>
                <label>Property name<input name="name" required minLength={3} placeholder="Shobuj Chhaya Eco Resort" /></label>
                <label>Stable slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="shobuj-chhaya-eco-resort" /></label>
                <label>Property type<select name="propertyType" defaultValue="HOTEL"><option>HOTEL</option><option>RESORT</option><option>ECO_RESORT</option><option>HOMESTAY</option><option>COTTAGE</option><option>VILLA</option></select></label>
                <label>Class<select name="propertyClass" defaultValue="STANDARD"><option>LUXURY</option><option>STANDARD</option><option>BUDGET</option></select></label>
                <label>District record ID<input name="districtId" required placeholder="district-sylhet" /></label>
                <label>Destination record ID <small>(optional)</small><input name="destinationId" placeholder="destination-sreemangal" /></label>
                <label>Area<input name="area" required placeholder="Sreemangal" /></label>
              </div>
              <label>Address<input name="addressLine" required minLength={5} placeholder="Road, village or neighbourhood" /></label>
              <label>Property story<textarea name="description" required minLength={40} rows={4} placeholder="Describe the stay, surroundings, and what guests should genuinely expect." /></label>
              <div className={styles.amenities} aria-label="Amenities"><label><input type="checkbox" name="amenities" value="wifi" /> Wi‑Fi</label><label><input type="checkbox" name="amenities" value="parking" /> Parking</label><label><input type="checkbox" name="amenities" value="free-breakfast" /> Breakfast</label><label><input type="checkbox" name="amenities" value="nature-view" /> Nature view</label></div>
              <div className={styles.twoCol}>
                <label>Check-in<input type="time" name="checkInTime" defaultValue="14:00" required /></label>
                <label>Check-out<input type="time" name="checkOutTime" defaultValue="11:00" required /></label>
              </div>
              {[["cancellationSummary", "Cancellation summary"], ["childPolicy", "Child policy"], ["extraBedPolicy", "Extra-bed policy"], ["petPolicy", "Pet policy"], ["couplePolicy", "Couple policy"]].map(([name, label]) => <label key={name}>{label}<textarea name={name} required minLength={10} rows={2} /></label>)}
              <button className={styles.primary} type="submit">Create property draft <span>→</span></button>
            </fieldset>
          </form>

          <div className={styles.splitCards}>
            <form className={styles.card} onSubmit={createRoom}>
              <div className={styles.cardHeading}><KeyRound aria-hidden="true" /><div><span>03 · Inventory shell</span><h2>Add a room type</h2></div></div>
              <fieldset disabled={!propertyId}>
                <label>Room name<input name="roomName" required placeholder="Garden King" /></label>
                <label>Description<textarea name="roomDescription" required minLength={20} rows={3} /></label>
                <div className={styles.twoCol}><label>Adults<input type="number" name="maxAdults" min="1" max="20" defaultValue="2" required /></label><label>Children<input type="number" name="maxChildren" min="0" max="20" defaultValue="1" required /></label><label>Quantity<input type="number" name="quantity" min="1" max="500" defaultValue="1" required /></label><label>Cooling<select name="airConditioning"><option value="AC">Air conditioned</option><option value="NON_AC">Non‑AC</option></select></label></div>
                <label>Beds<input name="beds" required placeholder="1 king bed" /></label>
                <button className={styles.secondary} type="submit">Add room type</button>
              </fieldset>
            </form>

            <form className={styles.card} onSubmit={authorizeUpload}>
              <div className={styles.cardHeading}><ImagePlus aria-hidden="true" /><div><span>04 · Managed media</span><h2>Authorize an upload</h2></div></div>
              <fieldset disabled={!propertyId}>
                <p className={styles.note}>JPEG, PNG, or WebP · 10 MiB maximum · credential expires in 10 minutes.</p>
                <label>Property image<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
                <label>Descriptive alt text<textarea name="altText" required minLength={8} maxLength={240} rows={3} placeholder="Garden-facing king room with a wide window" /></label>
                <label>Gallery order<input name="sortOrder" type="number" min="0" max="1000" defaultValue="0" required /></label>
                <button className={styles.secondary} type="submit">Upload managed image</button>
              </fieldset>
            </form>
          </div>

          <form className={styles.card} onSubmit={createNearbyPlace}>
            <div className={styles.cardHeading}><MapPin aria-hidden="true" /><div><span>Location context</span><h2>Add a nearby place</h2></div></div>
            <fieldset disabled={!propertyId}>
              <div className={styles.twoCol}>
                <label>Place name<input name="nearbyName" required placeholder="Lawachara National Park" /></label>
                <label>Type<select name="nearbyType"><option value="NATURE">Nature</option><option value="LANDMARK">Landmark</option><option value="TRANSPORT">Transport</option><option value="DINING">Dining</option><option value="HEALTHCARE">Healthcare</option></select></label>
                <label>Distance in metres<input name="distanceMeters" type="number" min="0" max="500000" required placeholder="8500" /></label>
              </div>
              <button className={styles.secondary} type="submit">Add nearby place</button>
            </fieldset>
          </form>

          <div className={styles.reviewBar}>
            <div><span>05 · Ready for review?</span><strong>Submission stays private until an admin publishes it.</strong></div>
            <button className={styles.primary} type="button" disabled={!vendorId || !propertyId} onClick={() => mutate({ action: "SUBMIT_PROPERTY", vendorId, propertyId }, "Property sent to the marketplace review queue.")}>Submit property <span>→</span></button>
          </div>
        </div>
      </section>
    </main>
  );
}
