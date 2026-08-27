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

The stay search is currently an interactive frontend baseline, not real availability. Tour and Car remain
non-bookable “Coming soon” surfaces until their independently approved future milestones.
