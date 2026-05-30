// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ISentinelQuantumGuard } from './ISentinelQuantumGuard.sol';
import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title SentinelCoreLoop
 * @dev Central coordination engine for Aetheron Sentinel.
 * Orchestrates threat detection and automated responses across the L3 infrastructure.
 */
contract SentinelCoreLoop is Ownable {
  ISentinelQuantumGuard public s_quantumGuard;
  uint256 public s_anomalyCount;
  uint256 public s_highThreatAnomalyThreshold;
  uint256 public s_anomalyWindow;
  uint256 public s_minAnomalyWindow;
  uint256 public s_maxAnomalyWindow;
  uint256[] private s_anomalyTimestamps;
  uint256 private s_anomalyPointer;
  bool public s_coreComponentsBootstrapped;

  event HighThreatCalibrationTriggered(uint256 finalAnomalyCount);
  event HighThreatThresholdUpdated(uint256 newThreshold);

  error SentinelCoreLoop__QuantumGuardFrozen();
  error SentinelCoreLoop__AlreadyBootstrapped();
  error SentinelCoreLoop__NotBootstrapped();
  error SentinelCoreLoop__InvalidComponent();

  constructor(address initialOwner) Ownable(initialOwner) {
    s_highThreatAnomalyThreshold = 10; // Default threshold based on MAINNET_CONFIG_GUIDE
    s_anomalyWindow = 1 hours;
    s_maxAnomalyWindow = 1 hours;
    s_minAnomalyWindow = 5 minutes;
    s_anomalyTimestamps = new uint256[](10);
  }

  /**
   * @notice Atomically initializes core system components.
   * @dev Resolves the coreloop-bootstrap-deadlock issue.
   * @param quantumGuard The address of the deployed SentinelQuantumGuard.
   */
  function initializeCoreComponents(address quantumGuard) external onlyOwner {
    if (s_coreComponentsBootstrapped) revert SentinelCoreLoop__AlreadyBootstrapped();
    if (quantumGuard == address(0)) revert SentinelCoreLoop__InvalidComponent();

    s_quantumGuard = ISentinelQuantumGuard(quantumGuard);
    s_anomalyTimestamps = new uint256[](s_highThreatAnomalyThreshold);
    s_coreComponentsBootstrapped = true;
  }

  /**
   * @notice Manually updates a system component after bootstrapping.
   * @param component The address of the new component.
   */
  function setSystemComponent(address component) external onlyOwner {
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();
    if (component == address(0)) revert SentinelCoreLoop__InvalidComponent();

    // For this specific update, we wire the Quantum Guard
    s_quantumGuard = ISentinelQuantumGuard(component);
  }

  /**
   * @notice Updates the anomaly threshold required to trigger autonomous calibration.
   * @param newThreshold The number of anomalies before high-threat logic kicks in.
   */
  function setHighThreatThreshold(uint256 newThreshold) external onlyOwner {
    if (newThreshold == 0) revert SentinelCoreLoop__InvalidComponent();
    s_highThreatAnomalyThreshold = newThreshold;
    s_anomalyTimestamps = new uint256[](newThreshold);
    s_anomalyPointer = 0;
    emit HighThreatThresholdUpdated(newThreshold);
  }

  /**
   * @notice Updates the period required for one anomaly to decay.
   * @param newDecayPeriod The duration in seconds.
   */
  function setAnomalyDecayPeriod(uint256 newDecayPeriod) external onlyOwner {
    s_anomalyWindow = newDecayPeriod;
    s_maxAnomalyWindow = newDecayPeriod;
  }

  /**
   * @notice Manually resets the anomaly counter.
   */
  function resetAnomalyCount() external onlyOwner {
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();
    s_anomalyCount = 0;
    delete s_anomalyTimestamps;
    s_anomalyTimestamps = new uint256[](s_highThreatAnomalyThreshold);
    s_anomalyPointer = 0;
  }

  /**
   * @notice Triggers a key rotation on the Quantum Guard.
   * @dev Called when an anomaly is detected to refresh post-quantum security parameters.
   */
  function triggerQuantumKeyRotation() external onlyOwner {
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();
    s_quantumGuard.rotateEncryptionKeys();
  }

  /**
   * @notice Forces a lattice parameter calibration on the Quantum Guard.
   * @dev Used during high-threat scenarios to increase the security hardness.
   */
  function forceQuantumCalibration() external onlyOwner {
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();
    s_quantumGuard.calibrateLatticeParameters();
  }

  /**
   * @notice Executes an automated threat response.
   * @dev Before executing any logic, it verifies the Quantum Guard is not frozen.
   */
  function executeThreatResponse(bytes32 threatId) external onlyOwner {
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();

    // Security check: Verify the Quantum-Resistant layer is not in an emergency freeze.
    // This prevents the loop from performing actions based on potentially compromised
    // or stale oracle data.
    if (address(s_quantumGuard) != address(0) && s_quantumGuard.isFrozen()) {
      revert SentinelCoreLoop__QuantumGuardFrozen();
    }

    // Sliding Window Anomaly Detection
    uint256 currentTimestamp = block.timestamp;
    uint256 oldestTimestamp = s_anomalyTimestamps[s_anomalyPointer];

    s_anomalyTimestamps[s_anomalyPointer] = currentTimestamp;
    s_anomalyPointer = (s_anomalyPointer + 1) % s_highThreatAnomalyThreshold;
    s_anomalyCount++;

    // If the window is full and the first anomaly happened within the window duration
    if (oldestTimestamp != 0 && currentTimestamp - oldestTimestamp <= s_anomalyWindow) {
      // Dynamic Window Shrink: Reduce window by 25% to increase sensitivity during volatility
      uint256 shrunkWindow = (s_anomalyWindow * 75) / 100;
      s_anomalyWindow = shrunkWindow < s_minAnomalyWindow ? s_minAnomalyWindow : shrunkWindow;

      s_quantumGuard.calibrateLatticeParameters();
      emit HighThreatCalibrationTriggered(s_anomalyCount);
      s_anomalyCount = 0;
      delete s_anomalyTimestamps;
      s_anomalyTimestamps = new uint256[](s_highThreatAnomalyThreshold);
      s_anomalyPointer = 0;
    }
    // Gradual Expansion: Relax the window back towards s_maxAnomalyWindow if volatility drops
    else if (oldestTimestamp != 0 && currentTimestamp - oldestTimestamp > s_anomalyWindow) {
      if (s_anomalyWindow < s_maxAnomalyWindow) {
        uint256 relaxedWindow = (s_anomalyWindow * 110) / 100;
        s_anomalyWindow = relaxedWindow > s_maxAnomalyWindow ? s_maxAnomalyWindow : relaxedWindow;
      }
    }

    // Proceed with threat response logic (e.g., notifying the Bridge or CircuitBreaker)
    _mitigateThreat(threatId);
  }

  function _mitigateThreat(bytes32 threatId) internal {
    // Logic for interacting with SentinelInterceptor and AetheronBridge
  }
}
