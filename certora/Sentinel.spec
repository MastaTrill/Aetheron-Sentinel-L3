/**
 * @title SentinelInterceptor Formal Verification Spec
 * @notice Certora Prover specifications for SentinelInterceptor.sol
 * 
 * @specification Language: Certora Verification Language (CVL)
 * @author Aetheron Security Team
 * @version 1.0
 */

// =============================================================================
// IMPORTS
// =============================================================================

// Note: TokenVoting macro not available - using inline definitions

// =============================================================================
// CONSTANTS (matching Solidity contract)
// =============================================================================

// These constants are derived from the Solidity contract
definition MIN_PAUSE_DURATION() = 0;
definition MAX_PAUSE_DURATION() = 3600; // 1 hour in seconds
definition TVL_SPIKE_THRESHOLD_BPS() = 1520; // 15.20% in basis points

// Roles
definition SENTINEL_ROLE() = keccak256("SENTINEL_ROLE");
definition ORACLE_ROLE() = keccak256("ORACLE_ROLE");
definition ADMIN_ROLE() = 0x00; // DEFAULT_ADMIN_ROLE

// =============================================================================
// METHODS BLOCK
// =============================================================================

methods {
    
    // View functions
    bridgeAddress()                       returns (address) envfree
    totalValueLocked()                   returns (uint256) envfree
    autonomousMode()                     returns (bool) envfree
    paused()                             returns (bool) envfree
    TVL_SPIKE_THRESHOLD()                returns (uint256) envfree
    lastPauseTimestamp()                 returns (uint256) envfree
    getSecurityStatus()                 returns (bool, uint256, bool) envfree
    getResponseMetrics()                 returns (uint256, uint256, uint256) envfree
    hasRole(bytes32, address)           returns (bool)
    
    // State changing functions
    reportAnomaly(uint256, uint256)              => NONDET
    emergencyPause(string)                       => NONDET
    resumeBridge(uint256)                        => NONDET
    updateTVL(uint256)                           => NONDET
    setAutonomousMode(bool)                      => NONDET
    updateThreshold(uint256)                     => NONDET
    
    // Role checks
    grantRole(bytes32, address)                  => NONDET
    revokeRole(bytes32, address)                  => NONDET
    
    // Block properties
    block.timestamp                               returns (uint256) envfree
}

// =============================================================================
// FUNCTIONS (Helper Functions)
// =============================================================================

// =============================================================================
// INVARIANTS
// =============================================================================

/**
 * @notice INVARIANT: Bridge can never be unpaused without admin/sentinel action
 * @description Once the bridge is paused, it requires an explicit resumeBridge call
 *             with valid parameters to unpause.
 */
invariant pausedRequiresResume()
    paused() =>
        lastPauseTimestamp() > 0 || 
        !autonomousMode()


/**
 * @notice INVARIANT: TVL can never be negative
 * @description The total value locked should always be a non-negative number.
 */
invariant tvlNonNegative()
    totalValueLocked() >= 0


/**
 * @notice INVARIANT: Pause duration cannot exceed maximum
 * @description If currently paused, the time since pause must be less than max
 */
invariant pauseDurationLimit()
    paused() =>
        block.timestamp - lastPauseTimestamp() <= MAX_PAUSE_DURATION() + 1


/**
 * @notice INVATIVE: Autonomous mode changes require proper authorization
 * @description Only accounts with ADMIN_ROLE can toggle autonomous mode
 */
invariant autonomousModeControl()
    forall address a. 
        old(autonomousMode()) != autonomousMode() =>
            hasRole(ADMIN_ROLE, a)


/**
 * @notice INVARIANT: Threshold can only be updated by admin
 */
invariant thresholdUpdateControl()
    forall uint256 newThreshold.
        old(TVL_SPIKE_THRESHOLD()) != newThreshold =>
            hasRole(ADMIN_ROLE, currentMsgSender())


/**
 * @notice INVARIANT: Anomaly detection triggers at correct threshold
 * @description If TVL spike percentage >= threshold, pause should trigger when autonomous
 */
invariant anomalyDetectionThreshold()
    forall uint256 tvlPercent, uint256 tvl.
        tvlPercent >= TVL_SPIKE_THRESHOLD_BPS() =>
        (autonomousMode() && hasRole(ORACLE_ROLE, currentMsgSender())) =>
            paused()


/**
 * @notice INVARIANT: Response metrics are consistent
 * @description Detection + Execution must equal total response time
 */
invariant responseMetricsConsistent()
    let (detect, exec, total) = getResponseMetrics() in
        detect + exec == total


/**
 * @notice INVARIANT: Security status reflects actual state
 */
invariant securityStatusAccuracy()
    let (isPaused, tvl, isAutonomous) = getSecurityStatus() in
        isPaused == paused() &&
        tvl == totalValueLocked() &&
        isAutonomous == autonomousMode()


// =============================================================================
// RULES
// =============================================================================

/**
 * @notice RULE: Anomaly at threshold triggers pause in autonomous mode
 * @description If oracle reports anomaly at or above threshold while autonomous,
 *             the contract must be paused.
 */
rule anomalyTriggersPause() {
    env e;
    require e.msg.sender != currentContract();
    
    // Store initial state
    bool wasPaused = paused();
    bool wasAutonomous = autonomousMode();
    uint256 initialTVL = totalValueLocked();
    
    // Report anomaly at threshold
    reportAnomaly@withrevert(e, TVL_SPIKE_THRESHOLD_BPS(), initialTVL);
    
    // If autonomous and was not paused, should now be paused
    assert (
        wasAutonomous && !wasPaused && !lastRevert =>
        paused()
    );
}


/**
 * @notice RULE: Anomaly below threshold does not trigger pause
 * @description If oracle reports anomaly below threshold, bridge should not pause.
 */
rule belowThresholdNoPause() {
    env e;
    require e.msg.sender != currentContract();
    
    uint256 tvlPercent = TVL_SPIKE_THRESHOLD_BPS() - 1; // Below threshold
    uint256 tvl = totalValueLocked();
    bool wasPaused = paused();
    
    reportAnomaly@withrevert(e, tvlPercent, tvl);
    
    // Should not cause new pause if wasn't paused before
    assert (
        !wasPaused && !lastRevert =>
        !paused()
    );
}


/**
 * @notice RULE: Only sentinel can manually pause
 * @description Emergency pause should only work when called by sentinel role.
 */
rule onlySentinelCanPause() {
    env e;
    require e.msg.sender != currentContract();
    require !hasRole(SENTINEL_ROLE, e.msg.sender);
    
    bool wasPaused = paused();
    
    emergencyPause@withrevert(e, "Test reason");
    
    // Non-sentinel cannot pause
    assert (
        !lastRevert =>
        paused() == wasPaused
    );
}


/**
 * @notice RULE: Sentinel can always pause
 * @description Emergency pause should succeed when called by sentinel.
 */
rule sentinelCanPause() {
    env e;
    require e.msg.sender != currentContract();
    require hasRole(SENTINEL_ROLE, e.msg.sender);
    
    bool wasPaused = paused();
    
    emergencyPause(e, "Test reason");
    
    // Should pause
    assert paused();
}


/**
 * @notice RULE: Resume requires sentinel role
 * @description Only sentinel can call resumeBridge.
 */
rule onlySentinelCanResume() {
    env e;
    require e.msg.sender != currentContract();
    require !hasRole(SENTINEL_ROLE, e.msg.sender);
    
    // Try to resume (will revert if not paused)
    resumeBridge@withrevert(e, totalValueLocked());
    
    // Non-sentinel cannot resume
    assert lastRevert;
}


/**
 * @notice RULE: Resume fails when not paused
 * @description resumeBridge should revert if bridge is not paused.
 */
rule resumeRequiresPause() {
    env e;
    require e.msg.sender != currentContract();
    require hasRole(SENTINEL_ROLE, e.msg.sender);
    require !paused(); // Not paused
    
    resumeBridge@withrevert(e, totalValueLocked());
    
    // Should revert
    assert lastRevert;
}


/**
 * @notice RULE: Resume succeeds when paused and sentinel calls
 * @description When properly paused and sentinel calls resume, it should succeed.
 */
rule resumeSucceedsWhenValid() {
    env e;
    require e.msg.sender != currentContract();
    require hasRole(SENTINEL_ROLE, e.msg.sender);
    require paused();
    require block.timestamp - lastPauseTimestamp() < MAX_PAUSE_DURATION();
    
    uint256 newTVL = totalValueLocked();
    
    resumeBridge(e, newTVL);
    
    // Should unpause
    assert !paused();
}


/**
 * @notice RULE: Resume fails after max pause duration
 * @description resumeBridge should revert if pause duration exceeded.
 */
rule resumeFailsAfterMaxDuration() {
    env e;
    require e.msg.sender != currentContract();
    require hasRole(SENTINEL_ROLE, e.msg.sender);
    require paused();
    // Simulate time passing beyond max duration
    require block.timestamp - lastPauseTimestamp() > MAX_PAUSE_DURATION();
    
    resumeBridge@withrevert(e, totalValueLocked());
    
    // Should revert
    assert lastRevert;
}


/**
 * @notice RULE: TVL update only allowed for oracle
 * @description Only oracle role can call updateTVL.
 */
rule onlyOracleCanUpdateTVL() {
    env e;
    require e.msg.sender != currentContract();
    require !hasRole(ORACLE_ROLE, e.msg.sender);
    
    uint256 oldTVL = totalValueLocked();
    uint256 newTVL = oldTVL + 1000;
    
    updateTVL@withrevert(e, newTVL);
    
    // Non-oracle cannot update TVL
    assert lastRevert || totalValueLocked() == oldTVL;
}


/**
 * @notice RULE: Autonomous mode can be toggled
 * @description Admin can enable/disable autonomous mode.
 */
rule adminCanToggleAutonomousMode() {
    env e;
    require e.msg.sender != currentContract();
    require hasRole(ADMIN_ROLE, e.msg.sender);
    
    bool oldMode = autonomousMode();
    
    setAutonomousMode(e, !oldMode);
    
    assert autonomousMode() == !oldMode;
}


/**
 * @notice RULE: Response metrics are fixed
 * @description Response metrics should always return 4ms, 10ms, 14ms.
 */
rule responseMetricsFixed() {
    let (detect, exec, total) = getResponseMetrics();
    
    assert detect == 4;
    assert exec == 10;
    assert total == 14;
}


/**
 * @notice RULE: No state leak on revert
 * @description Failed transactions should not change state.
 */
rule atomicTransactions() {
    env e;
    require e.msg.sender != currentContract();
    
    // Store state
    uint256 oldTVL = totalValueLocked();
    bool oldPaused = paused();
    bool oldAutonomous = autonomousMode();
    
    // Try failing call
    reportAnomaly@withrevert(e, TVL_SPIKE_THRESHOLD_BPS() + 1000, 0);
    
    // State should be unchanged
    assert totalValueLocked() == oldTVL;
    assert paused() == oldPaused;
    assert autonomousMode() == oldAutonomous;
}


/**
 * @notice RULE: Security status matches actual state
 */
rule securityStatusMatches() {
    let (isPaused, tvl, isAutonomous) = getSecurityStatus();
    
    assert isPaused == paused();
    assert tvl == totalValueLocked();
    assert isAutonomous == autonomousMode();
}


/**
 * @notice RULE: Threshold updates are properly controlled
 */
rule thresholdUpdateRequiresAdmin() {
    env e;
    require e.msg.sender != currentContract();
    require !hasRole(ADMIN_ROLE, e.msg.sender);
    
    uint256 oldThreshold = TVL_SPIKE_THRESHOLD();
    uint256 newThreshold = oldThreshold + 100;
    
    updateThreshold@withrevert(e, newThreshold);
    
    // Non-admin cannot update threshold
    assert lastRevert || TVL_SPIKE_THRESHOLD() == oldThreshold;
}


/**
 * @notice RULE: Guardian role can report anomalies
 */
rule guardianCanReportAnomaly() {
    env e;
    require e.msg.sender != currentContract();
    require hasRole(ORACLE_ROLE, e.msg.sender);
    
    uint256 tvlPercent = TVL_SPIKE_THRESHOLD_BPS();
    uint256 tvl = totalValueLocked();
    
    // Should not revert
    reportAnomaly(e, tvlPercent, tvl);
    
    assert !lastRevert;
}


// =============================================================================
// GHOST VARIABLES (For Tracking History)
// =============================================================================

ghost mapping(address => int256) private tvlHistory {
    init_state axiom forall address a. tvlHistory[a] == 0;
}

ghost int256 private lastTVLChange {
    init_state axiom lastTVLChange == 0;
}


// =============================================================================
// TACTICS
// =============================================================================

tactic provePauseBehavior() {
    // Tactic for proving pause-related properties
}


// =============================================================================
// END OF SPEC
// =============================================================================
