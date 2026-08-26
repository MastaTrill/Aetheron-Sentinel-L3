// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockCrossChainOracle {
    uint256 public globalThreatLevel;

    function setGlobalThreatLevel(uint256 _level) external {
        globalThreatLevel = _level;
    }

    function aggregatedMetrics() external view returns (uint256, uint256, uint256, uint256, uint256) {
        return (globalThreatLevel, 0, 0, 0, 0);
    }
}
