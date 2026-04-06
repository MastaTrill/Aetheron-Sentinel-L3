/**
 * @title RateLimiter Formal Verification Spec
 * @notice Certora Prover specifications for RateLimiter.sol
 *
 * @specification Language: Certora Verification Language (CVL)
 * @author Aetheron Security Team
 * @version 1.0
 */

// =============================================================================
// IMPORTS
// =============================================================================

// =============================================================================
// CONSTANTS (matching Solidity contract)
// =============================================================================

definition MANAGER_ROLE() = keccak256("MANAGER_ROLE");
definition ADMIN_ROLE() = 0x00; // DEFAULT_ADMIN_ROLE

// =============================================================================
// METHODS BLOCK
// =============================================================================

methods {
    maxWithdrawalPerWindow() returns (uint256) envfree
    windowDuration() returns (uint256) envfree
    windowStart() returns (uint256) envfree
    currentWindowAmount() returns (uint256) envfree
    chainLimits(uint256) returns (uint256) envfree
    getAverageWindowAmount() returns (uint256) envfree
    getWindowStats() returns (uint256, uint256, uint256) envfree
    hasRole(bytes32, address) returns (bool)
    setMaxWithdrawalPerWindow(uint256) => NONDET
    setWindowDuration(uint256) => NONDET
    setChainLimit(uint256, uint256) => NONDET
}

// =============================================================================
// INVARIANTS
// =============================================================================

/**
 * @notice INVARIANT: Limits are always positive
 */
invariant positiveLimits()
    maxWithdrawalPerWindow() > 0 && windowDuration() > 0

/**
 * @notice INVARIANT: Window amounts don't exceed limits
 */
invariant windowAmountBounds()
    currentWindowAmount() <= maxWithdrawalPerWindow()

/**
 * @notice INVARIANT: Chain limits are reasonable
 */
invariant chainLimitsReasonable()
    forall uint256 chainId. chainLimits(chainId) <= maxWithdrawalPerWindow() || chainLimits(chainId) == 0

/**
 * @notice INVARIANT: Window start is not in future
 */
invariant windowStartNotFuture()
    windowStart() <= block.timestamp

// =============================================================================
// RULES
// =============================================================================

/**
 * @notice RULE: Rate limit check prevents exceeding limits
 */
rule rateLimitEnforced() {
    env e;
    uint256 amount;
    uint256 chainId;

    uint256 effectiveLimit = chainLimits(chainId) > 0 ? chainLimits(chainId) : maxWithdrawalPerWindow();
    uint256 available = effectiveLimit - currentWindowAmount();

    // If trying to withdraw more than available, should revert
    if (amount > available) {
        _checkRateLimit@withrevert(e, amount, chainId);
        assert lastRevert;
    }
}

/**
 * @notice RULE: Only manager can set limits
 */
rule onlyManagerCanSetLimits() {
    env e;
    require !hasRole(MANAGER_ROLE, e.msg.sender);

    uint256 oldLimit = maxWithdrawalPerWindow();

    setMaxWithdrawalPerWindow@withrevert(e, 1000);

    assert lastRevert || maxWithdrawalPerWindow() == oldLimit;
}

/**
 * @notice RULE: Only manager can set window duration
 */
rule onlyManagerCanSetDuration() {
    env e;
    require !hasRole(MANAGER_ROLE, e.msg.sender);

    uint256 oldDuration = windowDuration();

    setWindowDuration@withrevert(e, 3600);

    assert lastRevert || windowDuration() == oldDuration;
}

/**
 * @notice RULE: Only manager can set chain limits
 */
rule onlyManagerCanSetChainLimits() {
    env e;
    require !hasRole(MANAGER_ROLE, e.msg.sender);

    uint256 chainId = 1;
    uint256 oldLimit = chainLimits(chainId);

    setChainLimit@withrevert(e, chainId, 500);

    assert lastRevert || chainLimits(chainId) == oldLimit;
}

/**
 * @notice RULE: Window resets properly
 */
rule windowResetTiming() {
    env e;
    require block.timestamp >= windowStart() + windowDuration();

    // Call a function that triggers _updateWindow
    getWindowStats(e);

    assert windowStart() == block.timestamp;
    assert currentWindowAmount() == 0;
}

/**
 * @notice RULE: Average calculation is correct
 */
rule averageCalculationCorrect() {
    uint256 sum = 0;
    for (uint256 i = 0; i < 10; i++) {
        sum += recentWindowAmounts[i];
    }

    uint256 avg = getAverageWindowAmount();

    assert avg == sum / 10;
}

/**
 * @notice RULE: Window stats are accurate
 */
rule windowStatsAccurate() {
    let (remaining, used, limit) = getWindowStats();

    assert used == currentWindowAmount();
    assert limit == maxWithdrawalPerWindow();
    if (block.timestamp < windowStart() + windowDuration()) {
        assert remaining == windowStart() + windowDuration() - block.timestamp;
    } else {
        assert remaining == 0;
    }
}

// =============================================================================
// END OF SPEC
// =============================================================================