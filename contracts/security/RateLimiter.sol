// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RateLimiter
 * @notice Limits withdrawal/bridge rates to prevent rapid fund drains
 * @dev Uses sliding window algorithm for accurate rate limiting
 */
contract RateLimiter is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Maximum amount that can be withdrawn in a window
    uint256 public maxWithdrawalPerWindow;

    /// @notice Window duration in seconds
    uint256 public windowDuration;

    /// @notice Current window start timestamp
    uint256 public windowStart;

    /// @notice Amount withdrawn in current window
    uint256 public currentWindowAmount;

    /// @notice Track last 10 windows for averaging
    uint256[10] public recentWindowAmounts;
    uint8 public currentWindowIndex;

    /// @notice Chain-specific limits (chainId => maxAmount)
    mapping(uint256 => uint256) public chainLimits;

    event WithdrawalProcessed(
        address indexed user,
        uint256 amount,
        uint256 chainId,
        uint256 windowRemaining
    );
    event RateLimitUpdated(uint256 newLimit, uint256 windowDuration);
    event ChainLimitSet(uint256 indexed chainId, uint256 limit);

    error RateLimitExceeded(
        uint256 requested,
        uint256 available,
        uint256 windowRemaining
    );
    error InvalidWindowDuration();
    error InvalidLimit();

    modifier withinRateLimit(uint256 amount, uint256 chainId) {
        _checkRateLimit(amount, chainId);
        _;
    }

    constructor(uint256 _maxWithdrawalPerWindow, uint256 _windowDuration) {
        if (_windowDuration == 0) revert InvalidWindowDuration();
        if (_maxWithdrawalPerWindow == 0) revert InvalidLimit();

        maxWithdrawalPerWindow = _maxWithdrawalPerWindow;
        windowDuration = _windowDuration;
        windowStart = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    function _checkRateLimit(uint256 amount, uint256 chainId) internal {
        _updateWindow();

        uint256 effectiveLimit = maxWithdrawalPerWindow;
        if (chainLimits[chainId] > 0) {
            effectiveLimit = chainLimits[chainId];
        }

        uint256 newAmount = currentWindowAmount + amount;
        if (newAmount > effectiveLimit) {
            revert RateLimitExceeded(
                amount,
                effectiveLimit - currentWindowAmount,
                windowDuration - (block.timestamp - windowStart)
            );
        }

        currentWindowAmount = newAmount;
        recentWindowAmounts[currentWindowIndex] = newAmount;
    }

    function _updateWindow() internal {
        if (block.timestamp >= windowStart + windowDuration) {
            currentWindowIndex = (currentWindowIndex + 1) % 10;
            recentWindowAmounts[currentWindowIndex] = 0;
            windowStart = block.timestamp;
            currentWindowAmount = 0;
        }
    }

    function getAverageWindowAmount() external view returns (uint256) {
        uint256 sum;
        for (uint256 i = 0; i < 10; i++) {
            sum += recentWindowAmounts[i];
        }
        return sum / 10;
    }

    function getWindowStats()
        external
        view
        returns (uint256 windowRemaining, uint256 amountUsed, uint256 limit)
    {
        uint256 remaining = 0;
        if (block.timestamp < windowStart + windowDuration) {
            remaining = windowStart + windowDuration - block.timestamp;
        }
        return (remaining, currentWindowAmount, maxWithdrawalPerWindow);
    }

    function setMaxWithdrawalPerWindow(
        uint256 newLimit
    ) external onlyRole(MANAGER_ROLE) {
        if (newLimit == 0) revert InvalidLimit();
        maxWithdrawalPerWindow = newLimit;
        emit RateLimitUpdated(newLimit, windowDuration);
    }

    function setWindowDuration(
        uint256 newDuration
    ) external onlyRole(MANAGER_ROLE) {
        if (newDuration == 0) revert InvalidWindowDuration();
        windowDuration = newDuration;
        emit RateLimitUpdated(maxWithdrawalPerWindow, newDuration);
    }

    function setChainLimit(
        uint256 chainId,
        uint256 limit
    ) external onlyRole(MANAGER_ROLE) {
        chainLimits[chainId] = limit;
        emit ChainLimitSet(chainId, limit);
    }
}
