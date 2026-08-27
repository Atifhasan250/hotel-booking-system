# Canonical data model

Names are conceptual; implementation may adjust collection names through an ADR. Every document has `_id`,
schema/version, `createdAt`, `updatedAt` where applicable. Public IDs are non-sequential. Monetary values are integer
minor units with ISO currency (initially BDT); never floating point.

## Identity and tenancy

- `users`: normalized email/phone, verification state, password hash/auth identities, status, locale.
- `sessions`: hashed/opaque session identifier, user, expiry, revocation, device/security metadata.
- `vendorOrganizations`: legal/display data, contacts, approval/status, subscription/entitlements.
- `vendorMemberships`: unique vendor-user pair, role/permissions/status.
- `adminRoleBindings`: explicit admin permissions; super-admin grants tightly controlled.

## Catalog

- `properties`: vendor, type, class, name/slugs, district/address/geo, timezone, descriptions, amenities, policies,
  check-in/out, publish/moderation status, SEO, rating projection, feature flags.
- `roomTypes`: property, name, description, occupancy rules, beds, AC, amenities, base quantity, status.
- `mediaAssets`: owner type/id, ImageKit file/path metadata, width/height, alt, order, moderation/status.
- `destinations`: district/region, localized content, media, SEO, publish status.
- `nearbyPlaces`: property/destination, name/type/distance/location and validation state.
- `amenityDefinitions`: stable key, label/icon/category, applicable entity and filterability.
- `slugRedirects`: entity, old slug, current destination, status.

## Availability and pricing

- `inventoryDays`: unique roomType+localDate, capacity/adjustment, stop-sell/blackout, min/max stay overrides,
  version. Indexed for date-range reads.
- `inventoryHolds`: booking, room type, date range/expanded nights, quantity, status, expiry, idempotency key.
- `ratePlans`: room type, cancellation/meal/occupancy rules, status, base pricing policy.
- `rateOverrides`: rate plan+localDate unique, amount, min/max stay, closed-to-arrival/departure.
- `offers`: vendor/property scope, dates, book/stay window, discount rule, limits, eligibility, stacking, status.
- `priceQuotes`: immutable expiry-bound snapshot of nightly lines, occupants/rooms, offer, taxes/fees, totals and
  rule/policy versions.

## Booking and guest operations

- `bookings`: public reference, customer, vendor/property, room/rate selection, local dates, guest counts,
  contact/guest data, quote/policy snapshots, lifecycle state, totals, idempotency, timestamps.
- `bookingStateEvents`: append-only transition, actor/source, from/to, reason, safe metadata.
- `cancellationRequests`: booking, requester, reason, policy result, proposed/final amount, state, resolver.
- `invoices`: unique invoice number, booking/payment/merchant/customer snapshots, line items, totals, issue date,
  immutable render/version metadata.

## Payment and finance

- `paymentAttempts`: booking, provider, attempt/idempotency key, amount/currency, provider refs, state, expiry.
- `paymentEvents`: unique provider event/ref, verified status, normalized event type, processing result, timestamps,
  redacted payload/hash.
- `refunds`: payment/booking, requested/approved/processed amounts, provider ref, state, reason.
- `commissionRules`: versioned scope/priority, percent/fixed values, validity, status.
- `ledgerEntries`: append-only double-entry-style reference, account, debit/credit amount, source type/id, timestamp;
  balancing invariant per transaction/ref.
- `settlements`: vendor period, included ledger refs, gross/fees/refunds/net, status and external/manual reference.
- `subscriptionPlans`, `vendorSubscriptions`, `adPlacements`: entitlements/validity/pricing/status and audit links.

## Engagement, content, and operations

- `wishlists`: customer+property unique, created timestamp.
- `reviews`: booking/customer/property unique, rating/content, verified eligibility, moderation/publish state.
- `reviewAggregates`: property count/average/distribution projection, rebuildable from published reviews.
- `banners`/`contentPages`: placements, localized content, schedule, publish status, SEO and revision.
- `newsletterSubscriptions`: normalized contact, consent/source, verification, unsubscribe/suppression.
- `notificationOutbox`: event, channel, recipient ref, template/version, dedupe key, attempts/next attempt/status.
- `auditEvents`: actor, action, target, outcome, request ID, timestamp, safe before/after or diff metadata.
- `analyticsEvents`: privacy-safe event name/version, anonymous/user/session refs as allowed, properties, timestamp.

## Required indexes/constraints

- Unique normalized verified identity keys as policy permits; unique vendor membership pair.
- Unique active/current property slug and redirect resolution; property vendor/status/district/type indexes.
- Room type property/status; inventory day unique `(roomTypeId, localDate)` and range support.
- Holds by expiry/status, booking, room/date; TTL is cleanup only, not correctness.
- Booking public ref unique; customer/date, vendor/property/date/state operational indexes.
- Payment provider reference/event unique where supplied; idempotency keys unique within scope.
- Review unique eligible booking/customer/property combination; wishlist unique customer/property.
- Outbox status/next-attempt; audit target/time and actor/time; content placement/status/schedule.

Indexes must be justified by measured query shapes. Search may begin with indexed MongoDB queries; add Atlas Search
or a separate search service only after an ADR and evidence. Never use unescaped user regex as general search.

## Retention and deletion

Transactional, payment, invoice, ledger, and audit records are retained per approved legal/financial policy and
are not hard-deleted through ordinary UI. Account deletion/anonymization separates legally required records from
unneeded personal data. Media and content use archive/soft-delete with ownership checks. Define retention periods
before launch; background cleanup is auditable and tested.
