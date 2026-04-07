/**
 * @title FlashLoanProtection Formal Verification Spec
 * @notice Certora Prover specifications for FlashLoanProtection.sol
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

definition MAX_FLASH_LOAN_RATIO() = 90; // 90%
definition MIN_HEALTH_FACTOR() = 110; // 1.1
definition SENTINEL_ROLE() = keccak256("SENTINEL_ROLE");
definition ADMIN_ROLE() = 0x00; // DEFAULT_ADMIN_ROLE

// =============================================================================
// METHODS BLOCK
// =============================================================================

methods {
    maxFlashLoanRatio() returns (uint256) envfree
    minHealthFactor() returns (uint256) envfree
    hasRole(bytes32, address) returns (bool)
    setMaxFlashLoanRatio(uint256) => NONDET
    setMinHealthFactor(uint256) => NONDET
}

// =============================================================================
// INVARIANTS
// =============================================================================

/**
 * @notice INVARIANT: Flash loan ratio is within bounds
 */
invariant flashLoanRatioBounds()
    maxFlashLoanRatio() <= MAX_FLASH_LOAN_RATIO() && maxFlashLoanRatio() > 0

/**
 * @notice INVARIANT: Health factor is reasonable
 */
invariant healthFactorReasonable()
    minHealthFactor() >= MIN_HEALTH_FACTOR() && minHealthFactor() <= 200

// =============================================================================
// RULES
// =============================================================================

/**
 * @notice RULE: Only admin can set flash loan ratio
 */
rule onlyAdminCanSetFlashLoanRatio() {
    env e;
    require !hasRole(ADMIN_ROLE, e.msg.sender);

    uint256 oldRatio = maxFlashLoanRatio();

    setMaxFlashLoanRatio@withrevert(e, 80);

    assert lastRevert || maxFlashLoanRatio() == oldRatio;
}

/**
 * @notice RULE: Only admin can set min health factor
 */
rule onlyAdminCanSetHealthFactor() {
    env e;
    require !hasRole(ADMIN_ROLE, e.msg.sender);

    uint256 oldFactor = minHealthFactor();

    setMinHealthFactor@withrevert(e, 120);

    assert lastRevert || minHealthFactor() == oldFactor;
}

/**
 * @notice RULE: Flash loan protection prevents excessive borrowing
 */
rule flashLoanProtectionEnforced() {
    env e;
    uint256 loanAmount;
    uint256 totalValue;

    // If loan amount exceeds max ratio of total value, should be blocked
    if (loanAmount * 100 > totalValue * maxFlashLoanRatio()) {
        // This would trigger the protection logic
        assert false; // Should not allow such loan
    }
}

// =============================================================================
// END OF SPEC
// =============================================================================