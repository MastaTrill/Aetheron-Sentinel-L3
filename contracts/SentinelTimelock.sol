// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title SentinelTimelock
 * @notice Time-locked governance for critical Sentinel operations
 */
contract SentinelTimelock is TimelockController {
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}

    /**
     * @notice Schedule a critical operation with time delay
     * @param target Contract to call
     * @param value ETH value to send
     * @param data Calldata
     * @param predecessor Operation to wait for
     * @param salt Unique identifier
     * @param delay Operation delay
     */
    function scheduleCriticalOperation(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) external onlyRole(PROPOSER_ROLE) {
        require(delay >= getMinDelay(), "Delay too short");
        schedule(target, value, data, predecessor, salt, delay);
    }
}
