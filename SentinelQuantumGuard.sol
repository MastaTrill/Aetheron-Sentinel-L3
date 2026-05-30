// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ISentinelQuantumGuard } from './ISentinelQuantumGuard.sol';
import { AggregatorV3Interface } from '@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol';
import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title SentinelQuantumGuard
 * @dev Implementation of the Quantum-Resistant Security Layer for Aetheron Sentinel.
 * Provides state management for lattice-based security parameters and key rotation.
 */
contract SentinelQuantumGuard is ISentinelQuantumGuard, Ownable {
  uint256 internal s_coherenceLevel; // private → internal for FV
  uint256 internal s_hardnessLevel; // private → internal for FV
  uint256 internal s_heartbeat; // Heartbeat threshold in seconds
  uint256 internal s_emergencyThreshold; // Threshold for emergency freeze
  bool internal s_frozen;
  AggregatorV3Interface internal s_coherenceFeed;

  error SentinelQuantumGuard__Frozen();
  error SentinelQuantumGuard__StaleData();
  error SentinelQuantumGuard__InvalidOracleData();

  /**
   * @dev Initializes the guard with a default coherence and starting hardness.
   * @param initialHardness Initial security parameter for lattice schemes.
   * @param coherenceFeed Address of the Chainlink Aggregator for coherence levels.
   */
  constructor(uint256 initialHardness, address coherenceFeed) Ownable(msg.sender) {
    s_coherenceLevel = 100;
    s_hardnessLevel = initialHardness;
    s_heartbeat = 1 hours; // Default heartbeat duration
    s_emergencyThreshold = 24 hours; // Default emergency threshold
    s_coherenceFeed = AggregatorV3Interface(coherenceFeed);
  }

  /**
   * @inheritdoc ISentinelQuantumGuard
   */
  function getCoherenceLevel() external view override returns (uint256) {
    return s_coherenceLevel;
  }

  /**
   * @inheritdoc ISentinelQuantumGuard
   */
  function getHardnessLevel() external view override returns (uint256) {
    if (msg.sender != s_coreLoop) {
      revert SentinelQuantumGuard__Unauthorized();
    }
    return s_hardnessLevel;
  }

  /**
   * @inheritdoc ISentinelQuantumGuard
   */
  function isFrozen() external view override returns (bool) {
    return s_frozen;
  }

  /**
   * @notice Updates the coherence level from the Chainlink Oracle feed.
   * @dev Maps the oracle's int256 output to a 0-100 scale.
   */
  function updateCoherenceFromOracle() external {
    if (s_frozen) {
      revert SentinelQuantumGuard__Frozen();
    }

    (
      uint80 roundId,
      int256 coherence,
      ,
      uint256 updatedAt,
      uint80 answeredInRound
    ) = s_coherenceFeed.latestRoundData();

    // Emergency check: If data is "too stale", trigger a permanent freeze
    if (updatedAt != 0 && block.timestamp - updatedAt > s_emergencyThreshold) {
      s_frozen = true;
      emit EmergencyFreezeOccurred(block.timestamp);
      return;
    }

    // Standard operational staleness check
    if (updatedAt == 0 || answeredInRound < roundId || block.timestamp - updatedAt > s_heartbeat) {
      revert SentinelQuantumGuard__StaleData();
    }

    if (coherence <= 0) {
      revert SentinelQuantumGuard__InvalidOracleData();
    }

    // Dynamically fetch decimals to ensure compatibility across Mainnet and Base
    uint8 decimals = s_coherenceFeed.decimals();
    uint256 precision = 10 ** decimals;

    uint256 normalizedCoherence = uint256(coherence) / precision;
    s_coherenceLevel = normalizedCoherence > 100 ? 100 : normalizedCoherence;

    emit CoherenceUpdated(s_coherenceLevel);
  }

  /**
   * @notice Updates the heartbeat threshold for oracle data.
   * @param newHeartbeat The new duration in seconds.
   */
  function setHeartbeat(uint256 newHeartbeat) external onlyOwner {
    s_heartbeat = newHeartbeat;
    emit HeartbeatUpdated(newHeartbeat);
  }

  /**
   * @notice Sets the threshold for triggering an emergency freeze.
   * @param newThreshold The duration in seconds.
   */
  function setEmergencyThreshold(uint256 newThreshold) external onlyOwner {
    s_emergencyThreshold = newThreshold;
  }

  /**
   * @notice Unfreezes the guard after an emergency has been resolved.
   * @dev Only callable by the owner/multisig.
   */
  function unfreeze() external onlyOwner {
    if (!s_frozen) {
      revert SentinelQuantumGuard__InvalidOracleData(); // Or a custom "NotFrozen" error
    }
    s_frozen = false;
    emit EmergencyUnfreezeOccurred(block.timestamp);
  }

  /**
   * @notice Returns the current heartbeat threshold.
   * @return The heartbeat duration in seconds.
   */
  function getHeartbeat() external view returns (uint256) {
    return s_heartbeat;
  }

  /**
   * @notice Sets the address of the CoreLoop engine allowed to trigger security functions.
   * @param coreLoop The address of the SentinelCoreLoop contract.
   */
  function setCoreLoop(address coreLoop) external onlyOwner {
    s_coreLoop = coreLoop;
  }

  /**
   * @inheritdoc ISentinelQuantumGuard
   * @notice Restricts key rotation to the owner or the authorized CoreLoop.
   */
  function rotateEncryptionKeys() external override {
    if (msg.sender != owner() && msg.sender != s_coreLoop) {
      revert SentinelQuantumGuard__Unauthorized();
    }
    // TODO: Integrate Dilithium/Falcon key invalidation logic
    emit EncryptionKeysRotated(block.timestamp);
  }

  /**
   * @notice Updates the oracle feed address.
   * @param newFeed The address of the new AggregatorV3 source.
   */
  function setCoherenceFeed(address newFeed) external onlyOwner {
    s_coherenceFeed = AggregatorV3Interface(newFeed);
  }

  /**
   * @inheritdoc ISentinelQuantumGuard
   * @notice Adjusts security parameters. Callable by owner or CoreLoop during high-threat scenarios.
   */
  function calibrateLatticeParameters() external override {
    if (msg.sender != owner() && msg.sender != s_coreLoop) {
      revert SentinelQuantumGuard__Unauthorized();
    }
    // TODO: Update s_hardnessLevel based on external entropy or threat intel
    // s_hardnessLevel = ...;

    emit LatticeParametersCalibrated(s_hardnessLevel);
  }
}
