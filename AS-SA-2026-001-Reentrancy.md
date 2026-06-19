# Security Advisory: Critical Reentrancy in AetheronBridge

**Advisory ID:** AS-SA-2026-001
**Severity:** Critical
**Date:** May 20, 2026
**CVE ID:** CVE-2026-XXXX (placeholder, if assigned)

## Summary

A critical reentrancy vulnerability was discovered in the `withdrawETH` function of the `AetheronBridge.sol` contract, allowing an attacker to repeatedly withdraw funds before the internal balance was updated.

## Affected Versions

- **Version(s):** v1.0.0 through v1.0.5
- **Component:** `AetheronBridge.sol`

## Fixed Version

- **Version:** v1.0.6
- **GitHub Tag:** `v1.0.6-patch`
- **Mainnet Address (if applicable):** `0x77E4C1EbeAB0c5140dd0F3d60eBf523134DC7597` (updated deployment)

## Impact

An attacker could have exploited this vulnerability to drain the entire ETH balance held within the `AetheronBridge` contract by making multiple withdrawal calls within a single transaction. This would lead to a complete loss of bridged ETH funds.

## Vulnerability Details

The `withdrawETH` function in `AetheronBridge.sol` sent ETH to the recipient address using an external call before updating the internal balance mapping (`ethBalances[msg.sender]`). A malicious contract could have implemented a fallback function that re-entered `withdrawETH` multiple times, effectively withdrawing more ETH than its actual balance, until the contract was emptied.

### Proof of Concept (Redacted)

A simplified exploit involved a malicious contract calling `withdrawETH`, and its fallback function immediately calling `withdrawETH` again. This loop continued until the bridge's ETH reserves were exhausted.

## Remediation

The vulnerability was addressed by implementing the Checks-Effects-Interactions pattern. Specifically, the internal balance update was moved to occur _before_ the external ETH transfer. Additionally, a `nonReentrant` modifier (from OpenZeppelin's `ReentrancyGuard`) was added to the `withdrawETH` function as a defense-in-depth measure.

## Workarounds

No effective workarounds were available for users of the affected versions, as the vulnerability was within the core contract logic. Users were advised to avoid bridging ETH until the patched version was deployed.

## Credits

We would like to thank the security researcher **@SentinelHunter** for responsibly reporting this issue through our Bug Bounty Program. Their diligence helped secure the Aetheron Sentinel ecosystem.

---

_For more information on our security practices, see SECURITY.md._
_For a list of all published advisories, see the Advisories Directory._
