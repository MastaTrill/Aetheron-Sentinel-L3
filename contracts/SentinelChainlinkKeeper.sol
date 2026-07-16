// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./SentinelCore.sol";

contract SentinelChainlinkKeeper is Ownable {
    SentinelCore public sentinelCore;
    address public immutable sentinelCoreAddress;
    address public forwarder;
    uint256 public lastUpkeepTime;
    uint256 public upkeepInterval = 1 hours;
    uint256 public constant MAX_PERFORM_GAS = 500000;

    event UpkeepPerformed(uint256 timestamp, uint256 gasUsed);
    event IntervalUpdated(uint256 newInterval);
    event ForwarderUpdated(address indexed forwarder);

    constructor(address _sentinelCore) Ownable(msg.sender) {
        sentinelCore = SentinelCore(_sentinelCore);
        sentinelCoreAddress = _sentinelCore;
        lastUpkeepTime = block.timestamp;
    }

    function setForwarder(address _forwarder) external onlyOwner {
        forwarder = _forwarder;
        emit ForwarderUpdated(_forwarder);
    }

    function checkUpkeep(bytes calldata)
        external
        view
        returns (bool upkeepNeeded, bytes memory performData)
    {
        bool timeCheck = (block.timestamp - lastUpkeepTime) >= upkeepInterval;
        bool sentinelCheck = _checkSentinelNeeds();
        upkeepNeeded = timeCheck && sentinelCheck;
        performData = abi.encode(block.timestamp);
    }

    function performUpkeep(bytes calldata) external {
        require(
            msg.sender == owner() || msg.sender == address(sentinelCore),
            "Only owner or SentinelCore can trigger upkeep"
        );
        uint256 startGas = gasleft();
        lastUpkeepTime = block.timestamp;
        _performSentinelUpkeep();
        uint256 gasUsed = startGas - gasleft();
        emit UpkeepPerformed(block.timestamp, gasUsed);
        require(gasUsed <= MAX_PERFORM_GAS, "Upkeep gas limit exceeded");
    }

    function updateInterval(uint256 _interval) external onlyOwner {
        upkeepInterval = _interval;
        emit IntervalUpdated(_interval);
    }

    function _checkSentinelNeeds() internal view returns (bool) {
        (bool active, , uint64 syncedAt) = sentinelCore.getHeartbeatState();
        if (!active) return true;
        if (block.timestamp - syncedAt > upkeepInterval) return true;
        return false;
    }

    function _performSentinelUpkeep() internal {
        (bool active, uint32 currentTarget, ) = sentinelCore.getHeartbeatState();
        if (!active) {
            sentinelCore.releaseHeartbeat(currentTarget);
        }
    }
}