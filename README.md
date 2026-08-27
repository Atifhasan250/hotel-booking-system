# Book My Room

A Bangladesh-focused stay marketplace under Genesis-governed development. The current responsive homepage is the
locked visual foundation; backend capabilities are introduced one milestone at a time.

## Run locally

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run dev
```

Then open `http://localhost:3000`.

Copy `.env.example` to a local `.env.local` only when working on server integrations. Use isolated local/test
MongoDB and ImageKit environments; never commit real credentials.

## Non-build verification

```bash
npm run typecheck
npm run lint
npm run test
```

Repository governance prohibits `npm run build` as a verification command. Integration and E2E scripts are added by
the milestones that introduce those environments; a missing script is never reported as passing.

The stay search is currently an interactive frontend baseline, not real availability. Tour and Car remain
non-bookable “Coming soon” surfaces until their independently approved future milestones.
