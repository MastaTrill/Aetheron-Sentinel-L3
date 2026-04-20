// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SentinelToken
 * @notice Governance token for Aetheron Sentinel L3 with built-in reward mechanisms
 * Provides 3.0-5.0% APY through staking, governance, and security rewards
 */
contract SentinelToken is ERC20, Ownable, Pausable, ReentrancyGuard {
    // Token distribution
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether; // 1B tokens
    uint256 public constant STAKING_REWARDS = 200_000_000 ether; // 20% for staking
    uint256 public constant GOVERNANCE_REWARDS = 100_000_000 ether; // 10% for governance
    uint256 public constant SECURITY_REWARDS = 150_000_000 ether; // 15% for security
    uint256 public constant TEAM_ALLOCATION = 100_000_000 ether; // 10% for team
    uint256 public constant LIQUIDITY_MINING = 200_000_000 ether; // 20% for liquidity mining
    uint256 public constant ECOSYSTEM_FUND = 250_000_000 ether; // 25% for ecosystem

    // Vesting and distribution
    mapping(address => VestingSchedule) public vestingSchedules;
    mapping(address => uint256) public stakedBalances;
    mapping(address => uint256) public lastStakeUpdate;

    struct VestingSchedule {
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 startTime;
        uint256 duration;
        uint256 cliff;
        bool revocable;
    }

    // Reward system
    uint256 public rewardRate = 1e18; // Base reward rate
    uint256 public totalStaked;
    uint256 public rewardPerTokenStored;
    uint256 public lastUpdateTime;

    // APY Enhancement features
    uint256 public constant BASE_STAKING_APY = 300; // 3.0%
    uint256 public constant GOVERNANCE_APY_BONUS = 50; // +0.5%
    uint256 public constant SECURITY_APY_BONUS = 75; // +0.75%
    uint256 public constant MAX_ENHANCED_APY = 500; // 5.0%

    // Governance participation tracking
    mapping(address => uint256) public governanceParticipation;
    mapping(address => uint256) public securityContributions;
    mapping(address => uint256) public lastRewardClaim;
    mapping(address => uint256) public accruedRewards;
    mapping(address => uint256) public lastGovernanceReward; // cooldown per user
    mapping(address => uint256) public lastSecurityReward; // cooldown per user
    uint256 public rewardPoolRemaining; // pre-allocated budget
    uint256 public constant REWARD_COOLDOWN = 1 days;
    uint256 public constant MAX_GOVERNANCE_BONUS_BPS = 10; // 0.1% of stake, max
    mapping(address => bool) public securityReporters;

    event TokensStaked(address indexed user, uint256 amount);
    event TokensUnstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event VestingScheduleCreated(
        address indexed beneficiary,
        uint256 amount,
        uint256 duration
    );
    event GovernanceReward(address indexed user, uint256 amount);
    event SecurityReward(address indexed user, uint256 amount);
    event SecurityReporterUpdated(address indexed reporter, bool status);

    constructor(address initialOwner) ERC20("Aetheron Sentinel", "SENT") {
        require(initialOwner != address(0), "Invalid owner");
        _mint(address(this), TOTAL_SUPPLY);

        // Create vesting schedules for different allocations
        _createVestingSchedule(
            initialOwner,
            TEAM_ALLOCATION,
            365 days,
            90 days
        );
        rewardPoolRemaining =
            STAKING_REWARDS +
            GOVERNANCE_REWARDS +
            SECURITY_REWARDS;
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Stake tokens to earn enhanced APY
     * @param amount Amount to stake
     */
    function stake(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Cannot stake 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        _updateReward(msg.sender);
        _transfer(msg.sender, address(this), amount);

        stakedBalances[msg.sender] += amount;
        totalStaked += amount;

        emit TokensStaked(msg.sender, amount);
    }

    /**
     * @notice Unstake tokens
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external whenNotPaused nonReentrant {
        require(
            stakedBalances[msg.sender] >= amount,
            "Insufficient staked balance"
        );

        _updateReward(msg.sender);
        _claimRewards(msg.sender);

        stakedBalances[msg.sender] -= amount;
        totalStaked -= amount;

        _transfer(address(this), msg.sender, amount);

        emit TokensUnstaked(msg.sender, amount);
    }

    /**
     * @notice Claim accumulated staking rewards
     */
    function claimRewards() external {
        _updateReward(msg.sender);
        _claimRewards(msg.sender);
    }

    /**
     * @notice Participate in governance to earn bonus APY
     */
    function participateInGovernance(uint256 /* proposalId */) external {
        require(
            stakedBalances[msg.sender] > 0,
            "Must be staking to participate"
        );
        require(
            block.timestamp >=
                lastGovernanceReward[msg.sender] + REWARD_COOLDOWN,
            "Cooldown active"
        );

        lastGovernanceReward[msg.sender] = block.timestamp;
        governanceParticipation[msg.sender] += 1;

        // 0.1% of staked balance, capped so reward pool is preserved
        uint256 bonus = (stakedBalances[msg.sender] *
            MAX_GOVERNANCE_BONUS_BPS) / 10000;
        if (bonus > 0) {
            _payoutReward(msg.sender, bonus);
            emit GovernanceReward(msg.sender, bonus);
        }
    }

    /**
     * @notice Report security contribution to earn bonus rewards
     * @param contributionType Type of security contribution
     */
    function reportSecurityContribution(uint256 contributionType) external {
        require(
            securityReporters[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        require(
            block.timestamp >= lastSecurityReward[msg.sender] + REWARD_COOLDOWN,
            "Cooldown active"
        );

        lastSecurityReward[msg.sender] = block.timestamp;
        securityContributions[msg.sender] += 1;

        uint256 bonus;
        if (contributionType == 1) {
            bonus = 100 ether;
        } else if (contributionType == 2) {
            bonus = 500 ether;
        } else if (contributionType == 3) {
            bonus = 1000 ether;
        }

        if (bonus > 0) {
            _payoutReward(msg.sender, bonus);
            emit SecurityReward(msg.sender, bonus);
        }
    }

    /**
     * @notice Grant or revoke security reporter role
     * @param reporter Address to grant/revoke
     * @param status true to grant, false to revoke
     */
    function setSecurityReporter(
        address reporter,
        bool status
    ) external onlyOwner {
        require(reporter != address(0), "Invalid address");
        securityReporters[reporter] = status;
        emit SecurityReporterUpdated(reporter, status);
    }

    /**
     * @notice Get user's current enhanced APY
     * @param user User address
     */
    function getUserAPY(address user) external view returns (uint256) {
        uint256 baseAPY = BASE_STAKING_APY;
        uint256 governanceBonus = (governanceParticipation[user] *
            GOVERNANCE_APY_BONUS) / 100;
        uint256 securityBonus = (securityContributions[user] *
            SECURITY_APY_BONUS) / 10;

        uint256 totalAPY = baseAPY + governanceBonus + securityBonus;

        return totalAPY > MAX_ENHANCED_APY ? MAX_ENHANCED_APY : totalAPY;
    }

    /**
     * @notice Get pending rewards for user
     * @param user User address
     */
    function getPendingRewards(address user) external view returns (uint256) {
        uint256 rewardPerToken = rewardPerTokenStored;
        if (block.timestamp > lastUpdateTime && totalStaked > 0) {
            uint256 timeElapsed = block.timestamp - lastUpdateTime;
            rewardPerToken += (timeElapsed * rewardRate) / totalStaked;
        }

        uint256 userReward = (stakedBalances[user] *
            (rewardPerToken - lastRewardClaim[user])) / 1e18;
        return userReward;
    }

    /**
     * @notice Create vesting schedule for token distribution
     * @param beneficiary Address to receive tokens
     * @param amount Total amount to vest
     * @param duration Total vesting duration
     * @param cliff Cliff period
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 duration,
        uint256 cliff
    ) external onlyOwner {
        _createVestingSchedule(beneficiary, amount, duration, cliff);
    }

    function _createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 duration,
        uint256 cliff
    ) internal {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Invalid amount");
        require(
            vestingSchedules[beneficiary].totalAmount == 0,
            "Schedule already exists"
        );

        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            releasedAmount: 0,
            startTime: block.timestamp,
            duration: duration,
            cliff: cliff,
            revocable: true
        });

        emit VestingScheduleCreated(beneficiary, amount, duration);
    }

    /**
     * @notice Release vested tokens
     * @param beneficiary Address to release tokens for
     */
    function releaseVestedTokens(address beneficiary) external {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        require(schedule.totalAmount > 0, "No vesting schedule");

        uint256 releasable = _calculateReleasableAmount(schedule);
        require(releasable > 0, "No tokens to release");

        schedule.releasedAmount += releasable;
        _transfer(address(this), beneficiary, releasable);
    }

    /**
     * @notice Get vesting schedule details
     * @param beneficiary Address to check
     */
    function getVestingSchedule(
        address beneficiary
    )
        external
        view
        returns (
            uint256 totalAmount,
            uint256 releasedAmount,
            uint256 startTime,
            uint256 duration,
            uint256 cliff,
            uint256 releasable
        )
    {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        uint256 releasableAmount = _calculateReleasableAmount(schedule);

        return (
            schedule.totalAmount,
            schedule.releasedAmount,
            schedule.startTime,
            schedule.duration,
            schedule.cliff,
            releasableAmount
        );
    }

    /**
     * @notice Calculate releasable vested amount
     */
    function _calculateReleasableAmount(
        VestingSchedule memory schedule
    ) internal view returns (uint256) {
        if (block.timestamp < schedule.startTime + schedule.cliff) {
            return 0; // Before cliff
        }

        if (block.timestamp >= schedule.startTime + schedule.duration) {
            return schedule.totalAmount - schedule.releasedAmount; // Fully vested
        }

        // Linear vesting after cliff
        uint256 timeFromStart = block.timestamp - schedule.startTime;
        uint256 vestedAmount = (schedule.totalAmount * timeFromStart) /
            schedule.duration;

        return vestedAmount - schedule.releasedAmount;
    }

    /**
     * @notice Update reward for user
     */
    function _updateReward(address user) internal {
        uint256 updatedRewardPerToken = _rewardPerToken();
        rewardPerTokenStored = updatedRewardPerToken;
        lastUpdateTime = block.timestamp;

        if (user != address(0)) {
            uint256 pending = (stakedBalances[user] *
                (updatedRewardPerToken - lastRewardClaim[user])) / 1e18;
            if (pending > 0) {
                accruedRewards[user] += pending;
            }
            lastRewardClaim[user] = updatedRewardPerToken;
        }
    }

    /**
     * @notice Calculate reward per token
     */
    function _rewardPerToken() internal view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;

        uint256 timeElapsed = block.timestamp - lastUpdateTime;
        return rewardPerTokenStored + (timeElapsed * rewardRate) / totalStaked;
    }

    /**
     * @notice Claim rewards for user
     */
    function _claimRewards(address user) internal {
        uint256 rewards = accruedRewards[user];

        if (rewards > 0) {
            accruedRewards[user] = 0;
            _payoutReward(user, rewards);

            emit RewardsClaimed(user, rewards);
        }
    }

    function _payoutReward(address recipient, uint256 amount) internal {
        require(recipient != address(0), "Invalid recipient");
        require(amount <= rewardPoolRemaining, "Reward pool exhausted");
        require(
            balanceOf(address(this)) >= amount,
            "Insufficient reward balance"
        );
        rewardPoolRemaining -= amount;
        _transfer(address(this), recipient, amount);
    }
}
