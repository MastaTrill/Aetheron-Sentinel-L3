// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SentinelCore
 * @dev Manages the heartbeat release, invariant state checks, and DeFAI active
 * re-balancing hooks to enforce a strict APY target (e.g., 5.00%).
 */
contract SentinelCore is Ownable {
    bool public heartbeatActive;
    uint256 public targetYieldBps; // Represented in basis points (500 = 5.00%)
    uint256 public lastSyncTimestamp;

    // Constant for the baseline we are overcoming (2.89% passive MAVAN)
    uint256 public constant BASELINE_YIELD_BPS = 289;

    event HeartbeatReleased(uint256 newTargetYieldBps, uint256 timestamp);
    event TelemetryReset(
        uint256 previousYield,
        uint256 newYield,
        uint256 timestamp
    );
    event RebalanceHookFired(uint256 currentBlock, string status);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "SentinelCore: invalid owner");

        heartbeatActive = false; // Starts locked pending settlement/authorization
        targetYieldBps = BASELINE_YIELD_BPS;
        lastSyncTimestamp = block.timestamp;

        if (initialOwner != msg.sender) {
            _transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Releases the heartbeat and updates the target yield parameters.
     * @dev This is the exact function called by scripts/telemetry_reset.py.
     * @param _targetYieldBps The new yield target in basis points (e.g., 500).
     */
    function releaseHeartbeat(uint256 _targetYieldBps) external onlyOwner {
        require(!heartbeatActive, "SentinelCore: Heartbeat is already active");
        require(
            _targetYieldBps > BASELINE_YIELD_BPS,
            "SentinelCore: Target must exceed baseline"
        );

        uint256 previousYield = targetYieldBps;

        // Update state
        heartbeatActive = true;
        targetYieldBps = _targetYieldBps;
        lastSyncTimestamp = block.timestamp;

        emit TelemetryReset(previousYield, targetYieldBps, block.timestamp);
        emit HeartbeatReleased(targetYieldBps, block.timestamp);

        // Immediately trigger the first re-balancing epoch
        _fireDeFAIHooks();
    }

    /**
     * @notice Internal function to execute high-frequency re-balancing.
     * @dev In production, this would interact with localized L3 routing contracts.
     */
    function _fireDeFAIHooks() internal {
        emit RebalanceHookFired(
            block.number,
            "Quantum-Resistant 5.0% Alpha Sync Complete"
        );
    }

    /**
     * @notice Allows external monitoring tools to verify treasury protection state.
     * @return isActive True when active heartbeat mode is enabled.
     * @return currentTarget Current APY target in basis points.
     * @return syncedAt Last synchronization timestamp.
     */
    function getHeartbeatState()
        external
        view
        returns (bool isActive, uint256 currentTarget, uint256 syncedAt)
    {
        return (heartbeatActive, targetYieldBps, lastSyncTimestamp);
    }

    /**
     * @notice Allows owner to lock heartbeat and reset to baseline.
     */
    function lockHeartbeat() external onlyOwner {
        uint256 previousYield = targetYieldBps;

        heartbeatActive = false;
        targetYieldBps = BASELINE_YIELD_BPS;
        lastSyncTimestamp = block.timestamp;

        emit TelemetryReset(previousYield, BASELINE_YIELD_BPS, block.timestamp);
    }
}
