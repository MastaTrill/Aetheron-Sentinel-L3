# CRITICAL CORRECTION — TokenFactory80 and mutable inflation (2026-11-12)

**Mainnet HOLD. No fixed-supply certification.**

The previously recorded blocker `BLOCKER-SENTINEL-FACTORY-ABI-MISMATCH.md` compared the draft to **DopplerERC20V1Factory**, which is a different factory. Doppler's documented Base factory `0xf0B5141dD9096254B2ca624dff26024f46087229` is **TokenFactory80**. At pinned Doppler commit `b81980ab98c939abe88e8b2fbd6838969eb534d9`:
- `legacy/src/tokens/TokenFactory80.sol` decodes exactly `(string,string,uint256,uint256,address[],uint256[],string)`, matching the draft manifest's seven `abi.tokenFactoryDataTypes` entries.
- It deploys `DERC2080`.
- `legacy/src/tokens/DERC2080.sol` constructor sets `yearlyMintRate`, and `updateMintRate(uint256)` is `external onlyOwner`, allowing the owner to increase it to `0.02 ether` (2% annually). `mintInflation()` can then mint. Thus an initial rate of zero **does not ensure immutable fixed supply**.
- `unlockPool()` sets the minting start timestamp; `updateTokenURI()`, `lockPool()`, `unlockPool()`, `burn()` are owner-controlled. Identify exact post-create owner (possibly Airlock) before governance decisions.
- Exact Base runtime bytecode and creation/implementation identity **not independently verified**; source match is preliminary.

## Required next steps
1. Read-only onchain verification of TokenFactory80 and Airlock bytecode, deployment transaction, ABI and ownership; independently reproduce.
2. Decide economics: retain a mutable 0%-initial inflation-cap token and disclose it accurately, or use an audited truly fixed-supply token/factory with a compatible Airlock flow (requires new design/rehearsal). **Do not claim fixed supply** while updateMintRate remains reachable.
3. Confirm ownership/control of pool lock, URI, and mint-rate administration; do not assume the proposed sender is token owner.
4. Fresh offline tests, manifest digest, calldata, Sepolia simulation, security review and explicit release authorization.
5. BaseScan source verification and logo/profile submission only after deployment.

Sources:
- https://github.com/whetstoneresearch/doppler/blob/b81980ab98c939abe88e8b2fbd6838969eb534d9/legacy/src/tokens/TokenFactory80.sol
- https://github.com/whetstoneresearch/doppler/blob/b81980ab98c939abe88e8b2fbd6838969eb534d9/legacy/src/tokens/DERC2080.sol
- https://docs.doppler.lol/reference/contract-addresses
