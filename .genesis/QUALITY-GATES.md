# Verification and launch gates

Repository governance: never use `npm run build` as a verification command. Agents must add missing scripts and
tests in the relevant milestone, then run the narrowest checks plus the full non-build suite before approval.

## Per-change checks

Expected final commands (add scripts when the milestone introduces the tooling):

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run test:e2e
```

Do not claim a command passed unless it actually ran with exit code 0. If a script does not yet exist, report it
as not established; do not substitute a build. Use targeted test commands during iteration.

## Test strategy

- Unit: pricing, occupancy, date rules, state transitions, cancellation, commission, permissions.
- Property/generative: totals never negative, ledger balances, invalid transitions rejected, date invariants.
- Integration with real test MongoDB transaction support: holds/concurrency, repositories, indexes, outbox.
- Contract: EPS sandbox/fixtures, ImageKit signing, email/SMS/maps adapters with redacted golden payloads.
- E2E: visitor search to confirmed booking; failed/duplicate payment; customer cancellation; vendor isolation;
  vendor inventory/rates; admin approval/moderation/commission; invoice; accessibility-critical flows.
- Security: authorization matrix/IDOR, rate limits, CSRF/session, upload validation, injection/XSS, webhook replay.
- SEO/accessibility: metadata/canonical/robots/sitemap/structured data, automated a11y plus keyboard/manual checks.
- Performance: representative mobile page audit and search/hold concurrency/load tests with documented fixtures.

## Milestone done gate

All must be true:

1. Outcome and acceptance criteria in `PLAN.md` are demonstrated.
2. Relevant tests exist and fail for the regression when appropriate; full established checks pass.
3. No context-graph invariant is violated; no unauthorized files or existing design regressions.
4. Security, privacy, accessibility, SEO, and observability impacts are reviewed for the changed surface.
5. Documentation, environment example, migrations/index setup, and rollback notes are current.
6. A separate verifier reviews implementation and real command output. Maker cannot self-approve.
7. `CURRENT.md`, implementation notes, traceability status, and ADR/deviation log are updated.

## Release 1 launch gate

- All Release 1/1.1 requirements traced to verified tests/demos; no P0/P1 defects.
- EPS sandbox end-to-end, signed callback replay/amount mismatch tests, reconciliation and refund workflow pass;
  official production merchant configuration approved by a human.
- Concurrent inventory test proves no oversell and correct expiry/retry behavior.
- Cross-tenant authorization matrix passes for customer, vendor member/owner, admin, super admin.
- Backup restore drill succeeds; monitoring/alerts/on-call/support and rollback runbooks are exercised.
- Real production-like content has complete alt text, policies, district/property SEO, redirects and no fake reviews.
- Web performance/accessibility targets evaluated on representative routes/mobile; critical issues resolved.
- Legal/privacy/terms/cancellation/refund/tax/invoice fields and contact details approved by owner.
- Production/staging separation, HTTPS/security headers/CSP, secret rotation, rate limits, log redaction confirmed.
- `bookmyroom.site` DNS/canonical/robots/sitemap/analytics/monitoring verified after deployment.

## Evidence format

Each verification note records date, commit/worktree state, environment, command/scenario, exit/result, artifact or
test name, and unresolved risk. Screenshots alone are not proof of booking/payment/inventory correctness.
