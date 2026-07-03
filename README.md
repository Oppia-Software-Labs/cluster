# Cluster — Confidential Tokens on Stellar

Confidential balances for **multisig** accounts on Stellar. Transfer amounts and balances are hidden
on-chain using Pedersen commitments and UltraHonk zero-knowledge proofs, while a classic multisig account
owns the balance and its co-signers can **decrypt and see each amount before they sign**.

Built on the OpenZeppelin confidential-token protocol and deployed on **Stellar testnet**.

> **Testnet only.** The underlying contracts are unaudited; this feature runs on Stellar testnet and is
> intentionally kept separate from any mainnet deployment. Do not use for real value.

---

## What it does

- **Confidential balances** — amounts live on-chain only as Pedersen commitments `C = v·G + r·H`. The
  network sees commitments and zero-knowledge proofs, never plaintext values.
- **Multisig-owned confidential funds** — a standard Stellar multisig account holds the confidential
  balance and approves every spend through Cluster's existing propose → sign → submit pipeline.
- **Co-signers see the amount before signing** — each member can locally decrypt a pending confidential
  transfer and review the real value before adding their signature. This is the core differentiator over
  the single-user reference design.
- **The five confidential operations** — `register` (activate confidential for an account),
  `deposit` (public → confidential), `merge` (fold received funds into spendable), `confidential_transfer`
  (hidden amount), and `withdraw` (confidential → public).
- **Selective disclosure** — a holder can generate a proof that reveals a single transfer's amount to a
  chosen verifier, who checks it on a public page **without a wallet or an account**.
- **Auditor view** — the designated auditor can decrypt every transfer of the token (regulatory
  transparency), entirely client-side.

## How it works

Amounts are hidden behind Pedersen commitments; every state transition is accompanied by an UltraHonk
(Barretenberg / `bb.js`) proof that the transition is valid, verified on-chain by a Soroban verifier
contract. Cluster adds a **server-blind, per-member key layer** on top of the single-user protocol so a
multisig can own the balance:

- Each account has one spending secret `sk`. It is **sealed individually to every member** (X25519
  sealed-box) so the server only ever stores ciphertext — it never sees `sk`, an amount, or a blinding
  factor.
- A member's browser unwraps its copy of `sk` for the session (deriving the wrap key from a wallet
  message signature, SEP-53), decrypts balances/transfers locally, and never persists the secret.
- Proofs are generated **in the browser** with `bb.js` UltraHonk under a **keccak transcript** (the
  on-chain verifier requires keccak; a Poseidon transcript silently fails).

A confidential operation flows through the existing multisig pipeline:

```
build witness  →  prove in browser (bb.js UltraHonk, keccak)
   →  encode the { payload, proof } XDR
   →  build a Soroban transaction wrapping the generated contract binding
   →  propose to the multisig pipeline (type: "confidential")
   →  co-signers decrypt the amount, review, and sign
   →  auto-submit once the threshold is met
```

The transaction **source is always the multisig G-address**, so Soroban's `require_auth` is satisfied by
the envelope signatures the pipeline already collects — no separate authorization signing. Because a
confidential **spend** proof binds the account's current balance commitment, the API **serializes**
spends: proposing a `merge`/`transfer`/`withdraw` while another confidential transaction is still awaiting
signatures returns HTTP 409 (`register`/`deposit` are exempt).

## Repository layout

Turborepo monorepo (npm workspaces):

```
packages/zk                    ZK cryptography + proving core (TypeScript, browser-safe)
  .                            Grumpkin curve, Poseidon2, key derivation, X25519 sealed-box,
                               k_store-encrypted openings, XDR payload codec, StateEngine
                               (balance reconstruction), selective-disclosure prove/verify,
                               and the bb.js UltraHonk proving wrapper (keccak transcript)
  /node                        Node-only helpers (circuit/VK loaders, prove ops, JSON store)
  /chain                       chain reader + event fetch + auditor decryption
packages/stellar               Soroban invocation helper + the five confidential tx builders
packages/contracts/*           generated TypeScript bindings for the token/verifier/auditor contracts
packages/shared                shared enums + zod DTOs (TransactionType.confidential, ConfidentialOp, …)
packages/ui                    shared React component library
apps/api                       NestJS API — includes the server-blind `confidential` module
apps/web                       Next.js app — /verify, /auditor, holder /disclose, session hooks,
                               browser bb.js loader + cross-origin-isolation setup
prisma                         schema + migrations (confidential models are additive)
```

## Tech stack

- **Language / tooling:** TypeScript, Turborepo, npm workspaces, tsup, Vitest, Jest
- **ZK / crypto:** `@aztec/bb.js` (Barretenberg UltraHonk), Noir circuits, `@noble/curves`,
  `@noble/hashes`, `@noble/ciphers`, `@zkpassport/poseidon2`
- **Stellar:** `@stellar/stellar-sdk`, Soroban smart contracts, Stellar Wallets Kit (SEP-53 signing)
- **API:** NestJS, Prisma, PostgreSQL
- **Web:** Next.js (App Router), React, TanStack Query, Tailwind

## Deployed testnet contracts

| Role | Contract ID | Explorer |
|------|-------------|----------|
| Confidential token | `CAPLH4ZW7EDSYRBCQN77Y4K7W5RNA6TO76JQ5CGHHIPY4ALWVQZ2WFAY` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CAPLH4ZW7EDSYRBCQN77Y4K7W5RNA6TO76JQ5CGHHIPY4ALWVQZ2WFAY) |
| Verifier | `CC6NG5LWW6QA4YSW2RP7RR2CE5FF6IHAGJEYY4STG6QP563EWSZU5DG7` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CC6NG5LWW6QA4YSW2RP7RR2CE5FF6IHAGJEYY4STG6QP563EWSZU5DG7) |
| Auditor | `CAEYYDRJPJ73UR3UZWYLSIWW4CHUZILTSENAWOUYXGSR4LPY4HQ23R4L` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CAEYYDRJPJ73UR3UZWYLSIWW4CHUZILTSENAWOUYXGSR4LPY4HQ23R4L) |
| Underlying asset (XLM SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

Network passphrase: `Test SDF Network ; September 2015`. Auditor id: `0`.

## Getting started

**Prerequisites:** Node.js ≥ 18, npm, a PostgreSQL database (e.g. Supabase), and the
[`stellar` CLI](https://developers.stellar.org/docs/tools/cli/install-cli) if you want to regenerate
contract bindings.

```bash
# 1. install
npm install

# 2. configure env (see below)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. apply database migrations
npx prisma migrate deploy            # needs DATABASE_URL / DIRECT_URL

# 4. vendor the bb.js browser assets (also runs automatically on predev/prebuild)
npm run vendor:bb -w web

# 5. run
npm run dev                          # API on :3001, web on :3000

# quality gate
npx turbo run lint typecheck build test
```

## Environment variables

API (`apps/api/.env`) — testnet is an explicit opt-in; any mainnet configuration is untouched:

```
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=…                 # active-network Soroban RPC
STELLAR_HORIZON_URL=…
STELLAR_TESTNET_RPC_URL=…         # cross-network testnet opt-in
DATABASE_URL=… / DIRECT_URL=…
CONFIDENTIAL_TOKEN_CONTRACT_ID=CAPLH4ZW…
CONFIDENTIAL_VERIFIER_CONTRACT_ID=CC6NG5LW…
CONFIDENTIAL_AUDITOR_CONTRACT_ID=CAEYYDRJ…
CONFIDENTIAL_UNDERLYING_SAC=CDLZFC3S…
CONFIDENTIAL_AUDITOR_ID=0
```

Web (`apps/web/.env`): `NEXT_PUBLIC_` mirrors of the contract IDs and RPC URL.

## Security model

- **The server is blind.** The API persists only ciphertexts and public keys — never an amount, a
  blinding factor, or a spending secret. The `apps/api/confidential` module does not import the ZK
  package at all.
- **Per-member key isolation.** Each member holds their own sealed copy of the account secret; it is
  unwrapped only in the member's browser, for the session, and is never transmitted or stored.
- **Keccak transcript** is used for all proving and verification to match the on-chain verifier.
- **The auditor secret is a master key** — it can decrypt every confidential amount. It is entered on the
  `/auditor` page at runtime and stays in the browser. Do **not** bake it into a build via a
  `NEXT_PUBLIC_*` variable in any shared or production deployment: Next.js inlines those into the public
  client bundle, which would expose the key to everyone.

## Testing

The suite runs fully offline. Network, wallet, and the `bb.js` prover are exercised through test doubles
at the edges (`bb.js` cannot run under jsdom), while the confidential cryptography — the part that must
match the chain — is verified directly: a **real UltraHonk proof** is generated and self-verified in
Node, the XDR payload codec is checked **byte-for-byte** against reference vectors, and the on-chain
`address_to_field` value is asserted against the deployed contract. Run it with:

```bash
npx turbo run test          # @cluster/zk, @cluster/stellar, @cluster/shared, api, web
```

## Scope

This repository provides the confidential-token stack end to end at the library and service layers — the
ZK cryptography and browser proving (`@cluster/zk`), the on-chain transaction builders
(`@cluster/stellar`), the server-blind API (`apps/api`), the generated contract bindings, and the public
disclosure, verification, and auditor web surfaces. The in-wallet transaction screens that drive
deposit/transfer/withdraw are built on top of these libraries.

## Resources & references

- OpenZeppelin Stellar contracts (confidential token) — https://github.com/OpenZeppelin/stellar-contracts
- Reference confidential-token demo — https://github.com/brozorec/stellar-confidential-token-demo
- Barretenberg / `bb.js` (UltraHonk proving) — https://github.com/AztecProtocol/aztec-packages
- Noir (ZK circuits) — https://noir-lang.org
- Stellar / Soroban docs — https://developers.stellar.org
- SEP-53 (signed messages) — https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md
- Stellar Wallets Kit — https://github.com/Creit-Tech/Stellar-Wallets-Kit

## Acknowledgements

Confidential-token protocol and circuits by OpenZeppelin; reference SDK/app patterns adapted from
`brozorec/stellar-confidential-token-demo`. Proving powered by Aztec's Barretenberg.
