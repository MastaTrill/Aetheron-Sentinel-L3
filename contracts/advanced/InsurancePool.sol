// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title InsurancePool
 * @notice Protocol-owned insurance for bridge exploits and failures
 * @dev Features:
 *      - Mutual insurance pool (stake & earn coverage)
 *      - On-chain claim assessment
 *      - Coverage limits per user
 *      - Premium calculation based on risk
 *      - Automatic payout on claim approval
 *
 * @dev Coverage Types:
 *      - Bridge hack/drain
 *      - Oracle manipulation
 *      - Smart contract failure
 *      - Socialized loss (last resort)
 */
contract InsurancePool is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 public constant ASSESSOR_ROLE = keccak256("ASSESSOR_ROLE");
    bytes32 public constant CLAIMS_ADMIN_ROLE = keccak256("CLAIMS_ADMIN_ROLE");

    uint256 public constant MIN_STAKE = 100e18;
    uint256 public constant MAX_COVERAGE_RATIO = 3; // 3x stake
    uint256 public constant PREMIUM_BASIS = 1000; // 10% annual
    uint256 public constant CLAIM_WINDOW = 30 days;
    uint256 public constant MIN_CLAIM_AMOUNT = 100e18;
    uint256 public constant RESOLUTION_PERIOD = 7 days;

    // ============ State Variables ============

    /// @notice Covered protocol
    address public coveredProtocol;

    /// @notice Coverage token (USDC or similar stablecoin)
    IERC20 public coverageToken;

    /// @notice Total staked in pool
    uint256 public totalStaked;

    /// @notice Total coverage issued
    uint256 public totalCoverage;

    /// @notice Total premiums collected
    uint256 public totalPremiums;

    /// @notice Total claims paid
    uint256 public totalClaimsPaid;

    /// @notice Current epoch
    uint256 public currentEpoch;

    /// @notice Pool reserves (for payout)
    uint256 public poolReserves;

    /// @notice Risk level (0-100, affects premium)
    uint256 public riskLevel;

    // ============ Staking Storage ============

    mapping(address => StakeInfo) public stakes;
    mapping(uint256 => EpochInfo) public epochs;

    struct StakeInfo {
        uint256 amount;
        uint256 coverage;
        uint256 lastClaimEpoch;
        uint256 accumulatedRewards;
        uint256 lockEnd;
        uint256 epochStaked;
    }

    struct EpochInfo {
        uint256 totalStaked;
        uint256 totalCoverage;
        uint256 startTime;
        uint256 endTime;
        uint256 rewards;
        uint256 premiumCollected;
    }

    // ============ Claims Storage ============

    mapping(bytes32 => Claim) public claims;
    mapping(address => bytes32[]) public userClaims;
    bytes32[] public allClaims;

    struct Claim {
        bytes32 claimId;
        address claimant;
        uint256 amount;
        uint256 timestamp;
        ClaimState state;
        ClaimType claimType;
        string evidence;
        bytes32 evidenceHash;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 assessorCount;
        mapping(address => bool) voted;
        mapping(address => uint256) assessorVotes;
        uint256 payoutAmount;
        uint256 resolutionTime;
    }

    enum ClaimState {
        Submitted,
        UnderReview,
        Voting,
        Approved,
        Rejected,
        Expired,
        Paid
    }

    enum ClaimType {
        BridgeExploit,
        OracleAttack,
        SmartContractFailure,
        SocializedLoss,
        Other
    }

    // ============ Risk Assessment ============

    mapping(address => uint256) public riskScores;
    mapping(ClaimType => uint256) public claimTypeWeights;
    uint256 public basePremiumRate;

    // ============ Events ============

    event Staked(
        address indexed user,
        uint256 amount,
        uint256 coverage,
        uint256 epoch
    );

    event Unstaked(address indexed user, uint256 amount, uint256 rewards);

    event CoverageUpdated(
        address indexed user,
        uint256 oldCoverage,
        uint256 newCoverage
    );

    event ClaimSubmitted(
        bytes32 indexed claimId,
        address indexed claimant,
        uint256 amount,
        ClaimType claimType
    );

    event ClaimVoted(
        bytes32 indexed claimId,
        address indexed assessor,
        bool support,
        uint256 weight
    );

    event ClaimApproved(bytes32 indexed claimId, uint256 payoutAmount);

    event ClaimRejected(bytes32 indexed claimId);

    event ClaimPaid(
        bytes32 indexed claimId,
        address indexed claimant,
        uint256 amount
    );

    event PremiumCollected(address indexed user, uint256 amount, uint256 epoch);

    event RiskLevelUpdated(uint256 oldLevel, uint256 newLevel);
    event PoolFunded(address indexed funder, uint256 amount);
    event ReservesUpdated(uint256 oldReserves, uint256 newReserves);

    // ============ Errors ============

    error BelowMinimumStake(uint256 amount, uint256 min);
    error AboveMaximumCoverage(uint256 requested, uint256 max);
    error NoActiveStake(address user);
    error StakeLocked(uint256 lockEnd);
    error CoverageNotActive(address user);
    error ClaimNotFound(bytes32 claimId);
    error ClaimNotInVotingState(bytes32 claimId);
    error AlreadyVoted(bytes32 claimId, address assessor);
    error InvalidEvidenceHash();
    error InvalidClaimAmount();
    error ClaimAlreadyResolved(bytes32 claimId);
    error InsufficientPoolReserves(uint256 requested, uint256 available);
    error InvalidClaimType();

    // ============ Constructor ============

    constructor(address _coveredProtocol, address _coverageToken) {
        coveredProtocol = _coveredProtocol;
        coverageToken = IERC20(_coverageToken);

        basePremiumRate = PREMIUM_BASIS;
        riskLevel = 50; // Medium risk

        claimTypeWeights[ClaimType.BridgeExploit] = 100;
        claimTypeWeights[ClaimType.OracleAttack] = 80;
        claimTypeWeights[ClaimType.SmartContractFailure] = 60;
        claimTypeWeights[ClaimType.SocializedLoss] = 50;
        claimTypeWeights[ClaimType.Other] = 40;

        currentEpoch = 1;
        epochs[currentEpoch] = EpochInfo({
            totalStaked: 0,
            totalCoverage: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + 30 days,
            rewards: 0,
            premiumCollected: 0
        });

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ASSESSOR_ROLE, msg.sender);
        _grantRole(CLAIMS_ADMIN_ROLE, msg.sender);
    }

    // ============ Staking Functions ============

    /**
     * @notice Stake tokens to earn coverage
     */
    function stake(uint256 amount) external whenNotPaused nonReentrant {
        if (amount < MIN_STAKE) revert BelowMinimumStake(amount, MIN_STAKE);

        StakeInfo storage stakeInfo = stakes[msg.sender];
        uint256 previousStake = stakeInfo.amount;

        // Calculate coverage
        uint256 coverage = calculateCoverage(amount);

        // Transfer tokens
        coverageToken.safeTransferFrom(msg.sender, address(this), amount);

        // Update stake info
        stakeInfo.amount = previousStake + amount;
        stakeInfo.coverage = coverage;
        stakeInfo.lockEnd = block.timestamp + 30 days;
        stakeInfo.epochStaked = currentEpoch;

        // Update epoch
        EpochInfo storage epoch = epochs[currentEpoch];
        epoch.totalStaked += amount;
        epoch.totalCoverage += coverage;

        // Update totals
        totalStaked += amount;
        totalCoverage += coverage;

        emit Staked(msg.sender, amount, coverage, currentEpoch);
    }

    /**
     * @notice Unstake with rewards
     */
    function unstake(uint256 amount) external whenNotPaused nonReentrant {
        StakeInfo storage stakeInfo = stakes[msg.sender];

        if (stakeInfo.amount == 0) revert NoActiveStake(msg.sender);
        if (block.timestamp < stakeInfo.lockEnd)
            revert StakeLocked(stakeInfo.lockEnd);
        if (amount > stakeInfo.amount) amount = stakeInfo.amount;

        uint256 rewards = calculateRewards(msg.sender);
        uint256 totalPayout = amount + rewards;

        // Update stake info
        totalStaked -= amount;
        totalCoverage -= stakeInfo.coverage;
        stakeInfo.amount -= amount;
        stakeInfo.accumulatedRewards = 0;

        if (stakeInfo.amount == 0) {
            stakeInfo.coverage = 0;
        }

        // Update epoch
        epochs[currentEpoch].totalStaked -= amount;

        // Transfer
        require(poolReserves >= totalPayout, "Insufficient reserves");
        poolReserves -= totalPayout;
        coverageToken.safeTransfer(msg.sender, totalPayout);

        emit Unstaked(msg.sender, amount, rewards);
    }

    /**
     * @notice Claim coverage
     */
    function submitClaim(
        uint256 amount,
        ClaimType claimType,
        string calldata evidence,
        bytes32 evidenceHash
    ) external whenNotPaused nonReentrant {
        if (amount < MIN_CLAIM_AMOUNT) revert InvalidClaimAmount();
        if (stakes[msg.sender].amount == 0) revert NoActiveStake(msg.sender);
        if (amount > stakes[msg.sender].coverage) {
            revert AboveMaximumCoverage(amount, stakes[msg.sender].coverage);
        }
        if (evidenceHash == bytes32(0)) revert InvalidEvidenceHash();

        bytes32 claimId = keccak256(
            abi.encode(msg.sender, amount, claimType, block.timestamp)
        );

        Claim storage claim = claims[claimId];
        claim.claimId = claimId;
        claim.claimant = msg.sender;
        claim.amount = amount;
        claim.timestamp = block.timestamp;
        claim.state = ClaimState.Submitted;
        claim.claimType = claimType;
        claim.evidence = evidence;
        claim.evidenceHash = evidenceHash;

        allClaims.push(claimId);
        userClaims[msg.sender].push(claimId);

        emit ClaimSubmitted(claimId, msg.sender, amount, claimType);
    }

    // ============ Claim Assessment ============

    /**
     * @notice Vote on a claim
     */
    function voteOnClaim(
        bytes32 claimId,
        bool support,
        uint256 weight
    ) external onlyRole(ASSESSOR_ROLE) {
        Claim storage claim = claims[claimId];

        if (claim.state != ClaimState.Voting) {
            revert ClaimNotInVotingState(claimId);
        }

        if (claim.voted[msg.sender]) revert AlreadyVoted(claimId, msg.sender);

        claim.voted[msg.sender] = true;
        claim.assessorVotes[msg.sender] = weight;
        claim.assessorCount++;

        if (support) {
            claim.votesFor += weight;
        } else {
            claim.votesAgainst += weight;
        }

        emit ClaimVoted(claimId, msg.sender, support, weight);
    }

    /**
     * @notice Start voting period
     */
    function startVoting(bytes32 claimId) external onlyRole(CLAIMS_ADMIN_ROLE) {
        Claim storage claim = claims[claimId];
        require(uint256(claim.state) <= 1, "Cannot start voting");

        claim.state = ClaimState.Voting;
        claim.resolutionTime = block.timestamp + RESOLUTION_PERIOD;
    }

    /**
     * @notice Finalize claim decision
     */
    function finalizeClaim(
        bytes32 claimId
    ) external onlyRole(CLAIMS_ADMIN_ROLE) {
        Claim storage claim = claims[claimId];

        if (claim.state != ClaimState.Voting) {
            revert ClaimAlreadyResolved(claimId);
        }

        if (block.timestamp < claim.resolutionTime) {
            revert ClaimNotInVotingState(claimId);
        }

        // Calculate payout based on voting
        uint256 totalVotes = claim.votesFor + claim.votesAgainst;

        if (totalVotes > 0) {
            uint256 supportRatio = (claim.votesFor * 10000) / totalVotes;

            // 60% threshold for approval
            if (supportRatio >= 6000) {
                claim.state = ClaimState.Approved;

                // Calculate payout (could be partial)
                claim.payoutAmount = claim.amount;

                emit ClaimApproved(claimId, claim.payoutAmount);
            } else {
                claim.state = ClaimState.Rejected;
                emit ClaimRejected(claimId);
            }
        } else {
            claim.state = ClaimState.Rejected;
            emit ClaimRejected(claimId);
        }
    }

    /**
     * @notice Pay approved claim
     */
    function payClaim(
        bytes32 claimId
    ) external onlyRole(CLAIMS_ADMIN_ROLE) nonReentrant {
        Claim storage claim = claims[claimId];

        if (claim.state != ClaimState.Approved)
            revert ClaimAlreadyResolved(claimId);
        if (poolReserves < claim.payoutAmount) {
            revert InsufficientPoolReserves(claim.payoutAmount, poolReserves);
        }

        claim.state = ClaimState.Paid;
        poolReserves -= claim.payoutAmount;
        totalClaimsPaid += claim.payoutAmount;

        coverageToken.safeTransfer(claim.claimant, claim.payoutAmount);

        emit ClaimPaid(claimId, claim.claimant, claim.payoutAmount);
    }

    // ============ Helper Functions ============

    /**
     * @notice Calculate coverage based on stake
     */
    function calculateCoverage(
        uint256 stakeAmount
    ) public view returns (uint256) {
        uint256 baseCoverage = stakeAmount;
        uint256 bonusCoverage = (stakeAmount * (100 - riskLevel)) / 100;
        return baseCoverage + bonusCoverage;
    }

    /**
     * @notice Calculate premium for coverage
     */
    function calculatePremium(
        uint256 coverageAmount
    ) public view returns (uint256) {
        uint256 basePremium = (coverageAmount * basePremiumRate) / 10000;
        uint256 riskMultiplier = (100 + riskLevel) / 100;
        return basePremium * riskMultiplier;
    }

    /**
     * @notice Calculate rewards for staker
     */
    function calculateRewards(address user) public view returns (uint256) {
        StakeInfo storage stakeInfo = stakes[user];
        if (stakeInfo.amount == 0) return 0;

        uint256 epochReward = epochs[stakeInfo.epochStaked].rewards;
        uint256 userShare = (stakeInfo.amount * 1e18) /
            epochs[stakeInfo.epochStaked].totalStaked;

        return (epochReward * userShare) / 1e18;
    }

    /**
     * @notice Assess risk level
     */
    function assessRisk(
        address protocol
    ) external onlyRole(ASSESSOR_ROLE) returns (uint256) {
        // Simplified risk assessment
        // In production, integrate with on-chain data feeds

        uint256 score = 50; // Base score

        // Adjust based on various factors
        // This is a placeholder for real risk assessment logic
        riskScores[protocol] = score;

        return score;
    }

    // ============ Admin Functions ============

    function setRiskLevel(uint256 level) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(level <= 100, "Invalid level");
        uint256 old = riskLevel;
        riskLevel = level;
        emit RiskLevelUpdated(old, level);
    }

    function setBasePremiumRate(
        uint256 rate
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(rate <= 2000, "Rate too high"); // Max 20%
        basePremiumRate = rate;
    }

    function fundPool(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        coverageToken.safeTransferFrom(msg.sender, address(this), amount);
        poolReserves += amount;
        emit PoolFunded(msg.sender, amount);
    }

    function setClaimTypeWeight(
        ClaimType claimType,
        uint256 weight
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        claimTypeWeights[claimType] = weight;
    }

    function startNewEpoch() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // End current epoch
        epochs[currentEpoch].endTime = block.timestamp;

        // Start new epoch
        currentEpoch++;
        epochs[currentEpoch] = EpochInfo({
            totalStaked: totalStaked,
            totalCoverage: totalCoverage,
            startTime: block.timestamp,
            endTime: block.timestamp + 30 days,
            rewards: 0,
            premiumCollected: 0
        });
    }

    function distributeRewards(
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(poolReserves >= amount, "Insufficient reserves");
        epochs[currentEpoch].rewards = amount;
        poolReserves -= amount;
    }

    // ============ View Functions ============

    function getStakeInfo(
        address user
    )
        external
        view
        returns (
            uint256 amount,
            uint256 coverage,
            uint256 lockEnd,
            uint256 rewards
        )
    {
        StakeInfo storage stakeInfo = stakes[user];
        return (
            stakeInfo.amount,
            stakeInfo.coverage,
            stakeInfo.lockEnd,
            calculateRewards(user)
        );
    }

    function getClaimInfo(
        bytes32 claimId
    )
        external
        view
        returns (
            address claimant,
            uint256 amount,
            ClaimState state,
            ClaimType claimType,
            uint256 votesFor,
            uint256 votesAgainst
        )
    {
        Claim storage claim = claims[claimId];
        return (
            claim.claimant,
            claim.amount,
            claim.state,
            claim.claimType,
            claim.votesFor,
            claim.votesAgainst
        );
    }

    function getPoolStats()
        external
        view
        returns (
            uint256 _totalStaked,
            uint256 _totalCoverage,
            uint256 _poolReserves,
            uint256 _totalClaimsPaid,
            uint256 _riskLevel
        )
    {
        return (
            totalStaked,
            totalCoverage,
            poolReserves,
            totalClaimsPaid,
            riskLevel
        );
    }
}
