# Base Sepolia Sentinel Guardrails + SENTINEL Redeployment Rehearsal

**Issues:** #169 (Guardrails on Sepolia), #235 (protected SENTINEL redeployment rehearsal), #210 / #215 (closure + beneficiary)

**Goal:** Protected testnet broadcast + evidence so controlled SENTINEL redeployment can close.  
**Does NOT authorize Base Mainnet.**

---

## Fixed constants (do not change)

| Item | Value |
|------|--------|
| Rehearsal chain | Base Sepolia `84532` |
| Required 57% treasury | `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` |
| Required Creator share | `570000000000000000` (wad) |
| Legacy mainnet token | `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3` (non-canonical) |
| ADR | `docs/decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md` |
| Evidence root | `release-evidence/sentinel-mainnet/redeployment/` |

Existing confirmed Sepolia rehearsal artifact (reference):
- Token: `0x3555976fecf045833D6E148C42035170bA1337Ab`
- Tx: `0x77117f06adb7c9355659244929e6143785d5b66a75b40e2732912205fed7c433`
- File: `release-evidence/sentinel-mainnet/redeployment/base-sepolia-rehearsal.json`

If that evidence still matches the current `deployment-manifest.json` digest and is within policy, you may **validate + package** rather than re-broadcast. If the manifest changed, re-run a protected rehearsal.

---

## Pre-flight

- [ ] Repo root; Node + Hardhat available
- [ ] Local env for Base Sepolia only (e.g. `.env.basesepolia`) — **no mainnet keys in this session**
- [ ] Base Sepolia ETH for gas
- [ ] RPC URL for chain `84532`
- [ ] Intended owner / treasury / beneficiary weights match the ADR

```bash
npm ci --legacy-peer-deps   # or your standard install
npm run compile
npm run test:release
```

---

## Path A — Existing rehearsal still valid

1. Confirm manifest digest still matches the pinned rehearsal:

```bash
npm run security:base-sepolia-rehearsal
```

2. Confirm beneficiary weights on the rehearsal token (57% treasury):

```bash
# Use your preferred cast/ethers call against Base Sepolia
# Expected aetheron-treasury share: 570000000000000000
# Address: 0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa
```

3. Fill evidence templates:

- `docs/evidence/BASE_SEPOLIA_GUARDRAILS_REHEARSAL_TEMPLATE.md`
- `docs/evidence/base-sepolia-guardrails-rehearsal.template.json`

4. Link completed evidence on **#169**, **#235**, **#215**, **#210**.

5. Run closure validator when the full packet is ready:

```bash
node scripts/validate-sentinel-redeployment-closure.mjs --mode=final
```

(Only when all required files exist per `release-evidence/.../README.md`.)

---

## Path B — New protected Base Sepolia rehearsal required

Use when manifest changed, digest no longer matches, or Guardrails (#169) still need a fresh deploy.

### 1. Preflight (no mainnet)

```bash
npm run preflight:local
# or
npm run preflight:base-sepolia
```

Expect a clear PASS. Fix RPC / balance / config failures first.

### 2. Optional simulation

```bash
npm run mainnet:simulate
```

This is Sepolia-oriented simulation of the release core — not a mainnet broadcast.

### 3. Deploy release core on Base Sepolia

```bash
npm run deploy:base-sepolia
```

Capture:

- All deployed addresses
- Tx hashes + block numbers
- Runtime bytecode hashes if emitted

### 4. Verify on explorer

```bash
npm run verify:release:base-sepolia
# and/or
npm run verify:source:base-sepolia
```

### 5. Write / update rehearsal evidence

Update under `release-evidence/sentinel-mainnet/redeployment/`:

- `base-sepolia-rehearsal.json` (or new dated file if policy requires)
- Ensure `deployment-manifest.json` has **no** placeholder/null release fields
- Confirm `safety.baseMainnetAuthorized: false`
- Confirm `safety.mainnetTransactionProduced: false`
- Confirm beneficiary list includes treasury `0xA4737...` at **57%**

### 6. Validate

```bash
npm run security:base-sepolia-rehearsal
```

### 7. Package for issues

Fill:

- `docs/evidence/BASE_SEPOLIA_GUARDRAILS_REHEARSAL_TEMPLATE.md`
- `docs/evidence/base-sepolia-guardrails-rehearsal.template.json`

Comment on **#169** and **#235** with addresses, txs, beneficiary proof, and manifest SHA-256.

---

## Beneficiary gate (#215)

Before treating #210 as closable:

- [ ] 57% share is the Aetheron treasury from inception on the **replacement** deployment
- [ ] Proven from chain state (not screenshots only)
- [ ] Legacy mainnet token remains labeled non-canonical

---

## Explicit non-claims

- No Base Mainnet deploy, liquidity, buy/sell, or trading authorization from this runbook alone
- Legacy SENTINEL on Base Mainnet stays non-canonical until #210 closure criteria are fully met
- Independent review waiver (if any) must be explicit and expiring in `mainnet-authorization.json` — separate from this rehearsal

---

## Suggested issue comment template

```text
Base Sepolia rehearsal complete.

- Manifest path: ...
- Manifest SHA-256: ...
- Guardrails / token / pool addresses: ...
- Tx hashes: ...
- 57% beneficiary verified: 0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa
- Explorer verification: ...
- Mainnet authorized: NO

Evidence attached / linked. Requesting review to advance #169 / #235 toward #210.
```
