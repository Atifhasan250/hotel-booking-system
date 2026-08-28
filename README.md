# Book My Room

A Bangladesh-focused stay marketplace under Genesis-governed development. The current responsive homepage is the
locked visual foundation; backend capabilities are introduced one milestone at a time.

## Run locally

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run dev
```

Then open `http://localhost:3000`.

Copy `.env.example` to a local `.env.local` only when working on server integrations. Use isolated local/test
MongoDB and ImageKit environments; never commit real credentials.

M1 account routes require a transaction-capable MongoDB deployment and a base64-encoded 32-byte
`IDENTITY_TOKEN_ENCRYPTION_KEY`. Verification and password-reset requests are encrypted at rest in a pending
provider-neutral delivery queue; no email/SMS provider is claimed until the M10 provider decision is approved. The
integration suite starts a real local MongoDB replica set and may download its test binary on first run.

## Non-build verification

```bash
npm run typecheck
npm run lint
npm run test
npm run test:integration
```

Repository governance prohibits `npm run build` as a verification command. Integration and E2E scripts are added by
the milestones that introduce those environments; a missing script is never reported as passing. There is no
browser E2E script yet, and no build command may be substituted for that missing evidence.

## Import the legacy bookmyroom.site catalog

The importer reads the public WordPress REST API, archives the exact source payload, maps hotels/rooms/destinations
into stable MongoDB IDs, and uploads associated property/destination images to the configured ImageKit account.
It is idempotent for existing imported records, never deletes data, and records a pre-write backup manifest.

```bash
# Read-only source fetch and mapping summary
npm run import:bookmyroom

# Upload images and seed the configured MongoDB database
npm run import:bookmyroom -- --apply

# Publish the owner-approved imported catalog with an audit event and recovery snapshot
npm run publish:bookmyroom-import

# Confirm imported collection counts and ImageKit URL reachability
npm run verify:bookmyroom-import
```

The importer deliberately stages sparse legacy listings as `DRAFT` with `UNVERIFIED` locations and `PENDING`
media. The separate publish command promotes an explicitly owner-approved import while preserving those factual
location flags and a recovery snapshot. Review ownership, descriptions, property class, policies, room defaults,
addresses, alt text, and image rights in the admin workflow before any future import is published. Exact source responses remain in
`legacyWordpressArchive`; each applied run is recorded in `legacyImportRuns` with a recovery snapshot in
`legacyImportBackups`.

The stay search is currently an interactive frontend baseline, not real availability. Tour and Car remain
non-bookable “Coming soon” surfaces until their independently approved future milestones.
