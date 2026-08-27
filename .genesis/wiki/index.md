# Project wiki index — Book My Room

Canonical documents live one level above; the wiki captures researched implementation knowledge without changing
product scope. Read only pages relevant to the active milestone.

## Canonical

- `../PROJECT-SPEC.md` — product, behavior, security, SEO, performance and scope.
- `../ARCHITECTURE.md` — boundaries, integrations, availability, rendering and environments.
- `../DATA-MODEL.md` — entities, money/time rules, indexes and retention.
- `../QUALITY-GATES.md` — checks, test strategy and launch gates.
- `../REQUIREMENTS-TRACEABILITY.md` — requirement-to-milestone coverage.
- `../decisions/decisions-manifest.md` — accepted ADRs and controlled unknowns.

## Concept pages to create when researched

- `concepts/nextjs-installed-version.md`
- `concepts/mongodb-transactions-and-indexes.md`
- `concepts/imagekit-media-contract.md`
- `concepts/eps-merchant-contract.md`
- `concepts/booking-state-machine.md`
- `concepts/inventory-concurrency-evidence.md`
- `concepts/seo-structured-data.md`
- `concepts/security-threat-model.md`
- `concepts/backup-restore-runbook.md`

Each page records date, exact version/environment, primary source, conclusion, affected ADR/milestone, and expiry or
revalidation trigger. Research can inform an ADR but cannot silently override `PROJECT-SPEC.md`.
