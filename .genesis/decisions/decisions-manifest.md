# Accepted decisions and controlled unknowns

Accepted on 2026-08-27 from the supplied requirements and current repository inspection.

## Accepted

- ADR-0001: Release 1 is the stay marketplace; adjacent travel services are future bounded modules.
- ADR-0002: modular Next.js monolith + MongoDB + ImageKit; provider boundaries for external services.
- ADR-0003: transaction-safe inventory holds and immutable quotes prevent oversell and price drift.
- ADR-0004: payment truth comes from verified EPS server events/provider verification, never browser redirect.
- ADR-0005: production public origin is `https://bookmyroom.site`; existing homepage visual direction is preserved.
- ADR-0006: property policy first with a versioned 48-hour/one-night fallback; merchant-configured approved tax
  profiles; required invoice identity and atomic merchant/year numbering.

## Must be decided before affected milestone

| Decision | Needed by | Owner/gate |
|---|---:|---|
| Official EPS merchant API, sandbox, signatures, callbacks, refunds, reports | M6 | Product owner + EPS |
| Property-specific cancellation overrides and exception authority beyond ADR-0006 fallback | M7 | Product/legal/operations |
| Real merchant identity/BIN and each merchant's approved tax/fee profile | M5 | Finance/legal/admin verification |
| Commission tiers, settlement/payout workflow | M9 | Product/finance |
| Launch districts, verified property/destination content | M2/M4 | Operations/content |
| Email, SMS, map, analytics, monitoring, backup/hosting providers | relevant milestone | Product/engineering |
| Launch language(s), policies, support contact/hours | M4/M10/M11 | Product/operations/legal |
| Launch load, RPO/RTO and retention periods | M11 | Product/engineering/legal |

Until decided: implement a typed adapter/fake where useful, record the blocker, and do not invent production facts.
