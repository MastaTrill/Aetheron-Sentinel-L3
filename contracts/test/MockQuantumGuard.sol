// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ISentinelQuantumGuard } from "../../ISentinelQuantumGuard.sol";

contract MockQuantumGuard is ISentinelQuantumGuard {
    uint256 public calibrationCount;
    uint256 public s_lastCalibration;
    bool public s_isFrozen;
    uint256 public s_hardnessLevel = 50;
    bool public s_shouldRevert;

    function setShouldRevert(bool status) external {
        s_shouldRevert = status;
    }

    function getCoherenceLevel() external pure returns (uint256) {
        return 100;
    }

    function isFrozen() external view returns (bool) {
        return s_isFrozen;
    }

    function setFrozen(bool status) external {
        s_isFrozen = status;
    }

    function rotateEncryptionKeys() external {
        emit EncryptionKeysRotated(block.timestamp);
    }

    function calibrateLatticeParameters() external {
        if (s_shouldRevert) revert("MockQuantumGuard: Forced failure");
        calibrationCount++;
        s_lastCalibration = block.timestamp;
        emit LatticeParametersCalibrated(s_hardnessLevel);
    }

    function getHardnessLevel() external view returns (uint256) {
        return s_hardnessLevel;
    }

    function setHardnessLevel(uint256 level) external {
        s_hardnessLevel = level;
    }

    function lastCalibration() external view returns (uint256) {
        return s_lastCalibration;
    }

    // Required by interface for completeness
    function updateCoherence(uint256 level) external { emit CoherenceUpdated(level); }
    function updateHeartbeat(uint256 heartbeat) external { emit HeartbeatUpdated(heartbeat); }
    function freeze() external { s_isFrozen = true; emit EmergencyFreezeOccurred(block.timestamp); }
}