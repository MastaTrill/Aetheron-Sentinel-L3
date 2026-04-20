// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title RateLimiter
 * @notice Rate limiting system for cross-chain transfers
 */
contract RateLimiter is Ownable, AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");
    bytes32 public constant CALLER_ROLE = keccak256("CALLER_ROLE"); // bridge / relayer contracts

    struct Withdrawal {
        address user;
        uint256 amount;
        uint256 timestamp;
    }

    mapping(uint256 => uint256) public chainLimits;
    mapping(uint256 => uint256) public currentUsage;
    mapping(uint256 => Withdrawal[]) public withdrawals;
    mapping(uint256 => uint256) public chainResetPeriods;
    mapping(uint256 => uint256) public periodStart; // timestamp when current window began
    uint256 public constant DEFAULT_RESET_PERIOD = 1 hours;

    event WithdrawalProcessed(
        address indexed user,
        uint256 amount,
        uint256 chainId,
        uint256 timestamp
    );
    event RateLimitUpdated(uint256 chainId, uint256 oldLimit, uint256 newLimit);
    event ChainLimitSet(uint256 indexed chainId, uint256 limit);
    event ChainResetPeriodSet(uint256 indexed chainId, uint256 resetPeriod);
    event UsageReset(uint256 chainId, uint256 timestamp);
    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);
    event CallerUpdated(address indexed caller, bool authorized);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(OPERATOR_ROLE, initialOwner);
        _grantRole(MONITOR_ROLE, initialOwner);
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Processes a withdrawal with rate limiting
     * @param user User address
     * @param amount Withdrawal amount
     * @param chainId Chain ID
     */
    function processWithdrawal(
        address user,
        uint256 amount,
        uint256 chainId
    ) external whenNotPaused onlyRole(CALLER_ROLE) {
        require(user != address(0), "Invalid user address");
        require(amount > 0, "Amount must be positive");
        require(chainLimits[chainId] > 0, "Chain limit not set");

        uint256 resetPeriod = chainResetPeriods[chainId] > 0
            ? chainResetPeriods[chainId]
            : DEFAULT_RESET_PERIOD;

        // Reset usage when the fixed window has elapsed (anchored to period start)
        if (periodStart[chainId] == 0) {
            periodStart[chainId] = block.timestamp;
        } else if (block.timestamp >= periodStart[chainId] + resetPeriod) {
            currentUsage[chainId] = 0;
            periodStart[chainId] = block.timestamp;
            emit UsageReset(chainId, block.timestamp);
        }

        require(
            currentUsage[chainId] + amount <= chainLimits[chainId],
            "Rate limit exceeded"
        );

        currentUsage[chainId] += amount;

        withdrawals[chainId].push(
            Withdrawal({user: user, amount: amount, timestamp: block.timestamp})
        );

        emit WithdrawalProcessed(user, amount, chainId, block.timestamp);
    }

    /**
     * @notice Updates rate limit for a chain
     * @param chainId Chain ID
     * @param newLimit New rate limit
     */
    function updateRateLimit(
        uint256 chainId,
        uint256 newLimit
    ) external onlyRole(OPERATOR_ROLE) {
        require(chainId > 0, "Invalid chain ID");
        uint256 oldLimit = chainLimits[chainId];
        chainLimits[chainId] = newLimit;

        emit RateLimitUpdated(chainId, oldLimit, newLimit);
    }

    /**
     * @notice Sets chain-specific limit
     * @param chainId Chain ID
     * @param limit Rate limit
     */
    function setChainLimit(
        uint256 chainId,
        uint256 limit
    ) external onlyRole(OPERATOR_ROLE) {
        require(chainId > 0, "Invalid chain ID");
        chainLimits[chainId] = limit;

        emit ChainLimitSet(chainId, limit);
    }

    /**
     * @notice Sets chain-specific reset period
     * @param chainId Chain ID
     * @param resetPeriod Reset period in seconds
     */
    function setChainResetPeriod(
        uint256 chainId,
        uint256 resetPeriod
    ) external onlyRole(OPERATOR_ROLE) {
        require(chainId > 0, "Invalid chain ID");
        require(resetPeriod > 0, "Reset period must be positive");
        chainResetPeriods[chainId] = resetPeriod;

        emit ChainResetPeriodSet(chainId, resetPeriod);
    }

    /**
     * @notice Manually resets usage counters
     * @param chainId Chain ID to reset
     */
    function resetUsage(uint256 chainId) external onlyRole(OPERATOR_ROLE) {
        currentUsage[chainId] = 0;
        emit UsageReset(chainId, block.timestamp);
    }

    /**
     * @notice Authorize or revoke a caller allowed to process withdrawals
     * @param caller Address to update
     * @param authorized Whether the caller should be authorized
     */
    function setCaller(address caller, bool authorized) external onlyOwner {
        require(caller != address(0), "Invalid caller");
        if (authorized) {
            _grantRole(CALLER_ROLE, caller);
        } else {
            _revokeRole(CALLER_ROLE, caller);
        }
        emit CallerUpdated(caller, authorized);
    }

    /**
     * @notice Emergency pause all rate limiting operations
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @notice Emergency unpause rate limiting operations
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    /**
     * @notice Transfer ownership and migrate privileged roles to the new owner
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner();
        super.transferOwnership(newOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, newOwner);
        _grantRole(OPERATOR_ROLE, newOwner);
        _grantRole(MONITOR_ROLE, newOwner);
        _revokeRole(CALLER_ROLE, previousOwner);
        _revokeRole(MONITOR_ROLE, previousOwner);
        _revokeRole(OPERATOR_ROLE, previousOwner);
        _revokeRole(DEFAULT_ADMIN_ROLE, previousOwner);
    }
}
