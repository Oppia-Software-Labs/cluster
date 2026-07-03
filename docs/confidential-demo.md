# Confidential token — testnet E2E demo

Manual acceptance script for the confidential-token milestone on Stellar testnet.

## Prerequisites

### Web (`apps/web/.env.local`)

```
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID=CAPLH4ZW7EDSYRBCQN77Y4K7W5RNA6TO76JQ5CGHHIPY4ALWVQZ2WFAY
NEXT_PUBLIC_CONFIDENTIAL_VERIFIER_CONTRACT_ID=CC6NG5LWW6QA4YSW2RP7RR2CE5FF6IHAGJEYY4STG6QP563EWSZU5DG7
NEXT_PUBLIC_CONFIDENTIAL_AUDITOR_CONTRACT_ID=CAEYYDRJPJ73UR3UZWYLSIWW4CHUZILTSENAWOUYXGSR4LPY4HQ23R4L
NEXT_PUBLIC_CONFIDENTIAL_AUDITOR_ID=0
```

### API

Configure the API database and set `STELLAR_NETWORK=testnet`. Run `npx prisma migrate deploy` so the new `confidentialPayload` column exists on pending transactions.

### Wallets

Three Freighter accounts funded via friendbot. A message-signing wallet (SEP-53 capable) is **required** — wrap keys are derived from a wallet message signature, not from the raw secret key alone.

### Underlying asset

Deposits use the XLM Stellar Asset Contract (SAC):

`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

### Security

`CONFIDENTIAL_AUDITOR_SECRET_HEX` must **never** be set as a `NEXT_PUBLIC_` variable in shared or production builds. The auditor pastes the secret at runtime on `/auditor`.

---

## Core happy path

### 1. Create a 2-of-3 testnet multisig

In Cluster, create a multisig account with three members and medium threshold 2. All three wallets should be connected at least once during setup.

**Expected:** Account appears in the dashboard; Activity and signing flows use the medium (2-of-3) threshold.

### 2. Activate confidential balances

Sidebar → **Confidential** → **Activate confidential** (3-step wizard).

**Step 1 — Publish wrap key:** Sign the wallet message when prompted. Members B and C should each visit the app once and publish their wrap keys before sealing for full envelope coverage; otherwise use **Grant access** on the overview later for members who joined after sealing.

**Step 2 — Generate & seal:** The wizard generates the account secret and seals it per member. Envelopes upload to the API; registration status shows pending.

**Step 3 — Propose registration:** Click to propose. Browser proof generation takes a few seconds — watch for **Proving & proposing…**. The second signer approves in **Activity**; at threshold the transaction auto-submits. The confidential overview auto-advances to **registered**.

**Expected:** Overview shows registered status; member roster lists sealed envelopes (or pending grant-access for late joiners).

### 3. Deposit 100 XLM

Confidential → **Deposit** → amount **100** → propose. Second signer approves in Activity.

**Expected:** After sync, the overview **Receiving** balance shows **100 XLM**. Deposit amounts are public by design (classic SAC transfer into the confidential pool).

### 4. Merge receiving into spendable

When **Receiving > 0**, the overview suggests merge. Propose merge → second signer approves.

**Expected:** **Receiving** drops to 0; **Spendable** shows **100 XLM**.

### 5. Confidential transfer (co-signer decrypt before sign)

Confidential → **Transfer** → **40 XLM** to another **registered** confidential account → propose.

Switch to the **second signer**. Open **Activity** — the confidential transfer row shows an encrypted panel. Press **Unlock** (wallet message signature). The decrypted detail (**40 XLM → G…**) renders **before** signing. Sign → auto-submit at threshold.

**Expected:** This is the milestone differentiator: co-signers review the plaintext amount prior to approval. Spendable balance decreases by 40 after sync.

### 6. Explorer check

Open the submitted transaction on [stellar.expert](https://stellar.expert/explorer/testnet) (testnet).

**Expected:** Contract invocation shows Pedersen commitment bytes and proof data only — no transfer amounts in cleartext on-chain.

### 7. Withdraw 20 XLM

Confidential → **Withdraw** → **20** → propose → second signer approves.

**Expected:** **Spendable** drops by 20; classic XLM wallet balance increases by 20. Withdraw amounts are public by design.

---

## Optional — disclosure and auditor

| Flow | Route | Action |
|------|-------|--------|
| Holder disclosure | `/[accountId]/disclose` | Unlock confidential key → generate a disclosure link for selected transfers |
| Third-party verify | `/verify` | Paste disclosure payload — no wallet required |
| Auditor decrypt | `/auditor` | Paste `CONFIDENTIAL_AUDITOR_SECRET_HEX` at runtime → decrypt transfer history |

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| **Local state does not match on-chain commitments** | Soroban RPC event retention is ~7 days. Events older than retention cannot be replayed on a fresh device or after cache loss — re-sync from a device that still has local openings, or operate within the retention window. |
| **409 on propose** | Only one confidential spend may be in flight per account. Wait for the pending confidential transaction to submit or cancel before proposing another. |
| Stale simulation footprint | Re-propose the transaction so the browser rebuilds witness + proof against current chain state. |
| Wrap key / unlock failures | Wallet lacks `signMessage` (SEP-53). Use Freighter or another message-signing capable wallet. |
