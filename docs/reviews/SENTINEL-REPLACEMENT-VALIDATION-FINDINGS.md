# SENTINEL replacement validation findings (read-only, 2026-11-12)

## Critical distinction
`contracts/SentinelToken.sol` is a separate legacy AETH implementation: its constructor uses `ERC20("Aetheron Sentinel","AETH")`, its supply is 1 billion and it exposes `mint(address,uint256) external onlyOwner`. Therefore it **is not fixed supply**. Do not deploy or advertise it as the replacement SENTINEL token.

The proposed replacement uses a Doppler/Airlock factory route described by `release-evidence/sentinel-mainnet/redeployment/deployment-manifest.json`. Its `yearlyMintRate` is configured to `0` in this draft, but this is not sufficient to establish that the factory-created token has no other mint permissions or supply-expanding routes. Inspect the exact pinned factory/token source and deployed runtime before making that claim.

## Metadata and BaseScan
- `config/listing-metadata.json` describes AETH and its legacy address, **not** SENTINEL. Keep separate.
- `config/sentinel-replacement-listing.draft.json` intentionally has no deployed contract address, verified logo URL or explorer profile approval.
- The draft manifest points to an IPFS tokenURI, but its JSON contents, image reference and persistence have not been independently checked.
- BaseScan source verification can only be completed against the actual deployed contract and exact compiler/artifacts. Token icon/profile approval is a separate explorer process; it cannot be guaranteed or truthfully marked complete in advance.
- Existing `.github/workflows/base-sepolia-source-verification.yml` is pinned to a different guardrails release and is not proof of replacement SENTINEL verification.

## Evidence invalidation
The draft changes deployment-bearing parameters (mint rate and sender). Historical calldata hash, predicted addresses, manifest SHA, rehearsal, receipt and authorization **must not be reused**. The existing closure validator pins the old manifest digest; an expected failure against this draft does not justify relaxing the release gate.

## Required verification before approval
1. Read and pin the exact Doppler token factory and token implementation; establish all mint functions, owners, governance, role and supply paths.
2. Recalculate the deployment manifest hash and unsigned calldata and independently verify predictions.
3. Run offline exact-head build, security and policy tests; retain CI evidence.
4. Validate the tokenURI JSON, dedicated icon ownership and public HTTPS/IPFS asset resolution.
5. Generate a fresh, unsigned Base Sepolia simulation and, only with separate testnet authorization, a protected rehearsal.
6. Reconcile wallet authority, gas cap, ownership, beneficiary shares, and fresh owner authorization.

Mainnet HOLD. No signing, broadcasting, deployment, merge, liquidity operations or trading.
