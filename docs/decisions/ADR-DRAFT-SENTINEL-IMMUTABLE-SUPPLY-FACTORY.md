# ADR draft — truly fixed-supply SENTINEL (2026-11-12)

**Decision proposed:** Preserve 1,000,000,000 initial SENTINEL units (18 decimals), with no externally reachable supply-increasing operation after initial creation. Keep one proposed deployment sender/treasury wallet. This ADR is a **design proposal only**, not an implementation approval.

## Why current TokenFactory80 path is unsuitable
The pinned Doppler `TokenFactory80` deploys `DERC2080`, which allows its owner to call `updateMintRate(uint256)` up to 2% per year, then `mintInflation()`. Setting `yearlyMintRate=0` initially does not guarantee immutable fixed supply.

## Required architecture
- Use a separately audited, non-upgradeable ERC-20 implementation with a single constructor/initializer mint of exactly 1,000,000,000 × 10^18 units and **no callable minting entry points**.
- Supply may decrease only if an explicitly reviewed burn function is retained; distinguish fixed maximum supply from constant total supply.
- Preserve the existing 57% treasury beneficiary **allocation of pool beneficiary shares**, not falsely label it as a direct token allocation.
- Prove compatibility with Airlock's `ITokenFactory.create(initialSupply,recipient,owner,salt,tokenData)` interface, the initializer, governance factory, liquidity migration and Base v4 pool.
- Verify deployed factory allowlisting and whether Airlock accepts a custom factory; **do not assume the existing TokenFactory80 address can deploy the new implementation**.
- Audit token ownership, pause/lock functions, metadata URI mutability, transfer behavior, Permit2 allowance and all inherited privileges.
- Preserve existing icon design as a draft brand asset; publish a reviewed public image and immutable token metadata only after content checks.

## Release-blocking evidence
1. New exact-source token and factory implementation, deterministic build and unit/property tests proving no post-initialization mint paths.
2. Explicit owner decision on whether burning is supported and whether token URI is mutable.
3. Independent security review and integration tests for Airlock and Base v4 deployment, with negative cases.
4. New manifest with **new factory address only when verified**; fresh unsigned calldata, digest, predictions and Base Sepolia rehearsal.
5. Read-only two-provider runtime identity/owner checks; exact-head CI and evidence packet.
6. Verified BaseScan source after authorized deployment, followed by profile/logo submission.
7. Separate explicit Mainnet approval before any signing or broadcast.

**No signing, deployment, Mainnet transactions, liquidity movement, merging or trading.**
