// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MockBridge
 * @notice Mock bridge contract for testing SentinelInterceptor
 */
contract MockBridge is Pausable {
    bool public emergencyPaused;

    event BridgePaused();
    event BridgeResumed();

    function emergencyPause() external {
        emergencyPaused = true;
        _pause();
        emit BridgePaused();
    }

    function resume() external {
        emergencyPaused = false;
        _unpause();
        emit BridgeResumed();
    }

    // Mock bridge function for testing
    function mockDeposit(uint256 amount) external pure returns (bool) {
        require(amount > 0, "Zero amount");
        return true;
    }
}
