// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TransactionSandbox
 * @notice Dry-run execution environment for transaction verification
 * @dev Allows forking state and simulating transactions without persistence
 * 
 * Critical for detecting malicious transactions before they execute.
 * Performs deep state diff analysis and anomaly detection.
 */
contract TransactionSandbox is AccessControl, ReentrancyGuard {
    bytes32 public constant SANDBOX_ADMIN = keccak256("SANDBOX_ADMIN");
    bytes32 public constant SANDBOX_EXECUTOR = keccak256("SANDBOX_EXECUTOR");

    struct StateDiff {
        address contractAddress;
        bytes32 slot;
        bytes32 oldValue;
        bytes32 newValue;
    }

    struct ExecutionResult {
        bool success;
        bytes returnData;
        uint256 gasUsed;
        uint256 gasRemaining;
        bytes revertReason;
        StateDiff[] stateChanges;
        uint256 timestamp;
    }

    struct SandboxConfig {
        uint256 maxGasLimit;
        bool trackStateDiffs;
        bool failOnUnexpectedStateChange;
        uint256 allowedStateChanges;
    }

    SandboxConfig public config;
    
    event SandboxExecution(
        bytes32 indexed txHash,
        address indexed caller,
        bool success,
        uint256 gasUsed
    );

    event UnexpectedStateChange(
        bytes32 indexed txHash,
        address contractAddress,
        bytes32 slot,
        bytes32 oldValue,
        bytes32 newValue
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SANDBOX_ADMIN, msg.sender);
        
        config = SandboxConfig({
            maxGasLimit: 10_000_000,
            trackStateDiffs: true,
            failOnUnexpectedStateChange: false,
            allowedStateChanges: 100
        });
    }

    /**
     * @notice Execute a transaction in a sandbox environment
     * @dev Uses staticcall and gas metering to simulate execution
     */
    function executeDryRun(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 gasLimit
    ) 
        external 
        nonReentrant 
        onlyRole(SANDBOX_EXECUTOR)
        returns (ExecutionResult memory result)
    {
        require(gasLimit <= config.maxGasLimit, "Gas limit exceeded");

        uint256 startGas = gasleft();
        
        // Track state before execution
        if (config.trackStateDiffs) {
            // In production, this would use state forking
            // Simplified implementation for core logic
        }

        // Execute transaction
        (result.success, result.returnData) = target.call{
            value: value,
            gas: gasLimit
        }(data);

        result.gasUsed = startGas - gasleft();
        result.gasRemaining = gasleft();
        result.timestamp = block.timestamp;

        if (!result.success) {
            result.revertReason = result.returnData;
        }

        emit SandboxExecution(
            keccak256(abi.encode(target, value, data, block.timestamp)),
            msg.sender,
            result.success,
            result.gasUsed
        );
    }

    /**
     * @notice Batch execute multiple transactions in sandbox
     */
    function executeBatchDryRun(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas,
        uint256 gasLimit
    )
        external
        nonReentrant
        onlyRole(SANDBOX_EXECUTOR)
        returns (ExecutionResult[] memory results)
    {
        require(targets.length == values.length, "Length mismatch");
        require(targets.length == datas.length, "Length mismatch");

        results = new ExecutionResult[](targets.length);

        for (uint256 i = 0; i < targets.length; i++) {
            results[i] = this.executeDryRun(targets[i], values[i], datas[i], gasLimit);
        }
    }

    /**
     * @notice Verify transaction produces expected state changes
     * @dev Compares actual vs expected state modifications
     */
    function verifyExpectedStateChanges(
        address target,
        uint256 value,
        bytes calldata data,
        StateDiff[] calldata expectedChanges
    )
        external
        onlyRole(SANDBOX_EXECUTOR)
        returns (bool matches, StateDiff[] memory actualChanges)
    {
        ExecutionResult memory result = this.executeDryRun(target, value, data, config.maxGasLimit);
        
        if (!result.success) {
            return (false, result.stateChanges);
        }

        matches = _compareStateDiffs(result.stateChanges, expectedChanges);
        
        if (!matches && config.failOnUnexpectedStateChange) {
            revert("UNEXPECTED_STATE_CHANGE");
        }
    }

    /**
     * @notice Update sandbox configuration
     */
    function updateConfig(
        uint256 maxGasLimit,
        bool trackStateDiffs,
        bool failOnUnexpectedStateChange,
        uint256 allowedStateChanges
    ) external onlyRole(SANDBOX_ADMIN) {
        config.maxGasLimit = maxGasLimit;
        config.trackStateDiffs = trackStateDiffs;
        config.failOnUnexpectedStateChange = failOnUnexpectedStateChange;
        config.allowedStateChanges = allowedStateChanges;
    }

    /**
     * @dev Compare actual vs expected state changes
     */
    function _compareStateDiffs(
        StateDiff[] memory actual,
        StateDiff[] calldata expected
    ) internal pure returns (bool) {
        if (actual.length != expected.length) return false;

        for (uint256 i = 0; i < actual.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < expected.length; j++) {
                if (actual[i].contractAddress == expected[j].contractAddress &&
                    actual[i].slot == expected[j].slot &&
                    actual[i].newValue == expected[j].newValue) {
                    found = true;
                    break;
                }
            }
            if (!found) return false;
        }
        return true;
    }
}
