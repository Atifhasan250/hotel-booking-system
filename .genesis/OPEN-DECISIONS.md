# Owner decision interview

These questions do not block M0. Resolve them before the “needed by” milestone and record answers in a new ADR.

## Before M2/M4

- Which districts and verified properties/destinations launch first?
- English, Bengali, or both at launch? Who owns final copy and image rights?
- Which map provider and what address/coordinate validation workflow?
- Official WhatsApp support number, hours, escalation and approved prefilled message?

## Before M5/M7

- Resolved baseline in ADR-0006 by owner instruction: property-approved policy first; otherwise 48-hour flexible
  cancellation with a one-discounted-night late/no-show penalty; explicitly approved non-refundable fees remain
  chargeable. Cancellation remains a request until M7 resolution.
- Still required per property: approved check-in/out, child, extra-bed, couple, pet and any override/exception policy.
- Resolved contract in ADR-0006: merchant-configured/admin-approved versioned tax profiles, no invented default
  percentage, required supplier/purchaser/supply/value/tax invoice fields, and atomic merchant/year invoice sequence.
- Still required per real merchant: verified legal name/address/BIN/registration status and approved effective tax/
  fee rules. These are onboarding/finance facts, not platform defaults.

## Before M6

- Provide official EPS merchant API docs, sandbox account, callback/webhook/signing rules, allowed origins/IPs,
  statuses, timeout/retry guidance, refund API, reconciliation/settlement report, and production go-live checklist.

## Before M9/M10

- Commission formula/tier/validity, vendor settlement/payout process, subscription entitlements and ad pricing?
- Chosen email and SMS providers, sender identity, content approval, opt-out/support rules?
- Analytics provider/consent policy and operational reporting definitions?

## Before M11

- Hosting/regions, expected concurrent traffic/search/booking load and budget?
- RPO, RTO, backup retention, personal/financial/audit retention, deletion/anonymization policy?
- Approved Terms, Privacy, Refund/Cancellation, vendor agreement, support contacts and incident owner?

For every answer record owner, date, rationale, affected requirements, migration/rollback and whether existing data
must be backfilled. “Agent chose a common default” is not approval for production business behavior.
