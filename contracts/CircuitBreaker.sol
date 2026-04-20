// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title CircuitBreaker
 * @notice Circuit breaker pattern for bridge security
 */
contract CircuitBreaker is Ownable, AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");

    enum State {
        CLOSED,
        OPEN,
        HALF_OPEN
    }

    mapping(uint256 => State) public circuitStates;
    mapping(uint256 => uint256) public failureCounts;
    mapping(uint256 => uint256) public lastFailureTime;
    mapping(uint256 => uint256) public lastSuccessTime;
    mapping(uint256 => uint256[]) public failureHistory; // Track failure timestamps

    uint256 public constant FAILURE_THRESHOLD = 5;
    uint256 public constant TIMEOUT_PERIOD = 3600; // 1 hour
    uint256 public constant RECOVERY_ATTEMPTS = 3; // Successes needed in half-open
    uint256 public constant FAILURE_WINDOW = 3600; // 1 hour window for failure analysis
    uint256 public constant MAX_FAILURE_HISTORY = 100; // Max failures to track

    mapping(uint256 => uint256) public halfOpenSuccessCount;
    mapping(uint256 => bool) public permanentShutdown; // Emergency permanent shutdown

    event CircuitOpened(uint256 chainId, uint256 failureCount);
    event CircuitHalfOpened(uint256 chainId);
    event CircuitClosed(uint256 chainId);
    event FailureRecorded(address indexed reporter, uint256 chainId);
    event SuccessRecorded(address indexed reporter, uint256 chainId);
    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);

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
     * @notice Records a failure for a chain with enhanced analysis
     * @param chainId Chain ID
     * @param failureSeverity Severity level (1-10)
     */
    function recordFailure(
        uint256 chainId,
        uint256 failureSeverity
    ) external whenNotPaused onlyRole(MONITOR_ROLE) {
        require(chainId > 0, "Invalid chain ID");
        require(
            failureSeverity >= 1 && failureSeverity <= 10,
            "Invalid severity"
        );
        require(!permanentShutdown[chainId], "Chain permanently shutdown");

        failureCounts[chainId]++;
        lastFailureTime[chainId] = block.timestamp;

        // Track failure history
        failureHistory[chainId].push(block.timestamp);
        if (failureHistory[chainId].length > MAX_FAILURE_HISTORY) {
            // Remove oldest failure
            for (uint256 i = 0; i < failureHistory[chainId].length - 1; i++) {
                failureHistory[chainId][i] = failureHistory[chainId][i + 1];
            }
            failureHistory[chainId].pop();
        }

        // Analyze failure patterns
        bool rapidFailures = checkRapidFailures(chainId);
        bool highSeverityFailure = failureSeverity >= 8;

        if (circuitStates[chainId] == State.CLOSED) {
            // Open circuit if threshold reached or rapid/high-severity failures
            if (
                failureCounts[chainId] >= FAILURE_THRESHOLD ||
                rapidFailures ||
                highSeverityFailure
            ) {
                circuitStates[chainId] = State.OPEN;
                halfOpenSuccessCount[chainId] = 0;
                emit CircuitOpened(chainId, failureCounts[chainId]);
            }
        } else if (circuitStates[chainId] == State.HALF_OPEN) {
            // Any failure in half-open re-opens circuit
            circuitStates[chainId] = State.OPEN;
            halfOpenSuccessCount[chainId] = 0;
            emit CircuitOpened(chainId, failureCounts[chainId]);
        }

        emit FailureRecorded(msg.sender, chainId);
    }

    /**
     * @notice Records a success for a chain
     * @param chainId Chain ID
     */
    function recordSuccess(
        uint256 chainId
    ) external whenNotPaused onlyRole(MONITOR_ROLE) {
        require(chainId > 0, "Invalid chain ID");

        lastSuccessTime[chainId] = block.timestamp;

        if (circuitStates[chainId] == State.OPEN) {
            circuitStates[chainId] = State.HALF_OPEN;
            halfOpenSuccessCount[chainId] = 0;
            emit CircuitHalfOpened(chainId);
        } else if (circuitStates[chainId] == State.HALF_OPEN) {
            halfOpenSuccessCount[chainId]++;

            // Require multiple successes before closing
            if (halfOpenSuccessCount[chainId] >= RECOVERY_ATTEMPTS) {
                circuitStates[chainId] = State.CLOSED;
                failureCounts[chainId] = 0; // Reset failure count
                halfOpenSuccessCount[chainId] = 0;
                emit CircuitClosed(chainId);
            }
        }

        emit SuccessRecorded(msg.sender, chainId);
    }

    /**
     * @notice Manually opens circuit for a chain
     * @param chainId Chain ID
     */
    function openCircuit(uint256 chainId) external onlyRole(OPERATOR_ROLE) {
        require(chainId > 0, "Invalid chain ID");
        circuitStates[chainId] = State.OPEN;
        halfOpenSuccessCount[chainId] = 0;
        emit CircuitOpened(chainId, failureCounts[chainId]);
    }

    /**
     * @notice Manually closes circuit for a chain
     * @param chainId Chain ID
     */
    function closeCircuit(uint256 chainId) external onlyRole(OPERATOR_ROLE) {
        require(chainId > 0, "Invalid chain ID");
        circuitStates[chainId] = State.CLOSED;
        failureCounts[chainId] = 0;
        halfOpenSuccessCount[chainId] = 0;
        emit CircuitClosed(chainId);
    }

    /**
     * @notice Checks if circuit is closed for a chain
     * @dev Automatically transitions OPEN to HALF_OPEN when timeout expires
     * @param chainId Chain ID
     * @return True if circuit is closed or can be tried
     */
    function isCircuitClosed(uint256 chainId) external returns (bool) {
        require(chainId > 0, "Invalid chain ID");

        if (circuitStates[chainId] == State.OPEN) {
            // Check if timeout has passed
            if (block.timestamp - lastFailureTime[chainId] > TIMEOUT_PERIOD) {
                circuitStates[chainId] = State.HALF_OPEN;
                halfOpenSuccessCount[chainId] = 0;
                emit CircuitHalfOpened(chainId);
                return true;
            }
            return false;
        }
        return circuitStates[chainId] == State.CLOSED;
    }

    /**
     * @notice Emergency pause all circuit breaker operations
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @notice Emergency unpause circuit breaker operations
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    /**
     * @notice Permanently shutdown a chain (emergency measure)
     * @param chainId Chain ID to shutdown
     */
    function triggerPermanentShutdown(
        uint256 chainId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        permanentShutdown[chainId] = true;
        circuitStates[chainId] = State.OPEN; // Ensure it's open
    }

    /**
     * @notice Check for rapid failure pattern
     * @param chainId Chain ID to check
     */
    function checkRapidFailures(uint256 chainId) internal view returns (bool) {
        uint256[] memory history = failureHistory[chainId];
        if (history.length < 3) return false;

        uint256 recentFailures = 0;
        uint256 windowStart = block.timestamp - FAILURE_WINDOW;

        for (uint256 i = history.length; i > 0; i--) {
            if (history[i - 1] >= windowStart) {
                recentFailures++;
                if (recentFailures >= 3) return true;
            }
        }
        return false;
    }

    /**
     * @notice Get circuit breaker statistics
     * @param chainId Chain ID
     */
    function getCircuitStats(
        uint256 chainId
    )
        external
        view
        returns (
            State state,
            uint256 failures,
            uint256 lastFailure,
            uint256 successCount,
            bool isShutdown
        )
    {
        return (
            circuitStates[chainId],
            failureCounts[chainId],
            lastFailureTime[chainId],
            halfOpenSuccessCount[chainId],
            permanentShutdown[chainId]
        );
    }

    /**
     * @notice Get failure history for analysis
     * @param chainId Chain ID
     */
    function getFailureHistory(
        uint256 chainId
    ) external view returns (uint256[] memory) {
        return failureHistory[chainId];
    }
}
