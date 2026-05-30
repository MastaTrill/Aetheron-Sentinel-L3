// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./chainlink/AutomationCompatibleInterface.sol";
import "./SentinelCore.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SentinelChainlinkKeeper is AutomationCompatibleInterface, Ownable {
  SentinelCore public sentinelCore;
  address public immutable sentinelCoreAddress;
  uint256 public lastUpkeepTime;
  uint256 public upkeepInterval = 1 hours;
  uint256 public constant MAX_PERFORM_GAS = 500000;

  event UpkeepPerformed(uint256 timestamp, uint256 gasUsed);
  event IntervalUpdated(uint256 newInterval);

  constructor(address _sentinelCore) Ownable(msg.sender) {
    sentinelCore = SentinelCore(_sentinelCore);
    sentinelCoreAddress = _sentinelCore;
    lastUpkeepTime = block.timestamp;
  }

  function checkUpkeep(
    bytes calldata /* checkData */
  ) external view override returns (bool upkeepNeeded, bytes memory performData) {
    bool timeCheck = (block.timestamp - lastUpkeepTime) >= upkeepInterval;
    bool sentinelCheck = _checkSentinelNeeds();
    upkeepNeeded = timeCheck && sentinelCheck;
    performData = abi.encode(block.timestamp);
  }

  function performUpkeep(bytes calldata /* performData */) external override {
    uint256 startGas = gasleft();
    lastUpkeepTime = block.timestamp;
    _performSentinelUpkeep();
    uint256 gasUsed = startGas - gasleft();
    require(gasUsed <= MAX_PERFORM_GAS, "Upkeep gas limit exceeded");
    emit UpkeepPerformed(block.timestamp, gasUsed);
  }

  function updateInterval(uint256 _interval) external onlyOwner {
    upkeepInterval = _interval;
    emit IntervalUpdated(_interval);
  }

  function _checkSentinelNeeds() internal view returns (bool) {
    (bool active, , uint256 syncedAt) = sentinelCore.getHeartbeatState();
    if (!active) return true;
    if (block.timestamp - syncedAt > upkeepInterval) return true;
    return false;
  }

  function _performSentinelUpkeep() internal {
    (bool active, uint256 currentTarget, ) = sentinelCore.getHeartbeatState();
    if (!active) {
      sentinelCore.releaseHeartbeat(currentTarget);
    }
  }
}