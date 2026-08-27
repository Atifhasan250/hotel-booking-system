# Owner decision interview

These questions do not block M0. Resolve them before the “needed by” milestone and record answers in a new ADR.

## Before M2/M4

- Which districts and verified properties/destinations launch first?
- English, Bengali, or both at launch? Who owns final copy and image rights?
- Which map provider and what address/coordinate validation workflow?
- Official WhatsApp support number, hours, escalation and approved prefilled message?

## Before M5/M7

- Exact check-in/out, child, extra bed, couple, pet, no-show, cancellation and refund policies?
- Which rules are property-specific, platform minimums, or admin-overridable?
- Legal merchant name/address/tax fields, tax/fee calculation and invoice numbering rules?

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
