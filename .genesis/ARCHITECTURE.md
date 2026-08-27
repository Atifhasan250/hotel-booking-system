# Architecture contract

## Chosen shape

A modular monolith in the existing Next.js App Router application, backed by MongoDB and ImageKit. This gives a
small team one deployable system while enforcing boundaries that can later expose APIs or extract workers. Do not
start with microservices.

### Layers

1. UI: server components by default; client components only for interaction. Public rendering prioritizes SEO.
2. Application/use cases: orchestration, authorization, transactions, idempotency, domain events.
3. Domain: booking, inventory, pricing, payment, commission, review and policy rules; framework-independent.
4. Infrastructure: MongoDB repositories, ImageKit, EPS, email, SMS, maps, analytics, queues/jobs.

Suggested repository shape (adapt to Next.js conventions after reading the locally installed Next docs):

```text
app/                     routes, layouts, route handlers, metadata
src/modules/
  identity/              users, sessions, RBAC
  catalog/               properties, rooms, amenities, destinations, media
  availability/          inventory, holds, calendars
  pricing/               rates, quotes, offers, taxes/fees
  booking/               booking lifecycle and policy snapshots
  payments/              EPS adapter, attempts, events, reconciliation/refunds
  finance/               commission, ledger, settlements, subscriptions/ads
  reviews/               eligibility, rating projection, moderation
  notifications/         outbox, email, SMS, templates
  content/               banners, SEO pages, newsletter
  analytics/             product events and operational projections
  audit/                 immutable security/operations events
src/platform/            config, db, logging, cache, jobs, observability
src/shared/              small framework-neutral primitives only
tests/                    unit, integration, contract, e2e, fixtures
```

Modules communicate through typed public interfaces/use cases, not cross-module collection access. Route handlers
are thin. React components do not query MongoDB or call EPS directly.

## Runtime and data decisions

- Keep the current Next.js major and TypeScript strictness unless an explicit upgrade milestone is approved.
- MongoDB transactions required for booking/inventory/financial multi-document state; production must use a
  transaction-capable replica set/managed cluster. Fail startup/readiness if required capability is unavailable.
- Use a single validated, cached Mongo client per runtime process. Define indexes in migrations/setup scripts and
  test query plans for search/availability/admin lists.
- ImageKit is the media delivery/store boundary. Persist provider file ID, URL/path, dimensions, format, alt text,
  ownership, sort order, moderation state; do not persist opaque client-only URLs as truth.
- Background work uses a durable outbox/job abstraction. A database-backed implementation is acceptable first;
  no in-memory timer is authoritative for holds, emails, SMS, or reconciliation.
- Use UTC for event timestamps and an IANA timezone per property for calendar/display. Booking nights are local
  dates, not timestamp arithmetic.

## API and mutation contract

- Version externally reusable APIs (`/api/v1/...`) or keep private server actions behind stable application use
  cases. Do not expose internal Mongo documents.
- All mutation inputs and outputs have runtime schemas and normalized error codes.
- Mutation authorization and ownership checks happen inside the use case, not only middleware.
- Critical writes accept/derive idempotency keys: booking creation, payment initiation/callback, refund,
  notification dispatch, inventory bulk update.
- Use request/correlation IDs across HTTP, jobs, payment events, audit, and logs.
- Return safe errors to clients; retain diagnosable redacted structured logs server-side.

## Availability and oversell prevention

For each `(roomTypeId, localDate)`, authoritative sellable inventory is derived from capacity, stop-sell/blackout,
confirmed/active-held quantity, and explicit adjustment. A hold is created and checked atomically within a
transaction. A unique constraint and conditional update prevent negative availability. Expiry cleanup is a safety
mechanism; every availability read also ignores expired holds so a delayed worker cannot block sales indefinitely.

Do not use calendar rendering, client state, cache, or a count performed before a separate write as the final
oversell guard.

## Cache and rendering

- Public catalog/content may be cached with tagged/event-driven invalidation after publish, price, inventory,
  review, or promotion changes.
- Personalized dashboards, quotes, holds, payment status, and admin data are private/no-store unless a safe scoped
  cache is proven.
- Never cache an “available” response past quote/hold expiry. The server always revalidates at booking.
- Use responsive ImageKit transformations, modern formats, explicit sizes, sensible quality, and lazy loading below
  the fold. The hero/LCP asset is prioritized deliberately.

## Environments

Local, test, preview/staging, production. Each has separate database, ImageKit folders/keys, EPS credentials, and
external providers. Preview/staging are noindex. Test mode uses deterministic fakes/sandboxes. Production secrets
are injected by the hosting secret manager; `.env.example` contains names and descriptions only.

## Evolution

Future tours, cars, guides, buses, and flights are separate bounded modules sharing identity, payments,
notifications, finance, content, and audit through contracts. Do not force stay-specific concepts such as “room
night” into a generic product abstraction prematurely. Mobile apps consume stable versioned use cases/APIs.
