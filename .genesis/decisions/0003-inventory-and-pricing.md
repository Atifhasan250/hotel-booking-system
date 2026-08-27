# ADR-0003 — Inventory holds and pricing snapshots

- Date: 2026-08-27
- Status: accepted

## Decision

Availability is protected by an atomic, expiring inventory hold across every room night. Checkout uses an immutable,
expiry-bound server price quote. Confirmation atomically consumes the hold exactly once.

## Why

A simple “check then insert” can oversell under concurrency. Recalculating historical price/policy/commission from
current vendor settings makes invoices, refunds, and reports inconsistent.

## Consequences

MongoDB transaction support is mandatory for production booking. Expiry cleanup is not the correctness mechanism.
All money is integer minor units. Booking stores quote, policy and commission snapshots, plus append-only state events.
