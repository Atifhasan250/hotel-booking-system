# ADR-0006 — Booking policy, tax configuration, and invoice baseline

- Date: 2026-08-28
- Status: accepted by direct owner instruction
- Scope: M5/M7 booking snapshots, cancellation fallback, tax configuration, invoice identity/numbering

## Context and sources

The owner instructed the implementation agent to research how comparable operators handle the previously open M5
decisions and adopt one approach. Sources checked on 2026-08-28:

- Bangladesh Parjatan Corporation says cancellation follows each property's policy and displayed totals usually
  include applicable taxes/service charges:
  `https://hotels.gov.bd/frontend/faq`
- TravellersGuru states that property cancellation policies commonly use a 24–72 hour window and that some fees
  can be non-refundable:
  `https://www.travellersguru.com.bd/site/terms-conditions`
- A published Bangladesh hotel booking document uses 48 hours and a one-room-night charge for late cancellation
  and no-show:
  `https://www.bgba.org.bd/wp-content/uploads/2026/04/Hansa.pdf`
- NBR's VAT FAQ identifies Mushak-6.3 as the tax invoice and lists purchaser, invoice number, seller BIN,
  purchaser BIN where applicable, supply detail/quantity/value and tax:
  `https://nbr.gov.bd/faq/vat-faq/en`
- NBR's VAT & SD Rules form also shows registered-person name/BIN, issue address, date and time:
  `https://nbr.gov.bd/uploads/rules/14.pdf`

These sources evidence common presentation/contract patterns, not legal advice for a specific merchant. NBR also
publishes rates and amendments that can vary by service/merchant facts; therefore a universal percentage must not
be inferred solely from the standard-rate FAQ.

## Decision

1. A property's explicitly approved, versioned cancellation policy remains authoritative. If it does not provide a
   stricter/different approved policy, Book My Room uses `FLEXIBLE_48H_V1`: cancellation at least 48 hours before
   property-local check-in has no room penalty; later cancellation and no-show charge one discounted room night.
   Explicitly configured non-refundable fee lines are added to that penalty. Refund never becomes negative.
2. Cancellation is still a request until M7 evaluation/operations resolves it. M5 only snapshots and deterministically
   previews the rule; it does not execute a refund.
3. Prices show the final total before consent. Tax and fee lines are merchant-configured, versioned, effective-dated,
   and admin-approved. There is no platform convenience fee in M5. No production quote may invent or silently apply
   a tax percentage; calculation order, basis points, inclusion mode, rounding and refundability come from the
   approved merchant profile.
4. The property/vendor is the invoice supplier/merchant of record unless a later legal review changes it. Invoice
   issuance requires legal name, issue address, merchant code, and BIN when the profile says it is VAT-registered.
   Customer name, supply details/quantity/value/tax, issue timestamp and immutable booking/payment snapshots are
   recorded. This is an application invoice contract, not a claim that an unreviewed PDF is an approved Mushak-6.3.
5. Invoice numbers use an atomic per-merchant, per-calendar-year sequence:
   `BMR-{MERCHANT_CODE}-{YYYY}-{8_DIGIT_SEQUENCE}`. Numbers are never reused or renumbered.

## Security and operational consequences

- Policy/tax/profile changes never rewrite a booking or invoice snapshot.
- Missing/unapproved/expired merchant tax profiles fail closed rather than assuming zero or a common rate.
- Invoice sequence allocation must occur in the same transaction as first invoice persistence and be idempotent by
  booking; ordinary application paths never delete invoices.
- Merchant legal/BIN data still must be supplied and verified during onboarding. This ADR chooses the contract and
  fallback policy, not any real business identity.

## Migration and rollback

No existing bookings or invoices exist. Rollback is removal of the new policy/profile selection before production;
issued invoice numbers or accepted booking snapshots must never be rewritten. A future policy change creates a new
version and applies only to new quotes/bookings.
