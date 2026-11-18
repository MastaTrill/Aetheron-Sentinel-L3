# Base Mainnet SENTINEL Controlled Redeployment — Execution Playbook

**Release Model:** `controlled-redeployment` (`chainId: 8453`)  
**Frozen Manifest Digest (`SHA-256`):** `984bffc7e27654ccf17d557e1994b633a1d591ac17874f14dadf160ebea6b404`  
**Predicted Replacement Token Address:** `0x7C7528F49BdB879e5E10C93503E6590665c13FC8`  
**Predicted Replacement Pool ID:** `0xdf95d21c1eadc1bc33d410eb89babe8b88a7b16fc27080b4cf158d77e083609a`  
**Canonical 57% Creator Beneficiary (Aetheron Treasury):** `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`

---

## 1. Dual-RPC Base Mainnet Preflight Verification

Run the read-only dual-RPC preflight check across two independent Base Mainnet RPC providers (`https://mainnet.base.org` and `https://base-rpc.publicnode.com`) to verify all Doppler V4 runtime bytecode hashes, confirm the predicted replacement token address (`0x7C7528F49BdB879e5E10C93503E6590665c13FC8`) is unoccupied, and check the deployer gas reserve:

```bash
node scripts/capture-sentinel-post-deploy-evidence.mjs --mode=preflight
```

> **Deployer Gas Reserve Note:** Ensure the protected deployer wallet (`0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2`) holds at least `0.0001 ETH` (`100000000000000 wei`, above the ~`48,918,595,000,000 wei` estimated gas ceiling) on Base Mainnet (`chainId: 8453`) prior to triggering broadcast.

---

## 2. Gate 5 — Generate & Sign Fresh Mainnet Authorization

1. Generate the exact 7-line EIP-191 authorization message bound to the reviewed `HEAD` commit:
   ```bash
   node scripts/prepare-sentinel-mainnet-authorization.mjs \
     --commit $(git rev-parse HEAD) \
     --sender 0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2 \
     --expires-hours 168
   ```
2. Sign the printed `EXACT EIP-191 MESSAGE TO SIGN` block using wallet `0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2` (offline/hardware wallet; never expose the private key).
3. Write and cryptographically verify `release-evidence/sentinel-mainnet/redeployment/mainnet-authorization.json`:
   ```bash
   node scripts/prepare-sentinel-mainnet-authorization.mjs \
     --commit $(git rev-parse HEAD) \
     --sender 0x15b9F8ecedafD69Eb1dD93E51fE522690Bf6B7C2 \
     --expires-hours 168 \
     --signature 0xYOUR_65_BYTE_SIGNATURE \
     --write
   ```
4. Validate the authorization locally:
   ```bash
   SENTINEL_RELEASE_COMMIT=$(git rev-parse HEAD) \
     node scripts/validate-sentinel-mainnet-authorization.mjs
   ```

---

## 3. Gate 6 — Execute Protected Base Mainnet Broadcast

1. Commit and push the signed `mainnet-authorization.json` to `main`.
2. In GitHub Actions, dispatch **Sentinel Base Mainnet Pipeline** (`.github/workflows/mainnet-pipeline.yml`):
   - `deployment_target`: `sentinel-redeployment`
   - `broadcast`: `true`
   - `confirmation`: `DEPLOY_SENTINEL_BASE_MAINNET`
   - `release_commit`: `<exact 40-char commit SHA>`
3. Download the `sentinel-mainnet-redeployment-<run_id>` artifact containing the confirmed `deployment-receipt.json` and copy it to `release-evidence/sentinel-mainnet/redeployment/deployment-receipt.json`.

---

## 4. Gates 3, 4 & 8 — Capture Dual-RPC & Authority Evidence

Immediately after broadcast confirmation, run the automated post-deploy evidence collector:

```bash
node scripts/capture-sentinel-post-deploy-evidence.mjs --mode=capture
```

This populates:
- `release-evidence/sentinel-mainnet/redeployment/base-mainnet-rpc-a.json` (Gate 3 — Provider A)
- `release-evidence/sentinel-mainnet/redeployment/base-mainnet-rpc-b.json` (Gate 3 — Provider B)
- `release-evidence/sentinel-mainnet/redeployment/authority-beneficiary-verification.json` (Gate 4 — 57% Aetheron Treasury & Owner verification)
- `release-evidence/sentinel-mainnet/redeployment/SHA256SUMS` (Gate 8 — Immutable checksum manifest)

Finally, validate the completed closure package:

```bash
node scripts/validate-sentinel-redeployment-closure.mjs --mode=final
```
