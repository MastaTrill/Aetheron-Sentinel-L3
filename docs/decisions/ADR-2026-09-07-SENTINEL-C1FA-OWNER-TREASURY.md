# ADR — SENTINEL C1FA owner and treasury custody

Date: 2026-09-07
Status: Accepted for project configuration and new liquidity infrastructure

## Canonical wallet

`0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa`

For SENTINEL going forward, this wallet is the canonical project **owner/custody** and **treasury** address for newly created project-controlled infrastructure.

## Scope

Use C1FA as:

- treasury recipient for project-controlled SENTINEL proceeds;
- recipient/custodian of any companion Uniswap v3 LP NFT created for post-launch trading;
- owner/admin of any new project-controlled liquidity-management contract, if one is introduced;
- custody destination for assets intentionally moved into project treasury control;
- canonical owner/treasury address in new SENTINEL operational documentation and execution packages.

## Existing state remains unchanged

This ADR does **not** transfer or overwrite ownership of the existing legacy SENTINEL token, Doppler Airlock, Uniswap v4 PoolManager, Doppler hook, initializer, existing liquidity positions, or third-party protocol contracts.

It does not alter existing beneficiary shares. C1FA remains the configured Aetheron treasury beneficiary in the controlled-redeployment architecture.

Historical Sepolia deployment records retain their historical owner/treasury addresses and must not be rewritten as if C1FA controlled those past deployments.

## Liquidity execution rule

A separately funded signer may supply assets, but any new project-owned companion LP position must be minted/custodied to C1FA unless a later explicit decision supersedes this ADR.

No private key or seed phrase for C1FA may be stored in the repository or requested in chat. Signing must occur through an authorized wallet surface.
