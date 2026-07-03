# Cluster

Cluster is a Stellar multisig platform. Members configure thresholds; any member proposes transactions; co-signers approve until the threshold is met; Cluster assembles and submits via Soroban RPC. The product covers account setup, member management, asset operations, and vault workflows through a shared propose → sign → submit pipeline.

## Monorepo layout

| Path | Role |
|------|------|
| `apps/api` | NestJS backend — accounts, transactions, confidential API |
| `apps/web` | Next.js frontend — dashboard, Activity, confidential UI |
| `packages/config` | Shared tooling configuration |
| `packages/shared` | Types and schemas shared across apps |
| `packages/stellar` | Stellar / Soroban client helpers |
| `packages/ui` | Shared React components |
| `packages/zk` | Confidential crypto — sealing, commitments, proof witness |
| `prisma` | Database schema and migrations |

## Development

```bash
npm install
npx prisma migrate dev
npx turbo run dev      # all apps
npx turbo run lint
npx turbo run typecheck
npx turbo run build
npx turbo run test
```

## Confidential tokens (testnet)

Confidential balances hide amounts on-chain as Pedersen commitments, with UltraHonk zero-knowledge proofs verified against deployed OpenZeppelin confidential-token contracts. Cluster's differentiator: a classic multisig account owns the confidential balance, and **co-signers decrypt the transfer amount in the browser before signing** — multisig safety applies to private transfers, not only public ones.

**Keys.** Each confidential account gets an in-browser account secret (`sk`). Before registration, `sk` is sealed per member with X25519 to wrap keys derived from wallet message signatures (SEP-53). The API stores only ciphertext envelopes — it never sees `sk`. After unlock, transfer openings are re-encrypted under a storage key derived from `sk` and synced via RPC events. Proof generation and witness construction run entirely in the browser (vendored bb.js; requires cross-origin isolation via COOP/COEP headers).

**Demo.** Step-by-step testnet acceptance script: [docs/confidential-demo.md](docs/confidential-demo.md).

### Limitations

- **1-of-N among key holders:** Any member who can unlock `sk` can decrypt all confidential history for that account — not per-transfer ACLs among members.
- **Removed members retain past view:** Revoking membership does not erase ciphertext they already hold; migrate funds and rotate to a new confidential registration if a member leaves.
- **RPC event retention (~7 days):** Encrypted-opening sync depends on replaying recent events; stale or missing events break local state on new devices.
- **Testnet only, unaudited contracts:** Do not use real funds or treat this as production-ready.
- **One confidential spend in flight:** The API rejects a second concurrent confidential propose (409) to protect proof footprint consistency — serialize deposit, merge, transfer, and withdraw operations.
