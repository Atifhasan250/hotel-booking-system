# Book My Room Genesis guide

This `.genesis/` directory is already initialized for the supplied project and requirements. Do not run a generic
scaffold over it.

## The durable spine

- `PROJECT-SPEC.md`: locked product truth, release scope and open decisions.
- `ARCHITECTURE.md`: chosen modular Next.js/MongoDB/ImageKit architecture.
- `DATA-MODEL.md`: canonical data/financial/inventory contracts.
- `QUALITY-GATES.md`: non-build verification and launch gates.
- `REQUIREMENTS-TRACEABILITY.md`: ensures no supplied requirement disappears.
- `PLAN.md`: ordered milestones and exact outcomes.
- `decisions/`: accepted ADRs and decision blockers.
- `KICKOFF.md`: cold-session prompt.
- `CURRENT.md` and implementation notes: actual state, never aspirational state.

## Working rule

The spec says what; architecture/data model say constraints; plan says order; existing code says current reality.
Where they differ, do not pretend the existing UI already implements the spec. Extend it milestone by milestone and
preserve its design direction. Verify with evidence and a separate checker. Never use `npm run build`.

## Owner decisions

Use `OPEN-DECISIONS.md` before the relevant milestone. The agent may recommend options but must not invent provider,
legal, tax, commission, support, localization, or capacity facts.
