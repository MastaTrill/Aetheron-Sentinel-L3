# SENTINEL replacement quote evidence — draft, HOLD

The verifier is **read-only**. It does not sign, deploy, send, or authorize transactions.

## Owner-controlled release authority and cryptographic evidence
- The owner must approve the quote signer address in the CI/runtime environment variable `SENTINEL_INDEPENDENT_QUOTE_SIGNER`. Never accept this signer from user-supplied authorization JSON.
- An owner-approved anchoring contract and signer must be configured as `SENTINEL_INDEPENDENT_ANCHOR_CONTRACT` and `SENTINEL_INDEPENDENT_ANCHOR_SIGNER`. No such contract or signer has been approved yet.
- The EIP-712 quote must bind Base chain 8453, replacement token/pool, approved route, test wallet, transaction calldata hash, direction, output, issue time and expiry.
- The runtime bytecode must match an owner-approved, tested hash configured as `SENTINEL_INDEPENDENT_ANCHOR_CODE_HASH`. An address alone is insufficient. The anchor must implement the reviewed `commit(bytes32)` ABI.
- The quote digest must be committed by a successful cryptographically signed transaction to the approved anchor contract **in a strictly earlier block** than the swap. The verifier checks transaction sender, destination, calldata digest, block ordering, receipt status and matching transaction hash.
- The owner must accept documented anchor contract semantics, signer custody, replay handling, and chain finality after automated tests and security checks. No outside reviewer has veto authority. **A transaction merely containing the digest is not by itself sufficient proof of a secure anchoring protocol.** Until that review is complete, quote certification is HOLD.
- The signed quote's issue time alone is not proof of pretrade existence.
- No release or smoke-trade authorization is implied by CI success.

## Dependency lock
The Foundry lockfile has been reconciled to the previously observed checked-out forge-std and OpenZeppelin gitlink revisions and its Chainlink path normalized for Linux. CI must verify the warnings disappear and all tests still pass. A passing build does not establish supply-chain security.

## Evidence
`node scripts/generate-sentinel-release-inventory.mjs` writes an offline inventory to `artifacts/sentinel-release-gate-inventory.json`. Its verdict is deliberately HOLD and it does not claim missing external evidence exists.

No Mainnet deployment, wallet signature, token transfer, or smoke trade is authorized.

## Launch authority
The project owner is the sole human approval authority for launch. No independent reviewer or separate human sign-off is required. Automated tests, verified quote provenance, beneficiary checks, and explicit owner wallet authorization remain mandatory. Deployment and trading require distinct owner approvals. This policy change is not itself deployment authorization.

## Owner wallet designation — complete address supplied, pending on-chain verification
The owner supplied a Coinbase Wallet receiving-address screenshot showing `0x41f9a865881b445fd8da770bea36f1cccb49ad3d` (42 characters, hexadecimal). This is the **proposed replacement token owner wallet**, replacing the prior expected owner for planning purposes only. The screenshot does not establish control of the private key or prove any contract has transferred ownership. Before release, validate the wallet through an owner-authorized wallet connection/signature where appropriate and verify deployed contract owner and beneficiary settings using read-only Base Mainnet calls. Do not infer deployment, authorization, or completed transfer from this screenshot. No deployment or transaction is authorized.
