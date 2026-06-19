// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';

abstract contract SentinelGuard is Ownable {
    uint256 public constant MIN_HEALTH_FACTOR = 9500;
    uint256 public constant BASE_DIVISOR = 10000;

    bool public isEmergencyPaused;

    error HealthFactorTooLow(uint256 currentHF);
    error ContractPaused();

    event EmergencyPauseTriggered(bool status);

    constructor(address initialOwner) Ownable(initialOwner) {
        isEmergencyPaused = false;
    }

    modifier onlyHealthy() {
        if (isEmergencyPaused) revert ContractPaused();

        uint256 currentHF = _calculateHealthFactor();
        if (currentHF < MIN_HEALTH_FACTOR) revert HealthFactorTooLow(currentHF);
        _;
    }

    function setEmergencyPause(bool status) external onlyOwner {
        isEmergencyPaused = status;
        emit EmergencyPauseTriggered(status);
    }

    function _calculateHealthFactor() internal view virtual returns (uint256);
}
