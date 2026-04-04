// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CircuitBreaker
 * @notice Tri-state circuit breaker: CLOSED → OPEN → HALF_OPEN
 * @dev Automatically trips based on failure thresholds
 */
contract CircuitBreaker is AccessControl, Pausable {
    enum State {
        CLOSED,
        OPEN,
        HALF_OPEN
    }

    bytes32 public constant SENTINEL_ROLE = keccak256("SENTINEL_ROLE");

    State public currentState = State.CLOSED;
    uint256 public failureCount;
    uint256 public successCount;

    /// @notice Number of failures to trip the circuit
    uint256 public constant THRESHOLD = 5;

    /// @notice Time to wait before transitioning to HALF_OPEN
    uint256 public resetTimeout = 1 hours;

    /// @notice Timestamp of last state change
    uint256 public lastStateChange;

    /// @notice Successful calls required to close from HALF_OPEN
    uint256 public constant SUCCESS_THRESHOLD = 3;

    event CircuitOpened(uint256 timestamp, uint256 failureCount);
    event CircuitHalfOpened(uint256 timestamp);
    event CircuitClosed(uint256 timestamp);
    event FailureRecorded(address indexed target, uint256 newCount);
    event SuccessRecorded(address indexed target, uint256 newCount);

    error CircuitOpen();
    error CircuitHalfOpenRetry();
    error InvalidStateTransition();

    modifier circuitNormal() {
        if (currentState == State.OPEN) {
            if (block.timestamp >= lastStateChange + resetTimeout) {
                currentState = State.HALF_OPEN;
                lastStateChange = block.timestamp;
                emit CircuitHalfOpened(block.timestamp);
            } else {
                revert CircuitOpen();
            }
        }
        _;
    }

    modifier recordSuccess() {
        _;
        if (currentState == State.HALF_OPEN) {
            successCount++;
            emit SuccessRecorded(msg.sender, successCount);
            if (successCount >= SUCCESS_THRESHOLD) {
                _closeCircuit();
            }
        }
        failureCount = 0;
    }

    modifier recordFailure() {
        _;
        failureCount++;
        emit FailureRecorded(msg.sender, failureCount);
        if (failureCount >= THRESHOLD && currentState == State.CLOSED) {
            _openCircuit();
        }
    }

    constructor() {
        lastStateChange = block.timestamp;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SENTINEL_ROLE, msg.sender);
    }

    function _openCircuit() internal {
        currentState = State.OPEN;
        lastStateChange = block.timestamp;
        failureCount = 0;
        successCount = 0;
        emit CircuitOpened(block.timestamp, THRESHOLD);
    }

    function _closeCircuit() internal {
        currentState = State.CLOSED;
        lastStateChange = block.timestamp;
        failureCount = 0;
        successCount = 0;
        emit CircuitClosed(block.timestamp);
    }

    function forceOpen() external onlyRole(SENTINEL_ROLE) {
        if (currentState != State.OPEN) {
            _openCircuit();
        }
    }

    function forceClose() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (currentState != State.CLOSED) {
            _closeCircuit();
        }
    }

    function setResetTimeout(
        uint256 newTimeout
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        resetTimeout = newTimeout;
    }

    function getState() external view returns (State, uint256) {
        return (currentState, lastStateChange);
    }

    function getStats()
        external
        view
        returns (
            State state,
            uint256 failures,
            uint256 successes,
            uint256 timeSinceChange,
            uint256 untilReset
        )
    {
        uint256 untilResetVal = 0;
        if (currentState == State.OPEN) {
            if (block.timestamp < lastStateChange + resetTimeout) {
                untilResetVal =
                    lastStateChange +
                    resetTimeout -
                    block.timestamp;
            }
        }
        return (
            currentState,
            failureCount,
            successCount,
            block.timestamp - lastStateChange,
            untilResetVal
        );
    }
}
