# ADR-0004 — EPS payment truth and safety

- Date: 2026-08-27
- Status: accepted, provider contract pending

## Decision

EPS integrates through a `PaymentProvider` adapter. A verified server callback/webhook and/or authoritative provider
verification decides payment state. Browser redirects only inform UX. All operations are idempotent and reconciled.

## Why

Redirects can be forged, abandoned, duplicated, or delivered out of order. Provider details are not supplied and
must not be guessed.

## Consequences

M6 cannot pass without official EPS merchant documentation and sandbox evidence. Amount/currency/merchant/signature/
reference validation, replay handling, refunds/status mapping, redaction, and reconciliation are contract tests.
Production activation requires human approval.
