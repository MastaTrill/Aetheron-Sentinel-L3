# SENTINEL replacement factory audit gate

This is an evidence checklist, **not a passed audit**.

## Exact factory scope
- SDK: `@whetstone-research/doppler-sdk@1.0.33`, pinned commit `d6b52689e6af367e7831a3d728c5a48dfa1507e8`.
- Contracts: `whetstoneresearch/doppler` commit `b81980ab98c939abe88e8b2fbd6838969eb534d9`.
- Factory on Base Mainnet: `0xf0B5141dD9096254B2ca624dff26024f46087229`.
- Airlock on Base Mainnet: `0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12`.
- Deployment source: `scripts/execute-sentinel-base-mainnet-redeployment.mjs`, which encodes `yearlyMintRate` into `tokenFactoryData` for `Airlock.create`.

## Critical unverified questions
1. At the exact pinned factory commit, identify the deployed token implementation and every external/internal mint path; prove that a zero yearly mint rate disables all post-creation inflation, including privileged calls.
2. Determine whether `owner()` is Airlock, another contract, or a user-controlled address after `create`; independently verify authority and revocation.
3. Confirm no proxy, factory upgrade, timelock or alternative minter can bypass fixed supply.
4. Verify the 1-billion-token initial supply is the only intended issuance, and that token transfers/distribution do not alter total supply.
5. Validate all Base Mainnet factory and governance runtime hashes against pinned sources and two independent RPC providers.
6. Verify the exact IPFS tokenURI content and approved icon hash before listing submission.

## Fail-closed evidence requirements
- Include pinned source URLs, line-level references, deployed runtime hashes, independent reproduction and test output.
- Do not conflate `contracts/SentinelToken.sol` (legacy AETH; owner-only mint exists) with the Doppler factory-created replacement.
- The draft has changed sender and mint rate; prior deployment digest, prepared receipt, predictions and rehearsal cannot be reused.
- A new release authorization is required after all gates; the historical authorization is expired.

Mainnet HOLD: no signing, broadcasting, merging, liquidity movement or trading.
