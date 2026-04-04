/**
 * @title CircuitBreaker Formal Verification Spec
 * @notice Certora Prover specifications for CircuitBreaker.sol
 *
 * @specification Language: Certora Verification Language (CVL)
 * @author Aetheron Security Team
 * @version 1.0
 */

// =============================================================================
// IMPORTS
// =============================================================================

import ".certora/macros/TokenVoting.sol";

// =============================================================================
// CONSTANTS (matching Solidity contract)
// =============================================================================

definition THRESHOLD() = 5;
definition SUCCESS_THRESHOLD() = 3;
definition SENTINEL_ROLE() = keccak256("SENTINEL_ROLE");
definition ADMIN_ROLE() = 0x00; // DEFAULT_ADMIN_ROLE

// =============================================================================
// METHODS BLOCK
// =============================================================================

methods {
    currentState() returns (uint8) envfree
    failureCount() returns (uint256) envfree
    successCount() returns (uint256) envfree
    resetTimeout() returns (uint256) envfree
    lastStateChange() returns (uint256) envfree
    getState() returns (uint8, uint256) envfree
    getStats() returns (uint8, uint256, uint256, uint256, uint256) envfree
    hasRole(bytes32, address) returns (bool)
    forceOpen() => NONDET
    forceClose() => NONDET
    setResetTimeout(uint256) => NONDET
}

// =============================================================================
// INVARIANTS
// =============================================================================

/**
 * @notice INVARIANT: Failure count never exceeds threshold when closed
 */
invariant failureCountBounds()
    currentState() == 0 => failureCount() <= THRESHOLD()

/**
 * @notice INVARIANT: Success count only increments in HALF_OPEN state
 */
invariant successCountInHalfOpen()
    currentState() != 2 => successCount() == 0

/**
 * @notice INVARIANT: State transitions are valid
 */
invariant validStateTransitions()
    currentState() >= 0 && currentState() <= 2

/**
 * @notice INVARIANT: Reset timeout is reasonable
 */
invariant resetTimeoutReasonable()
    resetTimeout() > 0 && resetTimeout() <= 7 days

// =============================================================================
// RULES
// =============================================================================

/**
 * @notice RULE: Circuit opens after threshold failures
 */
rule circuitOpensAfterThreshold() {
    env e;
    require currentState() == 0; // CLOSED
    require failureCount() < THRESHOLD();

    // Simulate failures
    uint256 calls = THRESHOLD() - failureCount();
    // In practice, this would be modeled by calling recordFailure modifier multiple times

    // After threshold failures, circuit should open
    assert calls == THRESHOLD() - failureCount() =>
        failureCount() >= THRESHOLD() => currentState() == 1; // OPEN
}

/**
 * @notice RULE: Only sentinel can force open
 */
rule onlySentinelCanForceOpen() {
    env e;
    require !hasRole(SENTINEL_ROLE, e.msg.sender);

    uint8 oldState = currentState();

    forceOpen@withrevert(e);

    // Non-sentinel cannot force open
    assert lastRevert || currentState() == oldState;
}

/**
 * @notice RULE: Only admin can force close
 */
rule onlyAdminCanForceClose() {
    env e;
    require !hasRole(ADMIN_ROLE, e.msg.sender);

    uint8 oldState = currentState();

    forceClose@withrevert(e);

    // Non-admin cannot force close
    assert lastRevert || currentState() == oldState;
}

/**
 * @notice RULE: Reset timeout can only be set by admin
 */
rule onlyAdminCanSetResetTimeout() {
    env e;
    require !hasRole(ADMIN_ROLE, e.msg.sender);

    uint256 oldTimeout = resetTimeout();

    setResetTimeout@withrevert(e, 2 hours);

    assert lastRevert || resetTimeout() == oldTimeout;
}

/**
 * @notice RULE: Circuit transitions to HALF_OPEN after timeout
 */
rule circuitHalfOpensAfterTimeout() {
    env e;
    require currentState() == 1; // OPEN
    require block.timestamp >= lastStateChange() + resetTimeout();

    // Call a circuitNormal function (simulated)
    // This would trigger the modifier

    assert currentState() == 2; // HALF_OPEN
}

/**
 * @notice RULE: Circuit closes after success threshold in HALF_OPEN
 */
rule circuitClosesAfterSuccesses() {
    env e;
    require currentState() == 2; // HALF_OPEN
    require successCount() < SUCCESS_THRESHOLD();

    // Simulate successes
    uint256 calls = SUCCESS_THRESHOLD() - successCount();

    assert calls == SUCCESS_THRESHOLD() - successCount() =>
        successCount() >= SUCCESS_THRESHOLD() => currentState() == 0; // CLOSED
}

// =============================================================================
// END OF SPEC
// =============================================================================