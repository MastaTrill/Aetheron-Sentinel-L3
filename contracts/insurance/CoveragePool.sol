// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CoveragePool
 * @notice Decentralized insurance for smart contract failures
 * @dev Mutual coverage pool with claims processing and risk assessment
 */
contract CoveragePool is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CLAIMS_ADJUSTER_ROLE =
        keccak256("CLAIMS_ADJUSTER_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");

    // Structs
    struct CoveragePolicy {
        uint256 policyId;
        address protocol;
        address insured;
        uint256 coverageAmount;
        uint256 premium;
        uint256 startTime;
        uint256 endTime;
        uint256 claimsCount;
        uint256 maxClaims;
        bool isActive;
        bool isWhitelisted;
        RiskTier riskTier;
    }

    enum RiskTier {
        Low,
        Medium,
        High,
        Critical
    }
    enum ClaimStatus {
        Pending,
        UnderReview,
        Approved,
        Rejected,
        Paid,
        Expired
    }

    struct Claim {
        uint256 claimId;
        uint256 policyId;
        address claimant;
        uint256 amount;
        string description;
        bytes32 evidenceHash;
        ClaimStatus status;
        uint256 submittedAt;
        uint256 reviewedAt;
        uint256 payoutAmount;
        uint256 evaluatorScore;
        address[] requiredApprovers;
        mapping(address => bool) approvals;
        uint256 approvalCount;
    }

    struct RiskAssessment {
        address protocol;
        uint256 totalCovered;
        uint256 premiumRate; // bps
        uint256 claimHistory;
        uint256 activePolicies;
        RiskTier tier;
        uint256 lastAssessment;
    }

    struct Policyholder {
        uint256 totalPremiumPaid;
        uint256 totalClaimsReceived;
        uint256 activePolicies;
        bool isWhitelisted;
    }

    // State
    IERC20 public immutable COVERAGE_TOKEN;
    uint256 public totalPoolValue;
    uint256 public totalPremiumsCollected;
    uint256 public totalClaimsPaid;
    uint256 public policyCount;
    uint256 public claimCount;

    // Mappings
    mapping(uint256 => CoveragePolicy) public policies;
    mapping(uint256 => Claim) public claims;
    mapping(address => RiskAssessment) public protocolRisk;
    mapping(address => Policyholder) public policyholders;
    mapping(address => uint256[]) public userPolicies;

    // Configuration
    uint256 public minCoverageAmount = 100e18;
    uint256 public maxCoverageAmount = 1_000_000e18;
    uint256 public constant PREMIUM_DENOMINATOR = 10000;

    // Risk-based premium rates (bps) - initialized in constructor
    mapping(RiskTier => uint256) public premiumRates;

    // Claims processing
    uint256 public claimsWindow = 14 days;
    uint256 public reviewPeriod = 7 days;
    uint256 public payoutCooldown = 24 hours;
    uint256 public minQuorumVotes = 3;

    // Reserve
    uint256 public reserveRatio = 2000; // 20% of TVL must be in reserve
    uint256 public utilizationLimit = 8000; // Max 80% of pool can be deployed

    // Events
    event PolicyCreated(
        uint256 indexed policyId,
        address indexed protocol,
        address indexed insured,
        uint256 coverageAmount,
        uint256 premium
    );
    event PolicyRenewed(uint256 indexed policyId, uint256 newEndTime);
    event PolicyCancelled(uint256 indexed policyId);
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed claimant,
        uint256 amount
    );
    event ClaimStatusChanged(
        uint256 indexed claimId,
        ClaimStatus newStatus,
        uint256 payoutAmount
    );
    event ClaimPaid(
        uint256 indexed claimId,
        address indexed claimant,
        uint256 amount
    );
    event PremiumCollected(
        address indexed protocol,
        uint256 amount,
        uint256 premium
    );
    event RiskAssessmentUpdated(
        address indexed protocol,
        RiskTier newTier,
        uint256 premiumRate
    );
    event ReserveUpdated(uint256 newReserve);
    event PayoutExecuted(
        address indexed recipient,
        uint256 indexed claimId,
        uint256 amount
    );

    constructor(address _coverageToken) {
        require(_coverageToken != address(0), "Invalid token");
        COVERAGE_TOKEN = IERC20(_coverageToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CLAIMS_ADJUSTER_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
        
        // Initialize premium rates
        premiumRates[RiskTier.Low] = 100;
        premiumRates[RiskTier.Medium] = 250;
        premiumRates[RiskTier.High] = 500;
        premiumRates[RiskTier.Critical] = 1000;
    }

    // ============ Policy Management ============

    function createPolicy(
        address _protocol,
        address _insured,
        uint256 _coverageAmount,
        uint256 _duration
    ) external nonReentrant returns (uint256 policyId) {
        require(_coverageAmount >= minCoverageAmount, "Coverage too low");
        require(_coverageAmount <= maxCoverageAmount, "Coverage too high");
        require(_duration > 0 && _duration <= 365 days, "Invalid duration");
        require(
            policyholders[_insured].isWhitelisted ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not whitelisted"
        );

        // Calculate premium
        RiskAssessment storage risk = protocolRisk[_protocol];
        uint256 premiumRate = premiumRates[risk.tier];
        uint256 premium = (_coverageAmount * premiumRate) / PREMIUM_DENOMINATOR;

        // Check pool capacity
        uint256 availablePool = _getAvailablePool();
        require(availablePool >= _coverageAmount, "Insufficient pool capacity");

        policyId = policyCount++;

        policies[policyId] = CoveragePolicy({
            policyId: policyId,
            protocol: _protocol,
            insured: _insured,
            coverageAmount: _coverageAmount,
            premium: premium,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            claimsCount: 0,
            maxClaims: 3,
            isActive: true,
            isWhitelisted: true,
            riskTier: risk.tier
        });

        // Collect premium
        COVERAGE_TOKEN.safeTransferFrom(msg.sender, address(this), premium);
        totalPremiumsCollected += premium;
        totalPoolValue += premium;

        // Update risk assessment
        protocolRisk[_protocol].totalCovered += _coverageAmount;
        protocolRisk[_protocol].activePolicies++;

        // Update policyholder
        policyholders[_insured].totalPremiumPaid += premium;
        policyholders[_insured].activePolicies++;
        userPolicies[_insured].push(policyId);

        emit PolicyCreated(
            policyId,
            _protocol,
            _insured,
            _coverageAmount,
            premium
        );
        return policyId;
    }

    function renewPolicy(
        uint256 _policyId,
        uint256 _newDuration
    ) external nonReentrant {
        CoveragePolicy storage policy = policies[_policyId];
        require(policy.policyId == _policyId, "Policy not found");
        require(!policy.isActive, "Policy still active");
        require(msg.sender == policy.insured, "Not the insured");

        uint256 premium = policy.premium;
        COVERAGE_TOKEN.safeTransferFrom(msg.sender, address(this), premium);

        policy.endTime = block.timestamp + _newDuration;
        policy.isActive = true;
        policy.claimsCount = 0;

        totalPremiumsCollected += premium;
        totalPoolValue += premium;

        emit PolicyRenewed(_policyId, policy.endTime);
    }

    function cancelPolicy(uint256 _policyId) external {
        CoveragePolicy storage policy = policies[_policyId];
        require(
            msg.sender == policy.insured ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(policy.isActive, "Already inactive");

        // No refund for early cancellation (standard insurance)
        policy.isActive = false;
        policy.endTime = block.timestamp;

        // Update tracking
        protocolRisk[policy.protocol].totalCovered -= policy.coverageAmount;
        protocolRisk[policy.protocol].activePolicies--;
        policyholders[policy.insured].activePolicies--;

        emit PolicyCancelled(_policyId);
    }

    // ============ Claims Processing ============

    function submitClaim(
        uint256 _policyId,
        uint256 _amount,
        string calldata _description,
        bytes32 _evidenceHash
    ) external nonReentrant returns (uint256 claimId) {
        CoveragePolicy storage policy = policies[_policyId];
        require(policy.policyId == _policyId, "Policy not found");
        require(policy.isActive, "Policy not active");
        require(block.timestamp <= policy.endTime, "Policy expired");
        require(
            _amount > 0 && _amount <= policy.coverageAmount,
            "Invalid claim amount"
        );
        require(policy.claimsCount < policy.maxClaims, "Max claims reached");
        require(msg.sender == policy.insured, "Not the insured");

        claimId = claimCount++;

        Claim storage claim = claims[claimId];
        claim.claimId = claimId;
        claim.policyId = _policyId;
        claim.claimant = msg.sender;
        claim.amount = _amount;
        claim.description = _description;
        claim.evidenceHash = _evidenceHash;
        claim.status = ClaimStatus.Pending;
        claim.submittedAt = block.timestamp;
        claim.requiredApprovers = _getDefaultApprovers();

        policy.claimsCount++;

        emit ClaimSubmitted(claimId, _policyId, msg.sender, _amount);
        return claimId;
    }

    function _getDefaultApprovers() internal view returns (address[] memory) {
        // In production, would be determined by DAO or governance
        address[] memory approvers = new address[](minQuorumVotes);
        approvers[0] = msg.sender; // Self-approval for demo
        return approvers;
    }

    function reviewClaim(
        uint256 _claimId,
        uint256 _evaluatorScore
    ) external onlyRole(CLAIMS_ADJUSTER_ROLE) {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Pending, "Not pending");
        require(
            _evaluatorScore >= 1 && _evaluatorScore <= 100,
            "Invalid score"
        );

        claim.status = ClaimStatus.UnderReview;
        claim.reviewedAt = block.timestamp;
        claim.evaluatorScore = _evaluatorScore;
    }

    function approveClaim(
        uint256 _claimId,
        uint256 _payoutAmount
    ) external onlyRole(CLAIMS_ADJUSTER_ROLE) {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.UnderReview, "Not under review");
        require(
            _payoutAmount > 0 && _payoutAmount <= claim.amount,
            "Invalid payout"
        );

        claim.approvals[msg.sender] = true;
        claim.approvalCount++;

        if (claim.approvalCount >= minQuorumVotes) {
            claim.status = ClaimStatus.Approved;
            claim.payoutAmount = _payoutAmount;

            emit ClaimStatusChanged(
                _claimId,
                ClaimStatus.Approved,
                _payoutAmount
            );
        }
    }

    function rejectClaim(
        uint256 _claimId,
        string calldata _reason
    ) external onlyRole(CLAIMS_ADJUSTER_ROLE) {
        Claim storage claim = claims[_claimId];
        require(
            claim.status == ClaimStatus.UnderReview ||
                claim.status == ClaimStatus.Pending,
            "Cannot reject"
        );

        claim.status = ClaimStatus.Rejected;

        emit ClaimStatusChanged(_claimId, ClaimStatus.Rejected, 0);
    }

    function executePayout(uint256 _claimId) external nonReentrant {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Approved, "Not approved");

        uint256 payout = claim.payoutAmount;
        require(
            COVERAGE_TOKEN.balanceOf(address(this)) >= payout,
            "Insufficient pool funds"
        );

        claim.status = ClaimStatus.Paid;
        totalClaimsPaid += payout;
        totalPoolValue -= payout;

        COVERAGE_TOKEN.safeTransfer(claim.claimant, payout);
        policyholders[claim.claimant].totalClaimsReceived += payout;

        emit ClaimPaid(_claimId, claim.claimant, payout);
        emit PayoutExecuted(claim.claimant, _claimId, payout);
    }

    function expireClaim(uint256 _claimId) external {
        Claim storage claim = claims[_claimId];
        require(
            claim.status == ClaimStatus.Approved ||
                claim.status == ClaimStatus.UnderReview
        );
        require(
            block.timestamp > claim.submittedAt + claimsWindow + reviewPeriod,
            "Not expired"
        );

        claim.status = ClaimStatus.Expired;
        emit ClaimStatusChanged(_claimId, ClaimStatus.Expired, 0);
    }

    // ============ Risk Assessment ============

    function assessProtocolRisk(
        address _protocol,
        RiskTier _tier
    ) external onlyRole(RISK_MANAGER_ROLE) {
        require(_tier <= RiskTier.Critical, "Invalid tier");

        RiskAssessment storage risk = protocolRisk[_protocol];
        risk.tier = _tier;
        risk.lastAssessment = block.timestamp;
        risk.premiumRate = premiumRates[_tier];

        emit RiskAssessmentUpdated(_protocol, _tier, premiumRates[_tier]);
    }

    function calculatePremium(
        address _protocol,
        uint256 _coverageAmount,
        uint256 _duration
    ) external view returns (uint256 premium, uint256 premiumRate) {
        RiskAssessment storage risk = protocolRisk[_protocol];
        uint256 rate = premiumRates[risk.tier];
        premium =
            (_coverageAmount * rate * _duration) /
            (PREMIUM_DENOMINATOR * 365 days);
        return (premium, rate);
    }

    // ============ Pool Management ============

    function depositToPool(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Invalid amount");

        COVERAGE_TOKEN.safeTransferFrom(msg.sender, address(this), _amount);
        totalPoolValue += _amount;

        // Update reserve
        uint256 reserve = (totalPoolValue * reserveRatio) / PREMIUM_DENOMINATOR;
        emit ReserveUpdated(reserve);
    }

    function withdrawFromPool(
        uint256 _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 available = _getAvailablePool();
        require(_amount <= available, "Insufficient available funds");

        totalPoolValue -= _amount;
        COVERAGE_TOKEN.safeTransfer(msg.sender, _amount);
    }

    function _getAvailablePool() internal view returns (uint256) {
        uint256 maxUtilization = (totalPoolValue * utilizationLimit) /
            PREMIUM_DENOMINATOR;
        uint256 deployed = _getDeployedCoverage();

        if (deployed >= maxUtilization) return 0;
        return maxUtilization - deployed;
    }

    function _getDeployedCoverage() internal view returns (uint256 deployed) {
        for (uint256 i = 0; i < policyCount; i++) {
            CoveragePolicy storage policy = policies[i];
            if (policy.isActive) {
                deployed += policy.coverageAmount;
            }
        }
    }

    // ============ Whitelist Management ============

    function whitelistPolicyholder(
        address _user,
        bool _whitelist
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        policyholders[_user].isWhitelisted = _whitelist;
    }

    // ============ Admin Functions ============

    function updatePremiumRates(
        uint256 _low,
        uint256 _medium,
        uint256 _high,
        uint256 _critical
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        premiumRates[RiskTier.Low] = _low;
        premiumRates[RiskTier.Medium] = _medium;
        premiumRates[RiskTier.High] = _high;
        premiumRates[RiskTier.Critical] = _critical;
    }

    function updateCoverageLimits(
        uint256 _min,
        uint256 _max
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_min <= _max, "Invalid limits");
        minCoverageAmount = _min;
        maxCoverageAmount = _max;
    }

    function updateReserveRatio(
        uint256 _ratio
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_ratio >= 1000 && _ratio <= 5000, "Ratio must be 10-50%");
        reserveRatio = _ratio;
    }

    function updateUtilizationLimit(
        uint256 _limit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_limit >= 5000 && _limit <= 9500, "Limit must be 50-95%");
        utilizationLimit = _limit;
    }

    function updateClaimsProcess(
        uint256 _window,
        uint256 _review,
        uint256 _quorum
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        claimsWindow = _window;
        reviewPeriod = _review;
        minQuorumVotes = _quorum;
    }

    // ============ View Functions ============

    function getPolicy(
        uint256 _policyId
    )
        external
        view
        returns (
            address protocol,
            address insured,
            uint256 coverageAmount,
            uint256 premium,
            uint256 endTime,
            bool isActive,
            RiskTier riskTier
        )
    {
        CoveragePolicy storage policy = policies[_policyId];
        return (
            policy.protocol,
            policy.insured,
            policy.coverageAmount,
            policy.premium,
            policy.endTime,
            policy.isActive,
            policy.riskTier
        );
    }

    function getClaim(
        uint256 _claimId
    )
        external
        view
        returns (
            uint256 policyId,
            address claimant,
            uint256 amount,
            uint256 payoutAmount,
            ClaimStatus status,
            uint256 submittedAt,
            uint256 approvalCount
        )
    {
        Claim storage claim = claims[_claimId];
        return (
            claim.policyId,
            claim.claimant,
            claim.amount,
            claim.payoutAmount,
            claim.status,
            claim.submittedAt,
            claim.approvalCount
        );
    }

    function getProtocolRisk(
        address _protocol
    )
        external
        view
        returns (
            uint256 totalCovered,
            uint256 premiumRate,
            uint256 activePolicies,
            RiskTier tier
        )
    {
        RiskAssessment storage risk = protocolRisk[_protocol];
        return (
            risk.totalCovered,
            risk.premiumRate,
            risk.activePolicies,
            risk.tier
        );
    }

    function getUserPolicies(
        address _user
    ) external view returns (uint256[] memory) {
        return userPolicies[_user];
    }

    function getPoolStats()
        external
        view
        returns (
            uint256 poolValue,
            uint256 premiumsCollected,
            uint256 claimsPaid,
            uint256 deployedCoverage,
            uint256 availablePool,
            uint256 totalPolicies,
            uint256 activePolicies
        )
    {
        uint256 deployed;
        uint256 active;
        for (uint256 i = 0; i < policyCount; i++) {
            deployed += policies[i].coverageAmount;
            if (policies[i].isActive) active++;
        }

        return (
            totalPoolValue,
            totalPremiumsCollected,
            totalClaimsPaid,
            deployed,
            _getAvailablePool(),
            policyCount,
            active
        );
    }
}
