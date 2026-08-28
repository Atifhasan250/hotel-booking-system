# PLAN — Book My Room

This is the executable order. Read `PROJECT-SPEC.md` first. A milestone may be split into smaller pull requests,
but its requirements may not be silently deferred. No milestone is complete without a separate verifier.

## Architecture approaches considered

### A — frontend-first pages with direct database handlers

Fast initial screenshots, but booking/inventory/security rules become coupled to routes and difficult to verify.
Rejected because speed now creates unsafe payment and oversell risk later.

### B — modular Next.js monolith (chosen)

One deployable Next.js application with MongoDB and ImageKit, explicit domain modules/adapters, transaction-safe
inventory, durable jobs, and server-rendered public pages. Best balance of delivery speed, SEO, operational
simplicity, and future extraction/mobile APIs.

### C — microservices and event streaming from day one

Maximum independent scaling but high distributed consistency, deployment, observability, and team overhead before
product-market evidence. Rejected for Release 1; module contracts keep later extraction possible.

## Milestones

### M0 — Adopt the existing frontend safely

- Outcome: repository baseline understood; current homepage design preserved; target structure, tooling, env schema,
  fixtures, testing, and CI-quality commands established without a build command.
- Freeze boundary: governance/docs, package tooling, test/config scaffolding, shared platform skeleton; no redesign.
- Demo: `npm run typecheck && npm run lint && npm run test`
- Acceptance: current interactive homepage has a smoke test; remote reference-host assets are inventoried for later
  migration; no secrets; local setup and non-build verification are documented.
- Requirements: foundation for all; ADR-0001/0002.

### M1 — Identity, session security, and tenant authorization

- Outcome: customer, vendor member/owner, admin, super-admin authentication and server authorization primitives.
- Freeze boundary: identity, session, RBAC, audit primitives, auth UI/routes/tests.
- Demo: `npm run test -- identity && npm run test:integration -- authz`
- Acceptance: password recovery/verification lifecycle, secure cookie/session rotation/revocation, permission matrix,
  deny-by-default use cases, cross-vendor/customer IDOR tests, rate limits, audit events.
- Requirements: customer secure login; role-based access; password/session/API security.

### M2 — Catalog, destinations, ImageKit media, and vendor onboarding

- Outcome: approved vendors manage draft properties/room types/policies/media; admins review and publish them.
- Freeze boundary: catalog/media/vendor/admin approval modules and corresponding UI/routes/tests.
- Demo: `npm run test:integration -- catalog && npm run test:e2e -- vendor-onboarding`
- Acceptance: all required property types/classes/amenities; district/destination, nearby spots, map adapter; signed
  scoped ImageKit upload and metadata; publish checklist; tenant isolation; archive instead of destructive delete.
- Requirements: vendor hotel/room CRUD, admin approval, gallery/details/amenities/map/nearby/rules.

### M3 — Availability, rates, offers, and deterministic search

- Outcome: vendors manage date-based inventory/pricing and customers search/filter/sort real availability.
- Freeze boundary: availability, pricing, offer, search modules and public/vendor search/calendar UI.
- Demo: `npm run test:integration -- availability && npm run test:e2e -- search`
- Acceptance: atomic holds under concurrency; stop-sell/blackout, occupancy, AC and every required amenity filter;
  total-price range; all required sorts; pagination/index evidence; empty/error/loading and accessible mobile flows.
- Requirements: advanced search/filter/sort, live availability/price, vendor availability/price/discount controls.

### M4 — Production public experience and technical SEO

- Outcome: existing homepage evolved into real data-driven discovery plus indexable search/destination/property pages.
- Freeze boundary: public app routes/components/styles, content queries, metadata/SEO, ImageKit asset migration.
- Demo: `npm run test:e2e -- public-discovery && npm run test -- seo accessibility`
- Acceptance: required homepage sections; detail page requirements; existing premium visual direction retained;
  responsive/keyboard/reduced-motion states; canonical/OG/sitemap/robots/breadcrumb/valid truthful structured data;
  no hotlinked reference-host assets; private routes noindex.
- Requirements: all Home Page and Details Page items; mobile/desktop; SEO; performance baseline.

### M5 — Quote, booking, inventory hold, and invoice core

- Outcome: customer selects rooms/guests, receives immutable quote, holds inventory, creates booking, and downloads
  reproducible invoice; payment remains fake/test adapter in this milestone.
- Freeze boundary: booking, quote, policy snapshot, invoice, customer booking UI/tests.
- Demo: `npm run test:integration -- booking-concurrency && npm run test:e2e -- booking-core`
- Acceptance: state machine and invalid transition tests; no oversell at agreed concurrency; expiry/retry/idempotency;
  local-date rules; totals in integer minor units; guest validation/consent; invoice identity and immutable snapshot.
- Requirements: room/guest/date selection, availability recheck, booking tracking, confirmation foundation, invoice.

### M6 — EPS payment, confirmation, and reconciliation

- Outcome: official EPS sandbox adapter completes safe, idempotent payment and confirms booking exactly once.
- Freeze boundary: payment provider boundary/EPS adapter, callbacks, reconciliation/refund primitives and UI/tests.
- Demo: `npm run test:contract -- eps && npm run test:e2e -- payment`
- Acceptance: official merchant contract documented; signed callback/provider verification; amount/currency/merchant
  checks; browser redirect not trusted; duplicate/out-of-order/late/failed/unknown cases; redaction; reconciliation;
  refund state. Human approval required before live credentials or live activation.
- Requirements: EPS secure payment, instant confirmation, payment tracking/security.
- Blocker: official EPS merchant docs, sandbox access, status/refund/reconciliation rules.

### M7 — Customer dashboard, reviews, wishlist, and cancellation

- Outcome: customers manage profile, saved properties, bookings/invoices, eligible reviews and cancellation/refund.
- Freeze boundary: customer UI/use cases, wishlists, reviews, cancellation and policy presentation/tests.
- Demo: `npm run test:e2e -- customer-dashboard reviews cancellation`
- Acceptance: ownership isolation, verified-stay review eligibility/one-review rule, moderation status, policy preview,
  cancellation timeline/refund progress, accessible mobile UX and no sensitive data leaks.
- Requirements: every Customer Dashboard item; reviews/ratings; cancellation request.

### M8 — Vendor operations, earnings, offers, and analytics

- Outcome: vendor dashboard operates inventory/bookings and shows auditable earnings/performance.
- Freeze boundary: vendor operational UI/use cases, analytics projections/exports, finance read models/tests.
- Demo: `npm run test:e2e -- vendor-dashboard && npm run test:integration -- vendor-isolation`
- Acceptance: property/room/rate/calendar/booking workflows; masked customer details; offers; gross/commission/refund/
  net/settlement semantics; date/timezone-aware analytics; permissioned/audited exports; tenant isolation.
- Requirements: every Hotel Owner/Vendor Dashboard item.

### M9 — Admin control, finance, promotions, subscriptions, and CMS

- Outcome: admins safely govern vendors, bookings, payments, customers, reviews, content, monetization, and reports.
- Freeze boundary: admin UI/use cases, commission/ledger/settlement, advertising/subscription/CMS/report modules/tests.
- Demo: `npm run test:e2e -- admin-control && npm run test:integration -- ledger commission`
- Acceptance: full required admin controls; versioned commission snapshots; balanced append-only ledger; payment/refund
  visibility; disclosed sponsored placements; plan entitlements; CMS preview/publish; audit for privileged mutations.
- Requirements: every Admin and Revenue Model item.

### M10 — Notifications, newsletter, WhatsApp, and durable jobs

- Outcome: reliable email/SMS lifecycle notifications, consent-safe newsletter, and configured WhatsApp support.
- Freeze boundary: notifications/outbox/jobs/provider adapters, newsletter/WhatsApp UI/admin/tests.
- Demo: `npm run test:integration -- outbox && npm run test:e2e -- communications`
- Acceptance: versioned templates, dedupe/retry/dead-letter/ops visibility; booking is not rolled back by message
  failure; unsubscribe/suppression/abuse control; WhatsApp carries no sensitive data; provider choices documented.
- Requirements: email/SMS confirmation, newsletter, WhatsApp live chat.

### M11 — Security, resilience, performance, accessibility, SEO, and launch

- Outcome: production readiness proven on `bookmyroom.site` with operational and rollback evidence.
- Freeze boundary: cross-cutting hardening/config/docs/tests; feature changes require separate scope.
- Demo: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run test:e2e`
- Acceptance: every Release 1 launch gate in `QUALITY-GATES.md`; security threat model and tests; backup restore;
  load/Core Web Vitals/accessibility/SEO audits; observability/alerts/runbooks; legal and owner approvals; no P0/P1.
- Requirements: Security, Performance & Optimization, responsive experience, cloud hosting readiness.

### M12+ — Future expansion, one independently approved module at a time

- Outcome: Tour → car rental → guide → national bus → domestic flight → mobile apps → recommendations → loyalty.
- Rule: each needs its own discovery/ADR, supply/inventory/pricing/payment/legal model, milestones, threat model and
  launch gate. Reuse platform contracts; do not clone stay semantics or expose fake booking.
- Demo: defined when each module is approved; no future module is implicitly authorized by this plan.

## Progress

- 2026-08-27 — Genesis created from requirements and existing frontend inspection. No implementation milestone has
  been executed or verified. Start with M0 existence pre-flight.
- 2026-08-27 — M0 implementation candidate established lint/test/env/platform scaffolding, homepage smoke coverage,
  remote-asset inventory, design-preservation governance, and explicit non-bookable Tour/Car presentation. Local
  non-build checks passed. A fresh verifier rejected inconsistent future-service presentation, the maker corrected
  every cited gap, and independent re-verification then returned `APPROVE`. M0 is complete; next is M1 pre-flight.
- 2026-08-27 — M1 implemented secure identity/session lifecycles, deny-by-default tenant authorization, actor-aware
  transaction-coupled audit, abuse controls, real Mongo replica/standalone evidence, noindex auth UI, and reproducible
  Playwright desktop/tablet/mobile keyboard coverage. After regression-first accessibility corrections, fresh
  independent verification returned `APPROVE` with no P0/P1 finding. The owner explicitly authorized completion;
  M1 is complete and the next governed boundary is M2 existence pre-flight.
- 2026-08-27 — M2 implemented catalog, vendor onboarding, and ImageKit signer adapter. Tests were run and fresh independent verification returned `APPROVE` with no P0/P1 finding. The owner explicitly authorized completion; M2 is complete and the next governed boundary is M3 existence pre-flight.
- 2026-08-27 — M3 implemented availability and pricing modules with atomic inventory holds support, rate overrides, offers, search API routes, and vendor calendar / search public UIs. Typecheck, lint, integration and e2e tests were verified. M3 is completed pending owner authorization for M4 pre-flight.
- 2026-08-28 — M3's prior atomic claim was reopened, repaired with conditional per-night inventory version writes,
  and independently approved against gated real-replica concurrency. Overall M3 remains partial/rejected because
  search, total-price pagination/sorts, required UI, query-plan and accessibility acceptance remain incomplete. The
  owner accepts M4's current partial update and defers its remaining verification, requesting M5 next; this records
  sequencing intent but does not mark M3/M4 complete or authorize bypassing unresolved M5 product decisions.
