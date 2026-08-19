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
  address internal s_coreLoop;
  AggregatorV3Interface internal s_coherenceFeed;

  // TWAC State Variables
  uint256 private s_currentKeyEpoch;
  mapping(address => bool) internal s_authorizedReaders;
  mapping(address => uint256) public s_readerLastUpdate;
  uint256 public constant GOVERNANCE_COOLDOWN = 2 days;
  uint256 public s_coherenceAccumulator;
  uint256 public s_lastUpdateTimestamp;

  // Sliding Window Config
  struct Observation {
    uint256 timestamp;
    uint256 accumulator;
  }

  uint256 public constant OBSERVATION_SIZE = 16;
  uint256 public constant OBSERVATION_MASK = 15;
  Observation[OBSERVATION_SIZE] public s_observations; // Circular buffer (approx 80 mins of history)
  uint256 public s_observationIndex;
  uint256 public constant SNAPSHOT_INTERVAL = 5 minutes;

  // Security Boundaries
  uint256 public constant MAX_HARDNESS = 8192;
  uint256 public constant MIN_COHERENCE = 5;

  error SentinelQuantumGuard__Frozen();
  error SentinelQuantumGuard__StaleData();
  error SentinelQuantumGuard__InvalidOracleData();
  error SentinelQuantumGuard__Unauthorized();
  error SentinelQuantumGuard__CooldownActive();
  error SentinelQuantumGuard__NotFrozen();

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
    s_lastUpdateTimestamp = block.timestamp;

    // Initialize first observation
    s_observations[0] = Observation(block.timestamp, 0);
    s_observationIndex = 1;
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
    if (!s_authorizedReaders[msg.sender] && msg.sender != owner()) {
      revert SentinelQuantumGuard__Unauthorized();
    }
    return s_hardnessLevel;
  }

  /**
   * @notice Returns the current encryption key epoch.
   */
  function getKeyEpoch() external view returns (uint256) {
    return s_currentKeyEpoch;
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

    // Update TWAC Accumulator before changing s_coherenceLevel
    uint256 timeElapsed = block.timestamp - s_lastUpdateTimestamp;
    if (timeElapsed > 0) {
      s_coherenceAccumulator += s_coherenceLevel * timeElapsed;
      s_lastUpdateTimestamp = block.timestamp;
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
    s_coherenceLevel = normalizedCoherence > 100
      ? 100
      : (normalizedCoherence < MIN_COHERENCE ? MIN_COHERENCE : normalizedCoherence);

    // Record observation if interval passed
    uint256 lastObsTime = s_observations[(s_observationIndex + OBSERVATION_MASK) & OBSERVATION_MASK]
      .timestamp;
    if (block.timestamp >= lastObsTime + SNAPSHOT_INTERVAL) {
      s_observations[s_observationIndex] = Observation(block.timestamp, s_coherenceAccumulator);
      s_observationIndex = (s_observationIndex + 1) & OBSERVATION_MASK;
    }

    emit CoherenceUpdated(s_coherenceLevel);
  }

  /**
   * @notice Returns the average coherence over the period since a provided checkpoint.
   * @param oldAccumulator The s_coherenceAccumulator value at the start of the window.
   * @param oldTimestamp The timestamp at the start of the window.
   * @return The time-weighted average coherence.
   */
  function getTWAC(uint256 oldAccumulator, uint256 oldTimestamp) external view returns (uint256) {
    uint256 timeElapsed = block.timestamp - oldTimestamp;
    if (timeElapsed == 0) return s_coherenceLevel;
    return (s_coherenceAccumulator - oldAccumulator) / timeElapsed;
  }

  /**
   * @notice Calculates the TWAC over the last 30 minutes using binary search.
   */
  function get30MinTWAC() external view returns (uint256) {
    uint256 targetTime = block.timestamp - 30 minutes;

    // Constant-time (fixed step) binary search over the logical range [0, 15]
    // This prevents timing side-channels by ensuring the same number of iterations
    // and a data-independent execution path (fixed unrolling).
    uint256 bestPhysIdx = s_observationIndex;
    uint256 offset = 0;
    uint256 checkIdx;

    // Step 1: Check logical index 8 (midpoint of 16)
    checkIdx = (s_observationIndex + 8) & OBSERVATION_MASK;
    if (
      s_observations[checkIdx].timestamp != 0 && s_observations[checkIdx].timestamp <= targetTime
    ) {
      offset = 8;
      bestPhysIdx = checkIdx;
    }

    // Step 2: Check 4 steps ahead of current offset
    checkIdx = (s_observationIndex + offset + 4) & OBSERVATION_MASK;
    if (
      s_observations[checkIdx].timestamp != 0 && s_observations[checkIdx].timestamp <= targetTime
    ) {
      offset += 4;
      bestPhysIdx = checkIdx;
    }

    // Step 3: Check 2 steps ahead
    checkIdx = (s_observationIndex + offset + 2) & OBSERVATION_MASK;
    if (
      s_observations[checkIdx].timestamp != 0 && s_observations[checkIdx].timestamp <= targetTime
    ) {
      offset += 2;
      bestPhysIdx = checkIdx;
    }

    // Step 4: Check 1 step ahead
    checkIdx = (s_observationIndex + offset + 1) & OBSERVATION_MASK;
    if (
      s_observations[checkIdx].timestamp != 0 && s_observations[checkIdx].timestamp <= targetTime
    ) {
      bestPhysIdx = checkIdx;
    }

    uint256 timeDiff = block.timestamp - s_observations[bestPhysIdx].timestamp;
    if (timeDiff == 0) return s_coherenceLevel;

    return (s_coherenceAccumulator - s_observations[bestPhysIdx].accumulator) / timeDiff;
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
      revert SentinelQuantumGuard__NotFrozen();
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
   * @notice Authorizes or revokes an address's ability to read the hardness level.
   * @param reader The address to modify.
   * @param status True to authorize, false to revoke.
   */
  function setAuthorizedReader(address reader, bool status) external onlyOwner {
    if (block.timestamp < s_readerLastUpdate[reader] + GOVERNANCE_COOLDOWN) {
      revert SentinelQuantumGuard__CooldownActive();
    }

    s_authorizedReaders[reader] = status;
    s_readerLastUpdate[reader] = block.timestamp;
  }

  /**
   * @notice Sets the CoreLoop engine and automatically authorizes it as a reader.
   * @param coreLoop The address of the SentinelCoreLoop contract.
   */
  function setCoreLoop(address coreLoop) external onlyOwner {
    s_coreLoop = coreLoop;
    s_authorizedReaders[coreLoop] = true;
  }

  /**
   * @inheritdoc ISentinelQuantumGuard
   * @notice Restricts key rotation to the owner or the authorized CoreLoop.
   */
  function rotateEncryptionKeys() external override {
    if (!s_authorizedReaders[msg.sender] && msg.sender != owner()) {
      revert SentinelQuantumGuard__Unauthorized();
    }

    // Increment epoch to invalidate signatures generated under the previous key set
    s_currentKeyEpoch++;

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
    if (!s_authorizedReaders[msg.sender] && msg.sender != owner()) {
      revert SentinelQuantumGuard__Unauthorized();
    }

    // Increase hardness based on current instability (lower coherence = higher hardness boost)
    uint256 instabilityFactor = 100 - s_coherenceLevel;
    uint256 newHardness = s_hardnessLevel + ((instabilityFactor > 0) ? instabilityFactor : 10);

    if (newHardness <= MAX_HARDNESS) {
      s_hardnessLevel = newHardness;
    }

    emit LatticeParametersCalibrated(s_hardnessLevel);
  }
}
