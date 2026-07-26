// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SentinelRewardDistributor
 * @notice Distributes SENTINEL protocol revenue to stakers proportionally.
 * Supports epoch-based reward snapshots and claim-any-time mechanics.
 */
contract SentinelRewardDistributor is Ownable, ReentrancyGuard {
    IERC20 public immutable sentinelToken;

    struct Epoch {
        uint256 totalRewards;
        uint256 totalStaked;
        uint256 startTime;
        uint256 endTime;
        bool finalized;
    }

    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => mapping(address => uint256)) public userStakeAtEpoch;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(address => uint256) public userStake;
    uint256 public currentEpoch;
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount, uint256 epoch);
    event Unstaked(address indexed user, uint256 amount);
    event EpochFinalized(uint256 indexed epochId, uint256 totalRewards, uint256 totalStaked);
    event RewardClaimed(address indexed user, uint256 indexed epochId, uint256 reward);
    event RewardsDeposited(uint256 indexed epochId, uint256 amount);

    constructor(address _sentinelToken, address initialOwner) Ownable(initialOwner) {
        require(_sentinelToken != address(0), "Zero token address");
        sentinelToken = IERC20(_sentinelToken);
        _openEpoch();
    }

    function _openEpoch() internal {
        epochs[currentEpoch].startTime = block.timestamp;
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        sentinelToken.transferFrom(msg.sender, address(this), amount);
        userStake[msg.sender] += amount;
        userStakeAtEpoch[currentEpoch][msg.sender] += amount;
        totalStaked += amount;
        emit Staked(msg.sender, amount, currentEpoch);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(userStake[msg.sender] >= amount, "Insufficient stake");
        userStake[msg.sender] -= amount;
        totalStaked -= amount;
        sentinelToken.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function depositRewards(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Zero amount");
        sentinelToken.transferFrom(msg.sender, address(this), amount);
        epochs[currentEpoch].totalRewards += amount;
        emit RewardsDeposited(currentEpoch, amount);
    }

    function finalizeEpoch() external onlyOwner {
        Epoch storage e = epochs[currentEpoch];
        require(!e.finalized, "Already finalized");
        require(e.totalRewards > 0, "No rewards");
        e.totalStaked = totalStaked;
        e.endTime = block.timestamp;
        e.finalized = true;
        emit EpochFinalized(currentEpoch, e.totalRewards, e.totalStaked);
        currentEpoch++;
        _openEpoch();
    }

    function claimReward(uint256 epochId) external nonReentrant {
        Epoch storage e = epochs[epochId];
        require(e.finalized, "Epoch not finalized");
        require(!claimed[epochId][msg.sender], "Already claimed");
        require(e.totalStaked > 0, "No stakers in epoch");

        uint256 userShare = userStakeAtEpoch[epochId][msg.sender];
        require(userShare > 0, "No stake in epoch");

        uint256 reward = (userShare * e.totalRewards) / e.totalStaked;
        claimed[epochId][msg.sender] = true;
        sentinelToken.transfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, epochId, reward);
    }

    function pendingReward(uint256 epochId, address user) external view returns (uint256) {
        Epoch storage e = epochs[epochId];
        if (!e.finalized || e.totalStaked == 0) return 0;
        return (userStakeAtEpoch[epochId][user] * e.totalRewards) / e.totalStaked;
    }
}
