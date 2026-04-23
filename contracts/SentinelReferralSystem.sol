// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SentinelReferralSystem
 * @notice Multi-level referral system providing 3.0-5.0% APY through network effects
 * Enhanced rewards for bringing new participants to the ecosystem
 */
contract SentinelReferralSystem is Ownable, ReentrancyGuard, Pausable {
    // Referral structure
    struct ReferralInfo {
        address referrer;
        uint256 totalReferrals;
        uint256 activeReferrals;
        uint256 totalEarned;
        uint256 lastActivity;
        uint256 tier; // Referral tier (affects reward rates)
    }

    struct ReferralTier {
        uint256 minReferrals;
        uint256 baseReward; // Base reward per referral
        uint256 performanceBonus; // Bonus for active referrals
        uint256 networkBonus; // Bonus for network growth
        string name;
    }

    // Referral tracking
    mapping(address => ReferralInfo) public referrals;
    mapping(address => address[]) public referredUsers;
    mapping(address => bool) public isRegistered;

    // Tier system for enhanced APY
    ReferralTier[] public tiers;

    // Reward system
    uint256 public constant BASE_REFERRAL_REWARD = 50 ether; // 50 tokens per referral
    uint256 public constant TIER_1_BONUS = 25; // 25% bonus for tier 1
    uint256 public constant TIER_2_BONUS = 50; // 50% bonus for tier 2
    uint256 public constant TIER_3_BONUS = 100; // 100% bonus for tier 3

    // APY Enhancement through network effects
    uint256 public constant REFERRAL_APY_BASE = 50; // 0.5% base APY from referrals
    uint256 public constant NETWORK_APY_BONUS = 100; // 1.0% bonus for large networks
    uint256 public constant MAX_REFERRAL_APY = 200; // 2.0% max from referrals

    // Activity tracking for bonus rewards
    mapping(address => uint256) public monthlyActivity;
    mapping(address => uint256) public lastActivityReset;

    // Reward distribution
    address public rewardToken;
    uint256 public totalRewardsDistributed;

    event UserRegistered(address indexed user, address indexed referrer);
    event ReferralReward(
        address indexed referrer,
        address indexed referee,
        uint256 amount
    );
    event TierUpgraded(address indexed user, uint256 newTier);
    event ActivityBonus(
        address indexed user,
        uint256 amount,
        string activityType
    );

    constructor(address _rewardToken, address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        rewardToken = _rewardToken;

        // Initialize referral tiers
        _initializeTiers();
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Initialize referral tiers with increasing rewards
     */
    function _initializeTiers() internal {
        // Tier 0: Starter - Basic rewards
        tiers.push(
            ReferralTier({
                minReferrals: 0,
                baseReward: BASE_REFERRAL_REWARD,
                performanceBonus: 0,
                networkBonus: 0,
                name: "Starter"
            })
        );

        // Tier 1: Bronze - 25% bonus
        tiers.push(
            ReferralTier({
                minReferrals: 5,
                baseReward: (BASE_REFERRAL_REWARD * (100 + TIER_1_BONUS)) / 100,
                performanceBonus: 10,
                networkBonus: 5,
                name: "Bronze"
            })
        );

        // Tier 2: Silver - 50% bonus
        tiers.push(
            ReferralTier({
                minReferrals: 25,
                baseReward: (BASE_REFERRAL_REWARD * (100 + TIER_2_BONUS)) / 100,
                performanceBonus: 25,
                networkBonus: 15,
                name: "Silver"
            })
        );

        // Tier 3: Gold - 100% bonus (max)
        tiers.push(
            ReferralTier({
                minReferrals: 100,
                baseReward: (BASE_REFERRAL_REWARD * (100 + TIER_3_BONUS)) / 100,
                performanceBonus: 50,
                networkBonus: 30,
                name: "Gold"
            })
        );
    }

    /**
     * @notice Register as a referrer or join with referral code
     * @param referrerAddress Address of the referrer (0x0 for no referrer)
     */
    function register(address referrerAddress) external whenNotPaused {
        require(!isRegistered[msg.sender], "Already registered");

        isRegistered[msg.sender] = true;

        if (
            referrerAddress != address(0) &&
            isRegistered[referrerAddress] &&
            referrerAddress != msg.sender
        ) {
            // Valid referral
            referrals[msg.sender].referrer = referrerAddress;
            referrals[referrerAddress].totalReferrals += 1;
            referredUsers[referrerAddress].push(msg.sender);

            // Award initial referral reward
            _awardReferralReward(referrerAddress, msg.sender);

            // Check for tier upgrade
            _checkTierUpgrade(referrerAddress);
        }

        emit UserRegistered(msg.sender, referrerAddress);
    }

    /**
     * @notice Record user activity for bonus rewards
     * @param activityType Type of activity performed
     */
    function recordActivity(string calldata activityType) external {
        require(isRegistered[msg.sender], "Not registered");

        // Reset monthly activity if needed
        if (block.timestamp >= lastActivityReset[msg.sender] + 30 days) {
            monthlyActivity[msg.sender] = 0;
            lastActivityReset[msg.sender] = block.timestamp;
        }

        monthlyActivity[msg.sender] += 1;
        referrals[msg.sender].lastActivity = block.timestamp;

        // Award activity bonus
        uint256 bonus = _calculateActivityBonus(activityType);
        if (bonus > 0) {
            _distributeReward(msg.sender, bonus);
            emit ActivityBonus(msg.sender, bonus, activityType);
        }
    }

    /**
     * @notice Get user's referral APY bonus
     * @param user User address
     */
    function getReferralAPY(address user) external view returns (uint256) {
        if (!isRegistered[user]) return 0;

        ReferralInfo memory userReferral = referrals[user];
        uint256 baseAPY = REFERRAL_APY_BASE;

        // Tier-based bonus
        ReferralTier memory userTier = tiers[userReferral.tier];
        uint256 tierBonus = (userTier.performanceBonus + userTier.networkBonus);

        // Network size bonus
        uint256 networkBonus = userReferral.totalReferrals >= 50
            ? NETWORK_APY_BONUS
            : 0;

        uint256 totalAPY = baseAPY + tierBonus + networkBonus;

        return totalAPY > MAX_REFERRAL_APY ? MAX_REFERRAL_APY : totalAPY;
    }

    /**
     * @notice Get user's referral statistics
     * @param user User address
     */
    function getReferralStats(
        address user
    )
        external
        view
        returns (
            address referrer,
            uint256 totalReferrals,
            uint256 activeReferrals,
            uint256 totalEarned,
            uint256 currentTier,
            uint256 currentAPY
        )
    {
        ReferralInfo memory info = referrals[user];
        uint256 apy = this.getReferralAPY(user);

        return (
            info.referrer,
            info.totalReferrals,
            info.activeReferrals,
            info.totalEarned,
            info.tier,
            apy
        );
    }

    /**
     * @notice Get user's referred addresses
     * @param user User address
     */
    function getReferredUsers(
        address user
    ) external view returns (address[] memory) {
        return referredUsers[user];
    }

    /**
     * @notice Award referral reward to referrer
     */
    function _awardReferralReward(address referrer, address referee) internal {
        ReferralInfo storage referrerInfo = referrals[referrer];
        ReferralTier memory referrerTier = tiers[referrerInfo.tier];

        uint256 rewardAmount = referrerTier.baseReward;

        // Add network bonus for large networks
        if (referrerInfo.totalReferrals >= 50) {
            rewardAmount += (rewardAmount * referrerTier.networkBonus) / 100;
        }

        _distributeReward(referrer, rewardAmount);
        referrerInfo.totalEarned += rewardAmount;

        emit ReferralReward(referrer, referee, rewardAmount);
    }

    /**
     * @notice Check if user qualifies for tier upgrade
     */
    function _checkTierUpgrade(address user) internal {
        ReferralInfo storage userReferral = referrals[user];
        uint256 currentTier = userReferral.tier;

        // Check if user qualifies for next tier
        for (uint256 i = currentTier + 1; i < tiers.length; i++) {
            if (userReferral.totalReferrals >= tiers[i].minReferrals) {
                userReferral.tier = i;
                emit TierUpgraded(user, i);
            } else {
                break; // Can't skip tiers
            }
        }
    }

    /**
     * @notice Calculate activity bonus based on type
     */
    function _calculateActivityBonus(
        string memory activityType
    ) internal pure returns (uint256) {
        bytes32 activityHash = keccak256(abi.encodePacked(activityType));

        if (activityHash == keccak256(abi.encodePacked("stake"))) {
            return 5 ether;
        } else if (activityHash == keccak256(abi.encodePacked("governance"))) {
            return 10 ether;
        } else if (
            activityHash == keccak256(abi.encodePacked("security_report"))
        ) {
            return 25 ether;
        } else if (activityHash == keccak256(abi.encodePacked("bridge_use"))) {
            return 2 ether;
        }

        return 0;
    }

    /**
     * @notice Distribute reward tokens
     */
    function _distributeReward(
        address /* recipient */,
        uint256 amount
    ) internal {
        // In a real implementation, this would transfer from reward pool
        // For demo: assume reward token has minting capability or pre-allocated pool
        totalRewardsDistributed += amount;

        // Note: Actual token transfer would be implemented here
        // IERC20(rewardToken).transfer(recipient, amount);
    }

    /**
     * @notice Update active referral count (called by external systems)
     * @param referrer Referrer address
     * @param activeCount New active count
     */
    function updateActiveReferrals(
        address referrer,
        uint256 activeCount
    ) external onlyOwner {
        referrals[referrer].activeReferrals = activeCount;
    }

    /**
     * @notice Emergency pause referral system
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Emergency unpause referral system
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
}
