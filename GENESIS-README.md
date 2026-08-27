# Book My Room — project Genesis

This archive is a ready-to-copy project spine for the existing `book-my-room` repository.

## Install

1. Extract this ZIP at the repository root so that `.genesis/` sits beside `app/` and `package.json`.
2. Do not overwrite application code. This archive intentionally contains project guidance only.
3. Merge the block in `AGENTS-GENESIS-SNIPPET.md` into the existing repository `AGENTS.md`; preserve its current
   Next.js instructions.
4. Start every agent session with `.genesis/KICKOFF.md`.
5. Treat `.genesis/PROJECT-SPEC.md` as product truth and `.genesis/PLAN.md` as execution order.

The existing homepage is a design baseline, not completed product functionality. The production domain is
`https://bookmyroom.site`; no third-party or previous-site content is a product dependency.

## Source-of-truth precedence

If instructions conflict, use this order:

1. Latest direct user instruction
2. Repository `AGENTS.md`
3. `.genesis/PROJECT-SPEC.md`
4. `.genesis/decisions/*.md`
5. `.genesis/ARCHITECTURE.md` and `.genesis/DATA-MODEL.md`
6. `.genesis/PLAN.md`
7. Existing code and older notes

Never run `npm run build` for verification. Use the milestone checks in `.genesis/QUALITY-GATES.md`.
