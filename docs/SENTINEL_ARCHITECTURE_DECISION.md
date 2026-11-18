# Architecture decision: legacy SENTINEL deployment (superseded)

> **Superseded for release selection.** The conditional-acceptance path below did not satisfy its Creator-control prerequisite. The active decision is [controlled redeployment](decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md). The token and pool described here are legacy/non-canonical release evidence; the replacement must configure `0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa` as the 57% Creator beneficiary from inception.

**Decision:** Historical conditional-acceptance record for the existing deployment as an externally administered, permanently locked Doppler/Uniswap V4 market under a **solo-creator release model** (superseded by controlled redeployment).
**Production status:** Superseded; do not promote this legacy token to canonical status.
**Legacy/non-canonical address:** `0x8c1eb8db47d52a8b5e2b1eb4e5ec9491ce030ba3` on Base Mainnet.

## Context

The deployed system does not implement the repository's earlier assumption of an Aetheron-controlled Safe owning the token. The token is owned by the Doppler Airlock. Governance and timelock fields are dead addresses, the pool is in locked status, migration uses a NoOp migrator, and trading fees are assigned to four beneficiaries.

Exact source, runtime hashes, two-provider state, fee semantics, account technologies, and controller inventory are preserved in the release evidence. The Airlock does not expose an arbitrary execution route to the token's owner-only administrative methods.

## Historical conditional-acceptance criteria (not met)

Aetheron will not attempt an unsupported ownership transfer, migration, token metadata update, pool unlock, mint-rate change, or liquidity withdrawal.

The existing address could have been promoted only under these conditions (which were superseded by ADR-2026-07-29):

1. It is described as a Bankr/Doppler-launched token with a locked Uniswap V4 pool—not as an Aetheron-governed or upgradeable deployment.
2. Marketing does not claim ownership renunciation, fixed supply, immutable beneficiary addresses, burned liquidity, or unrestricted trading.
3. The public fee allocation is disclosed: 57% creator, 36.1% Bankr, 1.9% Bankr ecosystem, and 5% Doppler protocol.
4. **Primary control attestation (required):** The Creator fee recipient (`0x7e3D11f70084D667295710E6b7FF50C3b0487a45`, 57%) provides a valid EIP-191 control-and-role attestation signed by the underlying EOA.
5. **External beneficiary residual risk (accepted):** The three non-creator beneficiaries (Doppler 5%, Bankr platform 36.1%, Bankr ecosystem 1.9%) are not required to provide cryptographic attestations for production promotion.
6. A minimal authorized buy and sell both succeed and their pool Swap receipts are preserved.
7. An independent reviewer signs the final evidence manifest and acknowledges the reduced attestation scope.

## Rejection conditions (triggered -> controlled redeployment)

Reject this address as the production token and prepare a governed replacement if any of the following occurs:

- the Creator fee recipient cannot or will not attest to control and intended role;
- the intended public route cannot complete both trade directions;
- an independent reviewer identifies an unaccepted critical/high risk that is not covered by the residual-risk acceptance below;
- observed runtime bytecode or material state differs from the pinned evidence without an explained transition;
- project requirements demand Aetheron-controlled metadata, inflation, ownership, migration, or liquidity administration.
