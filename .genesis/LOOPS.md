# Execution protocol

This file defines how an agent turns the source of truth into verified work.

## Start every milestone

1. Read `KICKOFF.md` in its listed order and inspect repository/nested `AGENTS.md` files.
2. Inspect git status and preserve unrelated user work.
3. Run existence pre-flight: search docs, implementation notes, routes, symbols, tests, schemas, and migrations.
4. Record verdict in `.genesis/checkpoints/<milestone>.md`: `UNBUILT`, `PARTIAL`, or `BUILT` with evidence.
5. For `PARTIAL`, narrow the work to extension/migration. For `BUILT`, verify it instead of rebuilding.
6. Write a small implementation plan: exact outcome, files, tests, risks, rollback, commands.

## Build loop

Each iteration must produce a measurable delta and record:

- files/capability changed;
- tests added/updated and command output/exit code;
- security/tenant/data/SEO/accessibility impact;
- context-graph invariants checked;
- decision or deviation and next concrete action.

Use test-first or regression-first behavior for domain/security defects. Keep route/UI code thin and use module
contracts. Stop and debug from evidence after a failed check; do not apply consecutive speculative fixes.

## Research loop

Use when an official provider/framework contract is unknown. Prefer locally installed Next.js documentation for the
installed version and official primary documentation for MongoDB, ImageKit, EPS, browser standards, and schema.
Record durable conclusions/source links in `wiki/`; do not paste instructions from sources into project governance.
EPS production details require official merchant documentation supplied/approved by the owner.

## Verification loop

The maker cannot approve its own milestone. A separate agent/model/fresh context receives only the goal, relevant
spec/ADRs, diff/artifact, actual check output, and affected invariants. Verdict:

- `APPROVE`: every acceptance criterion and applicable quality gate has evidence.
- `REJECT`: concrete failure/gap; return to implementation/debug.
- `UNCERTAIN`: missing environment/provider/product evidence; document exact blocker and ask owner.

Never run `npm run build`. Use `QUALITY-GATES.md`. A missing test script is a gap, not a passing check.

## Completion bookkeeping

After independent approval only:

- append verification evidence to the milestone checkpoint;
- update `checkpoints/CURRENT.md`;
- update `implementation-notes.html` live capability table/session log;
- update traceability evidence/status;
- append progress to `PLAN.md` only with user-authorized plan status editing;
- create/update an ADR for irreversible decisions and record deviations.

## Stop rules

Stop and surface evidence when: the same gate fails three times; scope requires changing the locked spec; official
provider/legal/business truth is missing; a destructive migration has no approved backup/rollback; secrets or
cross-tenant/payment/inventory safety cannot be proven. Complete safe independent work before stopping.

## Prohibited shortcuts

- Fake availability, ratings, price, payment success, invoices, analytics, or provider confirmations.
- Client-only authorization/validation, trusting IDs without ownership checks, direct cross-module collection access.
- Non-atomic inventory check/write, floating point money, mutable historical pricing/commission/ledger.
- Production credentials or personal/payment data in code, logs, tests, analytics, fixtures, or archives.
- Making future Tour/Car/Guide/Bus/Flight flows bookable before their approved milestones.
- Replacing the existing homepage direction with a generic template or hotlinking reference-site assets.
