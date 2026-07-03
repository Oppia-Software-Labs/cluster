# Cluster

**A multisig treasury platform for Stellar** — create shared accounts governed by multiple signers and
approval thresholds, then propose, co-sign, and submit transactions together. On top of standard
multisig, Cluster adds asset management, trustlines, DeFi yield (DeFindex vaults), and **confidential
tokens**: balances and transfer amounts hidden on-chain with zero-knowledge proofs, where co-signers can
still decrypt and review each amount before they sign.

Cluster is a Turborepo monorepo: a NestJS API, a Next.js web app, and shared TypeScript packages
(Stellar helpers, ZK cryptography, generated contract bindings, UI, and shared DTOs).

---

## Overview

A Stellar account can be turned into a **multisig account** by adding signer keys with weights and setting
low/medium/high operation thresholds. Cluster is the coordination layer on top of that primitive:

- **Connect a wallet** and sign in — no passwords. Authentication is a signed challenge (SEP-53
  `signMessage`) exchanged for a session cookie.
- **Create and manage multisig accounts** — add or remove signers, set weights and thresholds, and
  disable the master key, all through native Stellar `setOptions` operations.
- **Propose → co-sign → submit** — any member proposes a transaction; the others review and add their
  signatures; Cluster combines them and submits to the network once the required threshold weight is met.
- **See everything in one place** — balances, transaction history and status, trustlines, and the
  proposals awaiting your signature.

Members never hand over keys: every transaction is signed by each member's own wallet, and Cluster only
assembles and submits what the group has approved.

## Features

- **Wallet authentication** — SEP-53 signed-message login (challenge → verify → session cookie), via
  Stellar Wallets Kit.
- **Multisig accounts** — real Stellar multisig (weighted signers + low/medium/high thresholds + optional
  master-key disable).
- **Members & thresholds** — add/remove co-signers and adjust the signing policy through the same
  propose-and-approve pipeline.
- **Transaction pipeline** — a single propose → sign → submit flow for every transaction type: payments,
  account configuration changes, trustlines, DEX trades, DeFindex vault deposits/withdrawals, and
  confidential-token operations.
- **Assets & activity** — token balances, transaction history, and an activity view with
  pending / done / expired proposals.
- **Payments & trustlines** — send assets and manage trustlines from the multisig account.
- **Invest (DeFindex)** — deposit into and withdraw from DeFindex yield vaults.
- **Confidential tokens (zero-knowledge)** — the highlight below.

## Confidential tokens (zero-knowledge)

Cluster's differentiating feature: **private balances for a multisig account** on Stellar. Amounts and
balances are hidden on-chain — the network stores only Pedersen commitments (`C = v·G + r·H`) and
UltraHonk zero-knowledge proofs — while the account's co-signers can still **decrypt and see each amount
before signing**. Built on the OpenZeppelin confidential-token protocol and deployed on **Stellar
testnet**.

> **Testnet only, unaudited.** The confidential contracts are unaudited; this feature runs on Stellar
> testnet and is kept separate from mainnet activity. Do not use for real value.

**What it enables**

- **Confidential operations** through the normal multisig pipeline: `register` (activate confidential for
  an account), `deposit` (public → confidential), `merge` (fold received funds into spendable),
  `confidential_transfer` (hidden amount), and `withdraw` (confidential → public).
- **Co-signers see the amount before signing** — each member locally decrypts a pending confidential
  transfer and reviews the real value before adding their signature.
- **Selective disclosure** — a holder can prove a single transfer's amount to a chosen verifier, who
  checks it on a public page (`/verify`) without a wallet or an account.
- **Auditor view** — the designated auditor can decrypt every transfer of the token (`/auditor`),
  entirely client-side.

**How it works**

- Every state change carries an UltraHonk proof (Aztec Barretenberg / `bb.js`) verified on-chain by a
  Soroban verifier contract. Proofs are generated **in the browser** under a keccak transcript (required
  by the on-chain verifier).
- The account has one spending secret `sk`, **sealed individually to each member** (X25519 sealed-box).
  The server is **blind**: it stores only ciphertexts and public keys — never `sk`, an amount, or a
  blinding factor. A member's browser unwraps its copy of `sk` for the session (key derived from a wallet
  message signature) and never persists it.
- A confidential operation flows: `build witness → prove in browser → encode {payload, proof} XDR →
  build a Soroban transaction wrapping the generated contract binding → propose to the multisig pipeline →
  co-signers decrypt & review the amount → sign → auto-submit at threshold`.
- The transaction source is always the multisig G-address, so Soroban `require_auth` is met by the
  envelope signatures the pipeline already collects. Confidential spends bind the current balance
  commitment, so the API serializes them (a second concurrent spend proposal returns HTTP 409).

## Repository layout

Turborepo monorepo (npm workspaces):

```
apps/api                       NestJS API — auth, accounts, members/thresholds, transaction
                               pipeline, assets, DeFindex, and the server-blind `confidential` module
apps/web                       Next.js app — dashboard, members, transfer, activity, coins,
                               trustlines, invest, and confidential surfaces (disclose / verify / auditor)
packages/stellar               Stellar SDK helpers — multisig config ops, tx builders, signature
                               combination, submission, and the Soroban confidential builders
packages/zk                    ZK cryptography + proving core (browser-safe)
  .                            Grumpkin/Poseidon2, key derivation, X25519 sealed-box, k_store openings,
                               XDR payload codec, StateEngine, disclosure prove/verify, bb.js proving
  /node                        node-only helpers (circuit/VK loaders, prove ops, JSON store)
  /chain                       chain reader + event fetch + auditor decryption
packages/contracts/*           generated TypeScript bindings for the token/verifier/auditor contracts
packages/shared                shared enums + zod DTOs (transaction types, confidential ops, …)
packages/ui                    shared React component library
packages/config                shared TS / lint / build config
prisma                         database schema + migrations
```

## Tech stack

- **Monorepo / tooling:** Turborepo, npm workspaces, TypeScript, tsup, Vitest, Jest
- **API:** NestJS, Prisma, PostgreSQL, cookie-session auth
- **Web:** Next.js (App Router), React, TanStack Query, Tailwind
- **Stellar:** `@stellar/stellar-sdk`, Soroban smart contracts, Stellar Wallets Kit (SEP-53)
- **Zero-knowledge:** `@aztec/bb.js` (Barretenberg UltraHonk), Noir circuits, `@noble/curves`,
  `@noble/hashes`, `@noble/ciphers`, `@zkpassport/poseidon2`

## API overview

All routes except the public disclosure/verify surface sit behind a session-cookie guard.

| Area | Routes |
|------|--------|
| **Auth** | `GET /auth/challenge` · `POST /auth/verify` · `POST /auth/logout` · `GET /auth/me` |
| **Accounts** | `GET /accounts/:id` · members `GET/POST/DELETE /accounts/:id/members[/:memberId]` · `PATCH /accounts/:id/thresholds` |
| **Transactions** | `POST/GET /accounts/:id/transactions` · `POST /transactions/:id/signatures` · `POST /transactions/:id/submit` · `GET /transactions/pending-for-me` · `GET /transactions/:id` |
| **Assets** | `GET /accounts/:id/balances` · `GET /accounts/:id/history` |
| **DeFindex** | `POST /defindex/vault/:address/{deposit,withdraw}-xdr` · `GET /defindex/vault/:address/balance` |
| **Confidential** | wrap-keys · per-account `envelopes` / `openings` / `registration` (all server-blind) |

## Deployed testnet contracts (confidential tokens)

| Role | Contract ID | Explorer |
|------|-------------|----------|
| Confidential token | `CAPLH4ZW7EDSYRBCQN77Y4K7W5RNA6TO76JQ5CGHHIPY4ALWVQZ2WFAY` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CAPLH4ZW7EDSYRBCQN77Y4K7W5RNA6TO76JQ5CGHHIPY4ALWVQZ2WFAY) |
| Verifier | `CC6NG5LWW6QA4YSW2RP7RR2CE5FF6IHAGJEYY4STG6QP563EWSZU5DG7` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CC6NG5LWW6QA4YSW2RP7RR2CE5FF6IHAGJEYY4STG6QP563EWSZU5DG7) |
| Auditor | `CAEYYDRJPJ73UR3UZWYLSIWW4CHUZILTSENAWOUYXGSR4LPY4HQ23R4L` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CAEYYDRJPJ73UR3UZWYLSIWW4CHUZILTSENAWOUYXGSR4LPY4HQ23R4L) |
| Underlying asset (XLM SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

Network passphrase: `Test SDF Network ; September 2015`. Auditor id: `0`.

## Getting started

**Prerequisites:** Node.js ≥ 18, npm, a PostgreSQL database (e.g. Supabase), and a Stellar wallet
supported by Stellar Wallets Kit. The [`stellar` CLI](https://developers.stellar.org/docs/tools/cli/install-cli)
is only needed to regenerate contract bindings.

```bash
# 1. install
npm install

# 2. configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. apply database migrations   (needs DATABASE_URL / DIRECT_URL)
npx prisma migrate deploy

# 4. vendor the bb.js browser assets  (also runs automatically on predev/prebuild)
npm run vendor:bb -w web

# 5. run
npm run dev                           # API on :3001, web on :3000

# quality gate
npx turbo run lint typecheck build test
```

## Environment

The base app targets Stellar; **testnet is an explicit opt-in** used by DeFindex vaults and the
confidential-token feature, so a missing variable can never silently downgrade network safety.

API (`apps/api/.env`):

```
STELLAR_NETWORK=…                     # mainnet | testnet
STELLAR_RPC_URL / STELLAR_HORIZON_URL # active network
STELLAR_TESTNET_RPC_URL=…             # cross-network testnet opt-in
DATABASE_URL=… / DIRECT_URL=…
CONFIDENTIAL_{TOKEN,VERIFIER,AUDITOR}_CONTRACT_ID   # confidential feature
CONFIDENTIAL_UNDERLYING_SAC=…
CONFIDENTIAL_AUDITOR_ID=0
```

Web (`apps/web/.env`): `NEXT_PUBLIC_` mirrors of the network + confidential contract IDs.

## Security model

- **Non-custodial multisig.** Cluster never holds member keys; every transaction is signed by each
  member's own wallet, and the server only combines approved signatures and submits them.
- **Server-blind confidential storage.** The confidential API persists only ciphertexts and public keys —
  never an amount, a blinding factor, or a spending secret. Each member holds their own sealed copy of the
  account secret, unwrapped only in their browser and never transmitted.
- **The auditor secret is a master key** (it can decrypt every confidential amount). It is entered on the
  `/auditor` page at runtime and stays in the browser — do not bake it into a build via a `NEXT_PUBLIC_*`
  variable in any shared deployment, since Next.js inlines those into the public client bundle.

## Testing

The suite runs offline: the network, wallet, and `bb.js` prover are exercised through test doubles at the
edges (`bb.js` cannot run under jsdom), while the confidential cryptography — the part that must match the
chain — is verified directly: a real UltraHonk proof is generated and self-verified in Node, the XDR
payload codec is checked byte-for-byte against reference vectors, and the on-chain `address_to_field`
value is asserted against the deployed contract.

```bash
npx turbo run test
```

## Resources & references

- OpenZeppelin Stellar contracts (confidential token) — https://github.com/OpenZeppelin/stellar-contracts
- Reference confidential-token demo — https://github.com/brozorec/stellar-confidential-token-demo
- Barretenberg / `bb.js` (UltraHonk proving) — https://github.com/AztecProtocol/aztec-packages
- Noir (ZK circuits) — https://noir-lang.org
- Stellar / Soroban developer docs — https://developers.stellar.org
- SEP-53 (signed messages) — https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md
- Stellar Wallets Kit — https://github.com/Creit-Tech/Stellar-Wallets-Kit
- DeFindex — https://defindex.io

## Acknowledgements

Confidential-token protocol and circuits by OpenZeppelin; reference SDK/app patterns adapted from
`brozorec/stellar-confidential-token-demo`; zero-knowledge proving powered by Aztec's Barretenberg.
