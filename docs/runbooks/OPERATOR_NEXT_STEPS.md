# Operator Next Steps (Sep 2026)

Short runbook for the human operator. Complements `BASE_SEPOLIA_SENTINEL_REHEARSAL.md` and the redeployment README.

## 1. Validate existing Sepolia evidence (no keys needed for read-only check)

```bash
npm ci --legacy-peer-deps   # or project standard install
npm run compile
node scripts/validate-sentinel-redeployment-closure.mjs --mode=readiness
# and/or
npm run security:base-sepolia-rehearsal
```

Expect the existing `base-sepolia-rehearsal.json` and manifest digest to be accepted if nothing deployment-bearing changed since the rehearsal.

## 2. Mainnet authorization (human signature required)

1. Copy structure from `mainnet-authorization.template.json` and replace any stale or expired `mainnet-authorization.json`.
2. Set:
   - exact post-security-patch commit SHA
   - approved manifest SHA-256 from current `deployment-manifest.json`
   - `authorizedSender`
   - `expiresAt` (short window)
   - `maxGasCostWei`
   - explicit risk-acceptance statement and timestamps
3. Produce EIP-191 (or approved method) signature offline. **Never** put a private key or mnemonic in the repo or CI.
4. Run `SENTINEL_RELEASE_COMMIT=<exact-sha> node scripts/validate-sentinel-mainnet-authorization.mjs`; it must pass.
5. Commit only the validated JSON (signature string + metadata).

## 3. After authorization is committed

Use the canonical **Sentinel Base Mainnet Pipeline** (`.github/workflows/mainnet-pipeline.yml`) with `deployment_target=sentinel-redeployment`.

1. Dispatch readiness first with the exact authorized `release_commit`, `broadcast=false`, and confirmation blank. Guardrails-only release tag / Sepolia run inputs are not used for this target.
2. Only after readiness passes, dispatch again with the same commit, `broadcast=true`, and confirmation `DEPLOY_SENTINEL_BASE_MAINNET`; the protected `base-mainnet` environment must approve the deploy job.
3. Preserve the generated `deployment-receipt.json` artifact.
4. Complete dual independent RPC captures and `authority-beneficiary-verification.json`.
5. Complete a separate smoke-test authorization + minimal buy/sell.
6. Generate `SHA256SUMS` and pass `node scripts/validate-sentinel-redeployment-closure.mjs --mode=final`.

## 4. Platform parallel track

See `Aetheron_platform` issues #217 (Sepolia presale+staking rehearsal) and #219 (mainnet authorization). Token existence on Base does not equal launch approval.

## Safety

- Testnet success ≠ mainnet authorization.
- Legacy token `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3` stays non-canonical until #210 closes.
