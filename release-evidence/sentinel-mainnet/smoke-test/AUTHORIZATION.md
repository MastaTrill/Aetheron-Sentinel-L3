# SENTINEL Smoke-Test Authorization (unsigned draft)

**Status: NOT AUTHORIZED**

This file is a human-readable companion to `authorization.json`.
Null / placeholder fields do **not** authorize signing or broadcasting.
Never commit private keys, seed phrases, or wallet-session material.

Related issues: #216 (smoke test), parent #210
Network: Base Mainnet (chainId `8453`)

---

## Scope (hard limit)

I authorize **only** the two minimal transactions described below:

1. One buy: WETH → SENTINEL
2. One sell: SENTINEL → WETH (full acquired balance or the exact authorized sell amount)

**Not authorized:** treasury moves, beneficiary changes, ownership transfers, migration, minting, metadata edits, fee collection, liquidity actions, or any other call.

---

## Canonical addresses (read-only reference)

| Field | Value |
|-------|-------|
| Token (SENTINEL) | `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3` |
| WETH | `0x4200000000000000000000000000000000000006` |
| PoolManager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| Pool ID | `0x05d37c029565268ba474749d6142f64511861910671d836460ab56ef26c7157d` |

---

## Owner-filled fields (required before any broadcast)

| Field | Value |
|-------|-------|
| Authorized by (legal name / handle) | `null` |
| Authorized at (UTC ISO-8601) | `null` |
| Expires at (UTC ISO-8601, ≤ 24h recommended) | `null` |
| Test wallet (non-privileged) | `null` |
| Max WETH principal (wei) | `null` |
| Max total gas cost (wei) | `null` |
| Max slippage (bps) | `null` |
| Approved route / router description | `null` |
| Buy amount WETH (wei) | `null` |
| Sell amount SENTINEL (wei) or rule | `null` |

---

## Authorization statement (copy when signing)

> I explicitly authorize only the two minimal transactions described in this file and the matching `authorization.json`. No treasury, beneficiary, owner, migration, fee, minting, metadata, or liquidity action is authorized. This authorization is void after the stated expiry and does not transfer control of any privileged role.

**Signature / attestation reference:** `null`  
**Public message signed (if any):** `null`  
**Verified signer address:** `null`

---

## Post-execution evidence (fill after runs)

| Field | Value |
|-------|-------|
| Buy transaction hash | `null` |
| Sell transaction hash | `null` |
| Verify script output path | `null` |

Verification command (after both txs land):

```bash
export BASE_RPC_URL="https://base-rpc.publicnode.com"
export SENTINEL_SMOKE_TEST_WALLET="<test-wallet>"
export SENTINEL_BUY_TX_HASH="<buy>"
export SENTINEL_SELL_TX_HASH="<sell>"
node scripts/verify-sentinel-smoke-test.mjs
```

---

## Notice

- This draft remains **fail-closed** until every required field is filled **and** a verifiable owner signature is attached.
- Assistant-generated content is never a substitute for owner authorization.
- Matching machine-readable file: `release-evidence/sentinel-mainnet/smoke-test/authorization.json`
