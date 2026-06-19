// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ISentinelYieldMaximizer } from "../../SentinelCoreLoop.sol";

contract MockYieldMaximizer is ISentinelYieldMaximizer {
    uint256 public callCount;
    event OptimizationExecuted();
    bool public s_shouldRevert;

    function setShouldRevert(bool status) external {
        s_shouldRevert = status;
    }

    function executeOptimization() external {
        if (s_shouldRevert) revert("MockYieldMaximizer: Forced failure");
        callCount++;
        emit OptimizationExecuted();
    }
}