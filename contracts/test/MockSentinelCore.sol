// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockSentinelCore is Ownable {
    uint256 public BASELINE_YIELD_BPS = 289; // 2.89%
    bool public heartbeatActive;
    uint256 public heartbeatSyncedAt;
    uint256 public currentTargetYieldBps;

    // Gas Simulation: Strategy Hook Simulation
    mapping(uint256 => bytes32) private _strategyState;

    event HeartbeatLocked(uint256 timestamp);
    event HeartbeatReleased(uint256 timestamp, uint256 targetYieldBps);

    constructor(address initialOwner) Ownable(initialOwner) {
        heartbeatActive = false; // Initially inactive
        heartbeatSyncedAt = block.timestamp;
        currentTargetYieldBps = BASELINE_YIELD_BPS;
    }

    function getHeartbeatState() public view returns (bool active, uint256 currentTarget, uint256 syncedAt) {
        return (heartbeatActive, currentTargetYieldBps, heartbeatSyncedAt);
    }

    function lockHeartbeat() public onlyOwner {
        heartbeatActive = false;

        // Gas Simulation: Update multiple slots to simulate locking a distributed system
        for (uint256 i = 0; i < 5; i++) {
            _strategyState[i] = keccak256(abi.encodePacked(block.timestamp, i));
        }

        emit HeartbeatLocked(block.timestamp);
    }

    function releaseHeartbeat(uint256 _targetYieldBps) public onlyOwner {
        heartbeatActive = true;
        heartbeatSyncedAt = block.timestamp;
        currentTargetYieldBps = _targetYieldBps;

        // Gas Simulation: Simulate rebalancing compute overhead
        // This approximates the AI anomaly check and quantum entropy gathering
        for (uint256 i = 0; i < 12; i++) {
            _strategyState[i] = keccak256(abi.encodePacked(_targetYieldBps, i, block.prevrandao));
        }

        emit HeartbeatReleased(block.timestamp, _targetYieldBps);
    }

    // Add other functions that SentinelChainlinkKeeper might call, if any, for a more complete mock.
}