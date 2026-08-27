# Book My Room — locked product specification

Status: authoritative baseline, 2026-08-27. This document defines what must be built. Agents may clarify it
through an ADR, but must not silently remove, weaken, or reinterpret a requirement.

## 1. Product and outcome

Book My Room is a Bangladesh-focused, multi-district booking marketplace that aggregates Hotels, Resorts,
Eco Resorts, Homestays, Cottages, and Villas. Customers discover, compare, reserve, pay, receive invoices,
and manage bookings. Vendors manage properties, rooms, inventory, rates, offers, bookings, and earnings.
Administrators approve and govern the marketplace, payments, commissions, content, and reports.

Production URL: `https://bookmyroom.site`.

Primary outcomes:

- Customers can find an eligible property for dates and guests, see a final price, and complete a safe booking.
- Availability cannot be oversold, even under concurrent requests or payment retries.
- Vendors can operate only their own approved inventory and see auditable financial data.
- Admins can control marketplace quality, commissions, payments, promotions, SEO content, and moderation.
- The experience is mobile-first, fast, accessible, indexable, and deployable as a secure production service.

This specification explicitly includes auto invoice generation, vendor approval, role-based access control, and
Core Web Vitals optimization; their operational definitions and evidence gates appear in later sections.

## 2. Scope and releases

### Release 1 — production stay marketplace (required)

- Public discovery, property pages, real availability, booking, EPS payment, confirmations, invoices.
- Customer, vendor, and admin experiences.
- Commission ledger, vendor earnings, offers, featured listings, banners, premium badges, subscriptions.
- Reviews, wishlists, cancellation requests, newsletter, WhatsApp contact, CMS/SEO controls, analytics.
- Hotel, Resort, Eco Resort, Homestay, Cottage, and Villa inventory across multiple districts.

### Release 1.1 — operational hardening (required before public launch)

- Reconciliation, refunds/cancellations, alerting, audit trails, backups and restore drill, security review,
  performance/accessibility/SEO gates, legal and policy content, production runbooks.

### Future modules (included in architecture; not Release 1 booking scope)

- Tour packages, local car rental, guide booking, national bus integration, domestic flight integration.
- Android and iOS applications using the same versioned domain/API contracts.
- AI recommendations and loyalty rewards.

Future tabs may appear only when clearly marked “Coming soon” or feature-flagged. They must not accept money or
claim live inventory until their own milestone and verification gates are complete.

## 3. Roles and authorization

- Visitor: browse, search, compare, read policies/reviews, subscribe, contact, begin authentication.
- Customer: visitor capabilities plus wishlist, booking/payment, invoices, history, profile, reviews,
  cancellation requests.
- Vendor member: access only explicitly assigned vendor organization(s) and permitted actions.
- Vendor owner: manage organization members, properties, inventory, rates, offers, bookings, and earnings.
- Admin: marketplace operations according to granular permissions.
- Super admin: commission/subscription configuration, privileged access governance, critical overrides.

All authorization is server-side and deny-by-default. A hidden UI is not authorization. Vendor resources must
always be constrained by `vendorId`; customer resources by `customerId`. Admin impersonation, overrides, status
changes, exports, and financial changes are audited.

## 4. Public experience

### Homepage

Preserve and evolve the existing frontend’s visual direction: premium Bangladesh travel imagery, dark green,
lime accent, editorial typography, rounded panels, and responsive motion. Do not replace it with a generic
dashboard template.

Required sections:

- Hero search for location, check-in, check-out, rooms, adults, and children.
- Budget Hotels, Eco Resorts, popular destinations, customer reviews/ratings, special offers.
- Featured/premium properties and clearly labeled sponsored placements.
- WhatsApp live-chat link, newsletter subscription, trust/payment signals, useful footer navigation.
- Optional future-service entry points controlled by feature flags.

No production asset may hotlink an unrelated/reference WordPress host. Store managed media in ImageKit, with
descriptive alt text, responsive transformations, explicit dimensions, and safe fallbacks.

### Search, filter, compare, and sort

Search inputs: location/district/destination, check-in/check-out, room count, adults, children, optional pets.
Availability and occupancy must be evaluated before a result is described as available.

Filters:

- Price range based on total stay price, with currency and tax/fee meaning visible.
- Property type: Hotel, Resort, Cottage, Eco Resort, Homestay, Villa.
- Class: Luxury, Standard, Budget.
- AC / non-AC.
- Swimming pool, free breakfast, couple friendly, family friendly, Wi-Fi, parking, pet friendly, nature view.
- Rating and other admin-approved amenity filters may be added without removing the required set.

Sorts: low-to-high price, high-to-low price, top rated, most booked, newest listings. Eco Resort is a property
type/filter, not a misleading ranking algorithm. Sort definitions must be deterministic and documented.

Search result cards show real starting/total price semantics, availability state, property type, district,
rating count, key amenities, promotion disclosure, and wishlist action. Empty/error/loading states are required.

### Property detail page

- ImageKit gallery with accessible controls and optimized media.
- Property overview, room types, occupancy, bed configuration, quantity, room amenities, and live price.
- Date-aware availability calendar; disabled/unavailable dates are not selectable.
- Detailed description, property amenities, map/location, nearby tourist spots.
- Verified customer reviews and aggregate rating.
- Check-in/out rules, cancellation/refund policy, child/extra-bed/pet/couple policies, taxes and fees.
- Sticky/visible instant-booking action, contact and native/share-link options.
- Structured data appropriate to the page; never publish fabricated rating or availability schema.

## 5. Booking lifecycle

Canonical states:

- `DRAFT` → `HELD` → `PENDING_PAYMENT` → `CONFIRMED` → `CHECKED_IN` → `COMPLETED`.
- Alternate terminal/exception states: `PAYMENT_FAILED`, `EXPIRED`, `CANCEL_REQUESTED`, `CANCELLED`,
  `REFUND_PENDING`, `REFUNDED`, `NO_SHOW`.

Required flow:

1. Revalidate property/room status, occupancy, dates, rate plan, inventory, restrictions, and promotion.
2. Server calculates an immutable price quote with nightly lines, discount, taxes, fees, commission basis,
   total, currency (`BDT` initially), and expiry.
3. Create a short-lived inventory hold atomically. The hold duration is configurable and visible to the user.
4. Collect validated guest/contact information and policy consent; minimize sensitive data.
5. Create/reuse an idempotent payment attempt and send the customer to EPS through the server adapter.
6. Treat the signed, verified server callback/webhook plus provider verification as payment truth; never trust a
   browser redirect alone.
7. Confirm exactly once, consume held inventory atomically, create invoice and ledger entries, notify parties.
8. Expired/failed attempts release the hold. Retries reuse the booking safely and never double-charge.

Every booking has a non-sequential public reference. Dates use property-local calendar semantics; stored events
use UTC timestamps. Check-out must be after check-in. Pricing and policy snapshots remain reproducible after a
vendor changes rates or rules.

Cancellation is a request until policy evaluation/admin/vendor workflow resolves it. Refund amount and provider
status are independently tracked and reconciled. All manual adjustments require reason, actor, timestamp, and
audit entry.

## 6. EPS payment requirements

Use a `PaymentProvider` boundary so EPS-specific request signing, redirect/session creation, verification,
webhook parsing, refunds, and reconciliation do not leak into booking domain code.

- Credentials exist only in validated server environment variables/secrets.
- Verify signature/authenticity, expected merchant, amount, currency, booking reference, and provider status.
- Webhooks are idempotent, replay-safe, rate-limited, logged with secrets/redacted personal data removed.
- Persist provider transaction/reference IDs and raw normalized event metadata necessary for audit.
- Handle callback-before-redirect, redirect-before-callback, duplicates, timeouts, unknown status, and late success.
- Provide sandbox/contract tests before live credentials. Live activation and refunds require human approval.
- Exact EPS endpoints, signatures, status mapping, refund support, settlement reports, and merchant rules are an
  open integration contract; agents must obtain official merchant documentation rather than guess.

The system must not store card/PIN/mobile-wallet secrets. Payment pages remain provider-hosted unless an audited
merchant contract explicitly requires another model.

## 7. Customer dashboard

- Secure signup/login/logout, account recovery and verified contact flow.
- Booking history/detail with state timeline and support information.
- Downloadable server-generated invoice with stable invoice number and financial snapshot.
- Wishlist/saved properties, profile management, review submission for eligible completed stays.
- Cancellation request with policy preview, reason, status, and refund progress.

## 8. Vendor dashboard

- Vendor onboarding and approval state; property add/edit/archive (hard delete prohibited after transactions).
- Room type, unit inventory, amenities, occupancy, policies, media, blackout/stop-sell management.
- Calendar and bulk price/availability updates with validation and audit history.
- Booking queue/detail, allowed status operations, masked customer data until operationally necessary.
- Gross bookings, commission, adjustments, refunds, net earnings, payout/settlement status.
- Discount/offer tools with date, inventory, minimum stay, caps, stacking, and eligibility rules.
- Performance analytics with explicit date range and timezone; exports are permissioned and audited.

## 9. Admin control plane

- Vendor/property approval with moderation notes and publish checklist.
- Full property/vendor/customer/booking monitoring and safe suspension/archive workflows.
- Versioned commission rules; changes do not rewrite historical bookings.
- Payment attempts, webhook status, reconciliation, refund/adjustment tracking.
- Review moderation with reason codes; preserve audit evidence.
- Banner, advertisement, featured listing, premium badge, plan/subscription control.
- SEO/content management for destination and landing pages with preview and publish states.
- Analytics/reports for bookings, conversion, cancellations, revenue, commission, inventory, vendors.
- Role/permission management, audit-log viewer, operational health and failed-job visibility.

## 10. Revenue model

- Per-booking commission with immutable booking-time rule snapshot.
- Paid featured listings and homepage banners, always disclosed to customers.
- Premium badges based on explicit paid/quality semantics; never imply unearned ratings.
- Vendor subscription plans with entitlements, validity, lifecycle, and manual/offline fallback until recurring
  billing is contractually supported.

Financial truth is an append-only ledger. Dashboards are projections from bookings/payments/ledger, not mutable
earnings counters. Payout execution is not assumed unless later specified; settlement tracking is required.

## 11. Notifications and communications

- Email and SMS confirmation for booking/payment/cancellation/refund events through provider adapters and a
  durable job/outbox mechanism. Templates are versioned and localized-ready.
- WhatsApp “live chat” initially means a configurable `wa.me` support link with prefilled, non-sensitive context;
  it does not claim bot/API messaging.
- Newsletter requires explicit consent, double opt-in where provider/policy requires, unsubscribe, suppression,
  rate limiting, and no account creation side effect.
- Notification failure never rolls back a confirmed booking; it is retried and visible to operations.

## 12. SEO, accessibility, and content

- Canonical origin is `https://bookmyroom.site`; staging/non-production is `noindex`.
- Server-render indexable public pages with unique title/description, canonical, Open Graph, social image,
  breadcrumb, robots, sitemap, and intentional 404/redirect strategy.
- Structured data uses supported schema for organization, website/search, breadcrumbs, lodging/property offers,
  reviews only when real and eligible. Validate generated output.
- Stable, human-readable slugs with redirect history after slug changes.
- District/destination landing pages contain useful unique content; never mass-generate thin doorway pages.
- Private dashboards, auth, booking, checkout, internal search combinations, and admin/vendor pages are noindex.
- WCAG 2.2 AA target: keyboard operation, visible focus, semantic controls, labels/errors, contrast, reduced motion,
  alt text, accessible dialog/calendar/gallery patterns, and 44px mobile targets where practical.
- Bengali and English content architecture is localization-ready. Initial launch language is a product decision;
  strings must not be irreversibly embedded in domain logic.

## 13. Security, privacy, and resilience

- Passwords use an established memory-hard/password hashing library with safe parameters; never reversible
  encryption. Secure, HttpOnly, SameSite cookies, session rotation/revocation, CSRF protection where applicable.
- Rate-limit auth, recovery, booking holds, checkout, reviews, newsletter, search abuse, and webhooks.
- Validate all inputs at boundaries; encode output; sanitize constrained rich text; protect against NoSQL/operator
  injection, IDOR, XSS, CSRF, SSRF, open redirects, upload abuse, and mass assignment.
- ImageKit signed uploads are scoped by folder/type/size; server records ownership; moderation/delete is audited.
- Secrets never reach client bundles, logs, ZIPs, or repository. Logs redact credentials, tokens, payment data,
  full phone/email/address where not required.
- Security headers, HTTPS, CSP rollout, dependency scanning, least-privilege database/network access, and basic
  edge/WAF controls are launch gates.
- Automated backups with retention and encrypted storage; documented restore procedure and successful restore
  drill before launch. Define RPO/RTO with owner before production.
- Audit logs are append-only in normal application paths and include actor, action, target, outcome, request ID,
  timestamp, and safe metadata.

## 14. Performance and reliability targets

- Mobile-first and resilient on common Bangladesh mobile networks. Optimize images, JavaScript, fonts, caching,
  database queries/indexes, pagination, and streaming/loading boundaries.
- Public p75 targets at launch: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 on representative mobile field data.
- Search API target p95 ≤800ms under agreed launch load; ordinary authenticated reads p95 ≤500ms excluding
  third-party latency. Exact capacity target is an open product/ops decision and must be load-tested.
- All outbound calls have timeout, bounded retry with jitter where safe, and observable failure state.
- Background jobs are idempotent; dead-letter/retry visibility exists. Health/readiness endpoints do not leak data.
- No unbounded query/list; use indexed cursor/page pagination and projections.

## 15. Analytics and privacy

Track a documented event taxonomy: search started/completed, filters, property viewed, room selected, hold created,
checkout started, payment outcome, booking confirmed, cancellation/refund, wishlist, vendor/admin operations.
Do not put personal or payment data in analytics. Consent and retention must match the approved privacy policy.
Operational/financial reports are derived from authoritative server events and state, not client analytics.

## 16. Explicit exclusions and open decisions

Not authorized without a new ADR/user decision:

- Inventing EPS API details or switching payment provider.
- Choosing production email, SMS, maps, analytics, hosting, queue, monitoring, or backup vendors.
- Enabling future transport/tour payments.
- Storing exact map coordinates without vendor/admin validation.
- Hard-deleting transactional records; exposing customer/vendor data across tenants.

Open before the relevant milestone: EPS merchant documentation/credentials; cancellation/refund policy; tax/fee
rules and invoice legal fields; commission tiers; vendor payout process; launch districts/content; email/SMS/map
providers; Bengali/English launch choice; support hours/number; legal privacy/terms; expected launch load and
RPO/RTO. Unknowns must be recorded, mocked behind adapters, and must not be guessed into production behavior.
