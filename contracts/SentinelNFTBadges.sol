// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SentinelNFTBadges
 * @notice Soulbound NFT security certification badges for Sentinel L3 security contributors.
 * Badges are non-transferable (soulbound) and represent verified security achievements.
 */
contract SentinelNFTBadges is Ownable {
    struct Badge {
        string name;
        string tier;        // BRONZE / SILVER / GOLD / PLATINUM
        string metadataUri;
        uint256 issuedAt;
        bool active;
    }

    mapping(address => Badge[]) public holderBadges;
    mapping(address => uint256) public holderBadgeCount;
    uint256 public totalBadgesIssued;

    event BadgeIssued(address indexed recipient, string tier, string name, uint256 badgeIndex);
    event BadgeRevoked(address indexed holder, uint256 badgeIndex);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Issue a soulbound security badge to a contributor
     */
    function issueBadge(
        address recipient,
        string calldata name,
        string calldata tier,
        string calldata metadataUri
    ) external onlyOwner {
        require(recipient != address(0), "Zero address recipient");
        require(bytes(name).length > 0, "Empty badge name");

        holderBadges[recipient].push(Badge({
            name: name,
            tier: tier,
            metadataUri: metadataUri,
            issuedAt: block.timestamp,
            active: true
        }));

        holderBadgeCount[recipient]++;
        totalBadgesIssued++;

        emit BadgeIssued(recipient, tier, name, holderBadges[recipient].length - 1);
    }

    /**
     * @notice Revoke a badge (e.g., malicious actor)
     */
    function revokeBadge(address holder, uint256 badgeIndex) external onlyOwner {
        require(badgeIndex < holderBadges[holder].length, "Invalid badge index");
        require(holderBadges[holder][badgeIndex].active, "Badge already revoked");
        holderBadges[holder][badgeIndex].active = false;
        emit BadgeRevoked(holder, badgeIndex);
    }

    /**
     * @notice Soulbound: prevent all transfers
     */
    function transfer(address, uint256) external pure {
        revert("SoulboundBadge: transfers disabled");
    }
}
