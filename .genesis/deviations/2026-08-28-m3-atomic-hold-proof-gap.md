# Deviation — M3 atomic hold acceptance was recorded without valid evidence

- Date discovered: 2026-08-28
- Status: atomic safety defect resolved and independently verified; overall M3 remains partial
- Affected requirement: PROJECT-SPEC §5, ADR-0003, ARCHITECTURE availability invariant, PLAN M3, QUALITY-GATES launch gate

## Evidence

`AvailabilityService.createHold` reads `inventoryDays` and overlapping `inventoryHolds`, calculates sellable quantity,
then inserts a new hold. The transaction does not update a shared inventory/version document or perform another
conditional write that conflicts when two different idempotency keys reserve the same `(roomTypeId, localDate)`.
MongoDB snapshot isolation therefore does not make the two read-then-insert transactions contend on inventory.

`tests/integration/availability.test.ts` labels its oversell case as sequential and loops with `await`; it does not
issue concurrent holds. M3 checkpoint wording that concurrent atomic holds were proven is unsupported.

## Impact and containment

- Do not describe M3 atomic hold acceptance as verified or use the current result as booking truth.
- M4 public surfaces use conservative copy and do not create bookings, holds, or final quotes.
- Before M5, design a per-night conditional reservation/version strategy inside a real MongoDB transaction, add
  parallel barrier-based replica-set tests, expiry/idempotency conflict tests, and obtain a fresh independent verdict.
- No production data migration is performed by this note. Rollback is documentation-only; the unsafe code must not be
  activated for production checkout.

## Resolution evidence (2026-08-28)

`CREATE_HOLD` now conditionally writes each shared `inventoryDays.version` within its MongoDB transaction. A real
replica-set test releases 12 distinct-key calls together against capacity 3 and proves exactly 3 holds commit.
Concurrent same-key retries converge to one hold; idempotency is request-bound; `bookingRef` is unique. Targeted
availability tests pass 13/13 and a fresh independent verifier approved the atomic correction with no atomic P0/P1.

This resolves only the defect described above. M3 remains `PARTIAL` because search correctness, total-price
pagination/sorts, required UI, query-plan evidence, and accessibility acceptance are independently rejected. The
ISO-string TTL index is also recorded as a P2 cleanup defect; expiry correctness does not depend on TTL cleanup.
