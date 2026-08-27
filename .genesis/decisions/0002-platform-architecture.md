# ADR-0002 — Platform architecture

- Date: 2026-08-27
- Status: accepted

## Decision

Build a modular monolith in the existing Next.js App Router repository, using TypeScript, MongoDB, and ImageKit.
External payments, media, maps, messages, analytics, and job infrastructure sit behind typed ports/adapters.

## Why

This matches the requested stack and current frontend, supports server-rendered SEO pages and dashboards, and avoids
the delivery/consistency burden of microservices. Strict module boundaries and versioned use cases keep future mobile
clients and selective extraction possible.

## Consequences

Domain code cannot import UI/framework/provider SDKs. MongoDB transactions require a compatible production cluster.
Provider selection beyond EPS/ImageKit remains open. Every environment is isolated, configured, and validated.
