# ADR-0001 — Release scope

- Date: 2026-08-27
- Status: accepted

## Decision

Release 1 completes booking for Hotel, Resort, Eco Resort, Homestay, Cottage, and Villa inventory. Tour packages,
car rental, guide booking, national bus, domestic flight, mobile apps, AI recommendations, and loyalty are future
modules. Existing Tour/Car UI may remain only as non-bookable “Coming soon”/feature-flagged presentation.

## Why

The detailed requirements center on stay inventory, vendor operations, EPS payment, commission, and dashboards.
Transport/travel verticals have different inventory, supplier, cancellation, settlement, and legal contracts. Mixing
them into the first booking engine would make “complete” ambiguous and create unsafe fake functionality.

## Consequences

The platform architecture supports future modules, but no shared abstraction may erase room-night semantics. Future
services receive separate discovery, ADRs, acceptance criteria, provider contracts, and launch gates.
