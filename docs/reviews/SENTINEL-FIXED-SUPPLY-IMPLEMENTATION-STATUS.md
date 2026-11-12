# SENTINEL fixed-supply implementation — integration HOLD

Draft source:
- `src/sentinel-replacement/SentinelFixedSupply.sol`
- `src/sentinel-replacement/SentinelFixedSupplyFactory.sol`
- `test/SentinelFixedSupply.t.sol`

The token mints exactly 1,000,000,000 × 10^18 units in its constructor, to the recipient. There is no callable post-constructor mint, burn, proxy, owner, pause or metadata update. Standard ERC20 transfer/approval is included. This does **not** mean its behavior is audited.

The factory uses the Airlock `ITokenFactory.create(uint256,address,address,bytes32,bytes)` selector, restricts callers to immutable `AIRLOCK`, enforces exact initial supply, and requires empty tokenData. This is **not** a drop-in replacement for TokenFactory80; its address, allowlisting, and integration are not established.

Blocking integration questions:
1. Does the pinned Airlock permit the proposed factory to be allowlisted, and by which authority? No authorization has been obtained.
2. Does the selected initializer call token-specific `lockPool`/`unlockPool`, or assume metadata, permit, voting, burn, or other DERC2080 features? Current candidate intentionally lacks them.
3. Verify deterministic salt semantics, address prediction and factory ownership.
4. Execute Foundry compilation and tests; add fuzz/property tests, negative transfer tests, and full fork simulation. None are claimed passing.
5. Obtain independent security review, new verified factory address, and fresh unsigned manifest and rehearsal before any deployment.
6. Keep the old manifest unchanged until compatibility is proven; the current manifest points to TokenFactory80 and must remain blocked.

No production merge, signing, broadcast, liquidity movement or trading.
