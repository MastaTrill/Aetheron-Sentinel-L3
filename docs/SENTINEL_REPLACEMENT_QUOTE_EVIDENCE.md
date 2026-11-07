# SENTINEL replacement quote evidence — draft, HOLD

The verifier is **read-only**. It does not sign, deploy, send, or authorize transactions.

## Independent trust requirements
- An independent reviewer must approve the quote signer address in the CI/runtime environment variable `SENTINEL_INDEPENDENT_QUOTE_SIGNER`. Never accept this signer from user-supplied authorization JSON.
- A separately reviewed anchoring contract and signer must be configured as `SENTINEL_INDEPENDENT_ANCHOR_CONTRACT` and `SENTINEL_INDEPENDENT_ANCHOR_SIGNER`. No such contract or signer has been approved yet.
- The EIP-712 quote must bind Base chain 8453, replacement token/pool, approved route, test wallet, transaction calldata hash, direction, output, issue time and expiry.
- The quote digest must be committed by a successful independently signed transaction to the approved anchor contract **in a strictly earlier block** than the swap. The verifier checks transaction sender, destination, calldata digest, block ordering, receipt status and matching transaction hash.
- The approved anchor contract's semantics, signer custody, replay handling, and chain finality must undergo independent review. **A transaction merely containing the digest is not by itself sufficient proof of a secure anchoring protocol.** Until that review is complete, quote certification is HOLD.
- The signed quote's issue time alone is not proof of pretrade existence.
- No release or smoke-trade authorization is implied by CI success.

## Dependency lock
The Foundry lockfile has been reconciled to the previously observed checked-out forge-std and OpenZeppelin gitlink revisions and its Chainlink path normalized for Linux. CI must verify the warnings disappear and all tests still pass. A passing build is not an independent supply-chain audit.

## Evidence
`node scripts/generate-sentinel-release-inventory.mjs` writes an offline inventory to `artifacts/sentinel-release-gate-inventory.json`. Its verdict is deliberately HOLD and it does not claim missing external evidence exists.

No Mainnet deployment, wallet signature, token transfer, or smoke trade is authorized.
