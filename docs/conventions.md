# Cluster — Managed Shared-File Conventions

Some files in this monorepo are touched by multiple members. To avoid merge
conflicts and accidental regressions, these files follow strict rules. Member 1
(the unblocker) curates the shared foundation; everyone else **extends** it.

## The rules

| File / area | Convention |
|---|---|
| `packages/shared/*` | Member 1 curates. The Day-0 freeze (enums, `TransactionBuilder` interface, the 3 pipeline DTOs, entity DTOs/zod) is **additive only after freeze** — change via PR, never rewrite an existing exported shape. |
| `apps/api/src/app.module.ts` | The `imports` array is **append-only**. Add your module to the end; do not reorder or remove others. Member 1 resolves merge conflicts here. |
| `apps/web/lib/nav.ts` (nav registry) | **Append-only registry.** Each member adds their own nav entry to the end of the array. Nobody rewrites the shell or another member's entry. |
| `packages/stellar/builders/*` | **One file per transaction type** (`payment.ts` M3, `config.ts` M2, `trade.ts` M4). Never two people editing one builder file. |
| `packages/ui` | Primitives only. Features **compose, don't fork** — build on the exported primitives; do not copy a primitive into your feature and diverge. |

## Why

- **`@cluster/shared` is the Day-0 freeze.** Members 2–4 build their builders, DTOs,
  and forms against these contracts. An additive-only rule means their code never
  breaks when the shared package grows.
- **Append-only `app.module.ts` and `nav.ts`** turn two structurally conflicting
  edits into two clean appends — trivial to merge.
- **One builder file per type** keeps `packages/stellar/builders/` free of
  multi-author churn on the same file.
- **Compose-don't-fork in `@cluster/ui`** keeps the Squads-style dark dashboard
  visually consistent and lets primitive fixes propagate everywhere at once.

## Env & mainnet reminder

Cluster is **mainnet only** — real funds. Env vars live per app
(`apps/api/.env`, `apps/web/.env.local`); copy from the matching `.env.example`.
Never commit populated env files. CI needs none of these values: lint, typecheck,
and build run without secrets, and tests use mocks — they never hit mainnet.

## Commit conventions

Conventional-commit prefixes **without scope parens**: `feat:`, `fix:`, `chore:`,
`docs:`, `ci:`, `test:`, `refactor:`. Do not add `Co-Authored-By:` trailers or
"Generated with" footers.
