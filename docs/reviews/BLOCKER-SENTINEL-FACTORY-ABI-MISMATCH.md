# CRITICAL — pinned Doppler factory ABI mismatch (2026-11-12)

**Release status: BLOCKED — Mainnet HOLD.** This is a source-level finding, not an on-chain verification.

Pinned source: `whetstoneresearch/doppler@b81980ab98c939abe88e8b2fbd6838969eb534d9`

- `src/tokens/DopplerERC20V1Factory.sol` defines `create(initialSupply,recipient,owner,salt,tokenData)` and decodes **11** token-data fields: `string,string,VestingSchedule[],address[],uint256[],uint256[],string,uint256,uint48,address,address[]`.
- Draft `deployment-manifest.json` declares `abi.tokenFactoryDataTypes` with **7** fields: `string,string,uint256,uint256,address[],uint256[],string`. Its third field is `yearlyMintRate`.
- `scripts/execute-sentinel-base-mainnet-redeployment.mjs` encodes those seven fields verbatim into Airlock create calldata.
- Thus the pinned **V1** factory is incompatible with the draft token-data encoding. **Do not** treat the draft as deployable or remove the mint-rate field blindly.
- `src/tokens/DopplerERC20V1.sol` initializes the full initial supply with `_mint`; no external post-initialization mint function was found in the inspected source, but this does not establish that the **actual Base Mainnet factory address** uses this exact implementation or that inherited methods have been fully audited.
- Legacy `contracts/SentinelToken.sol` is AETH and has `mint(...)` onlyOwner; it must not be used for the fixed-supply SENTINEL launch.

## Required remediation
1. Read the actual on-chain code and verified source for Base Mainnet token factory `0xf0B5141dD9096254B2ca624dff26024f46087229` and prove which exact factory/implementation is deployed.
2. Determine whether this is the pinned V1 factory, a legacy factory, or another version. Compare runtime hash, interface and creation transaction.
3. Only after identity is proven, prepare a new versioned manifest encoding compatible with the actual factory. Reconcile supply/mint/vesting/ownership semantics and re-review economics.
4. Regenerate all digest-bound unsigned calldata, predictions and rehearsals; validate with independent RPCs and exact-head tests.
5. Keep BaseScan profile, token URI and logo in draft status until verified.

No signing, broadcasting, merging, trading, or Mainnet deployment.
