# Confidential Tokens

Confidential balances for Cluster multisig accounts on **Stellar testnet**. Transfer amounts and
balances are hidden on-chain (Pedersen commitments `C = v·G + r·H`; the network sees only commitments +
UltraHonk zero-knowledge proofs), built on the OpenZeppelin confidential-token protocol.

**What makes it Cluster's:** a classic **multisig** account owns the confidential balance. Co-signers
approve each confidential spend through the existing propose → sign → submit pipeline **and can decrypt
and see the amount before signing** — the multisig differentiator vs. the single-user reference demo.

> ⚠️ **Testnet only, unaudited.** The OZ contracts are unaudited; this feature is scoped to testnet and
> kept separate from the mainnet app. Do not use for real value.

---

## Status

| Stage | Scope | State |
|-------|-------|-------|
| **1 — Foundation** | `@cluster/zk` crypto + proving, shared DTOs/enum, contract bindings, network resolver | ✅ merged |
| **2 — API + builders + disclosure UI** | `/confidential` API, Soroban builders, chain/auditor layer, browser bb.js infra, `/verify` + `/disclose` + `/auditor` | ✅ merged |
| **3 — Full web flows + E2E** | provisioning, propose→prove→submit wiring, signer decrypt-amount view, confidential UI, sync engine, testnet E2E + docs | ⬜ **remaining** |

The crypto/proving core is verified (real bb.js UltraHonk proof self-verifies; the on-chain
`address_to_field` anchor matches; XDR payloads are byte-for-byte identical to the reference). The
**end-to-end confidential flow has not yet been run on testnet** — that is Stage 3 (see [What's left](#whats-left)).

---

## Architecture

```
packages/zk                    the crypto + proving core (browser-safe)
  .                            Grumpkin/Poseidon2, key derivation, X25519 sealed-box,
                               k_store openings, XDR codec, StateEngine, disclosure prove/verify,
                               UltraHonk proving wrapper (bb.js, KECCAK transcript — mandatory)
  /node                        node-only: loadCircuit, loadDisclosureVk, proveRegister/Transfer/Withdraw, JsonFileStore
  /chain                       chain reader + event fetch + auditor decrypt (ChainClient, hybridFetchEvents, auditTransfer/Withdraw)
packages/stellar               soroban.ts (buildInvocation) + builders/confidential.ts (5 op builders)
packages/contracts/*           generated TS bindings: @cluster/contract-confidential-{token,verifier,auditor}
packages/shared                TransactionType.confidential, ConfidentialOp/RegStatus enums, DTOs
apps/api/src/confidential      server-blind persistence module (service + controller + module)
apps/web/app/{verify,auditor}  public pages (no wallet, no session)
apps/web/app/(dashboard)/[accountId]/disclose   holder disclosure flow (auth-gated)
apps/web/lib/{zk-rpc,bb-loader,confidential/*}   RPC client, browser bb.js loader, session hooks
```

**Key invariants**
- **Server is blind.** The API persists only ciphertexts / public keys (never an amount, blinding factor,
  or secret `sk`); `apps/api/src/confidential` never imports `@cluster/zk`.
- **Per-member wrapped `sk`.** Each member's spending secret is sealed to their X25519 wrap key
  (server-blind key distribution); the browser unwraps it per session and never persists it.
- **KECCAK transcript is load-bearing.** All bb.js proving/verifying uses `{ keccak: true }` — a Poseidon
  transcript silently fails against the on-chain verifier.
- **Proving runs in the browser** (bb.js UltraHonk) — needs cross-origin isolation (COOP/COEP) + the
  vendored bb.js worker assets.

## How a confidential operation flows

```
build witness (@cluster/zk)  →  prove in browser (bb.js UltraHonk, keccak)
      →  encode {payload, proof} XDR (@cluster/zk)
      →  build Soroban tx wrapping the generated binding (@cluster/stellar buildXxxTx)
      →  propose via the existing multisig pipeline (type: "confidential", confidentialOp)
      →  co-signers review (decrypt & SEE the amount) and sign
      →  auto-submit at threshold
```
The tx **source is always the multisig G-address**; Soroban `require_auth` is satisfied by the envelope
signatures the pipeline already collects (no `SorobanAuthorizationEntry` signing). A confidential **spend**
(`merge`/`transfer`/`withdraw`) binds the current `spendable` commitment, so the API **serializes** them:
proposing one while another is pending/ready returns **409** (`register`/`deposit` are exempt).

## API — `/confidential` (JwtAuthGuard)

| Method & route | Purpose |
|---|---|
| `PUT /confidential/wrap-key` | publish the member's X25519 wrap public key (identity from session) |
| `GET /confidential/wrap-key/:userPublicKey` | fetch a member's wrap key |
| `PUT/GET /confidential/accounts/:id/envelopes` | per-member sealed-`sk` envelopes |
| `PUT/GET /confidential/accounts/:id/openings` | `k_store`-encrypted event openings (idempotent) |
| `POST/PATCH/GET /confidential/accounts/:id/registration` | confidential registration state |

Transactions ride the existing `POST /accounts/:id/transactions` with `type: "confidential"` + `confidentialOp`.

## Web routes

| Route | Access | What |
|---|---|---|
| `/(dashboard)/[accountId]/disclose` | auth-gated (member) | holder generates a selective-disclosure bundle for a verifier |
| `/verify` | **public** (no wallet, no session) | anyone pastes a disclosure bundle → sees the decrypted amount + validity |
| `/auditor` | **public, secret-gated** | auditor pastes the auditor secret → decrypts all transfers (read-only) |

`/verify` and `/auditor` are structurally public (static, fenced by a test that forbids `useAuth`/wallet imports).

## Deployed testnet contracts

| | Contract ID |
|---|---|
| token | `CAPLH4ZW7EDSYRBCQN77Y4K7W5RNA6TO76JQ5CGHHIPY4ALWVQZ2WFAY` |
| verifier | `CC6NG5LWW6QA4YSW2RP7RR2CE5FF6IHAGJEYY4STG6QP563EWSZU5DG7` |
| auditor | `CAEYYDRJPJ73UR3UZWYLSIWW4CHUZILTSENAWOUYXGSR4LPY4HQ23R4L` |
| underlying (XLM SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

Network: `Test SDF Network ; September 2015`. Auditor `id = 0`.

## Environment & security

API (`apps/api/.env`) — testnet is an explicit opt-in; mainnet env is untouched:
```
STELLAR_NETWORK=testnet
STELLAR_RPC_URL / STELLAR_HORIZON_URL / STELLAR_TESTNET_RPC_URL
CONFIDENTIAL_{TOKEN,VERIFIER,AUDITOR}_CONTRACT_ID   # optional; the confidential module asserts presence at use
CONFIDENTIAL_UNDERLYING_SAC
CONFIDENTIAL_AUDITOR_ID=0
```
Web (`apps/web/.env`): `NEXT_PUBLIC_` mirrors of the contract IDs + `NEXT_PUBLIC_STELLAR_RPC_URL`.

**Security musts**
- 🔴 **The auditor secret is a master key** — it decrypts *every* confidential amount. Do **NOT** set
  `NEXT_PUBLIC_CONFIDENTIAL_AUDITOR_SECRET_HEX` in any shared/prod build: Next inlines `NEXT_PUBLIC_*`
  into the public client JS, which would leak it to every visitor. The auditor **pastes it at runtime**
  on `/auditor`; it stays in the browser and is never transmitted. (The var is a local-dev convenience only.)
- The server never sees `sk`, amounts, or the auditor secret — persistence is blind.
- Envelope ciphertext is **hex-encoded on the wire**; the provisioning path (`PUT …/envelopes`) must
  hex-encode `sealSecret` output to round-trip.

## Running & testing

```bash
npm install
npx prisma migrate deploy           # applies the confidential migrations (needs DATABASE_URL/DIRECT_URL)
npm run vendor:bb -w web            # vendor bb.js browser assets (also runs on predev/prebuild)
npx turbo run lint typecheck build test   # full monorepo gate
npm run dev                         # api :3001, web :3000
```
Tests are **offline** (mocked RPC/wallet/bb.js at the edges) except one real Node bb.js proof in
`@cluster/zk`. The confidential crypto is the risk surface and is covered byte-for-byte against the
reference; UI/mechanical code is lean-tested.

## What's left

**Stage 3 (M4)** — turns the built pieces into a usable end-to-end flow:
1. **Provisioning** — activate confidential for an account: generate the account secret, wrap `sk`
   per member (`sealSecret`) → `PUT` envelopes → on-chain `register`. *(The unwrap side exists; the
   wrap/distribute side does not yet.)*
2. **propose → prove → submit wiring** — a helper tying witness → browser proof → Soroban build →
   multisig pipeline → signatures → submit.
3. ⭐ **Signer decrypt-amount view** — co-signers see the decrypted amount before signing.
4. **Confidential UI** — deposit / merge / transfer / withdraw forms + balance + activity.
5. **Full sync engine** — events → decrypt → persist `k_store`-encrypted openings (today only a read-only minimal hook).
6. **Testnet E2E** (acceptance gate, not yet run): 2-of-3 multisig → register → deposit → merge →
   transfer (2nd signer sees the amount) → withdraw → explorer shows only commitments.

**Also owed:** real in-browser proving validation (only Node/mocks so far).

**Minor follow-ups:** single-source the disclosure VKs (`apps/web/lib/zk-artifacts/` duplicates
`packages/zk/circuits/`) · add a D-sender disclosure test fixture · `formatXlm` assumes 7 decimals ·
dead resolver branch in `vendor-bb.mjs`.

**Contract-side note (not Cluster):** the token binding ships `Point` as `#[contracttype(export=false)]`,
so two read-only view methods (`confidential_balance`, `get_spender_delegation`) can't be decoded through
the generated binding until the contract re-exports `Point`. The `@cluster/zk/chain` reader decodes
points manually and sidesteps this for reads.

**Consume without drift** the frozen surfaces: `@cluster/zk` (`.` / `/node` / `/chain`),
`@cluster/stellar` builders, and the `/confidential` API.
