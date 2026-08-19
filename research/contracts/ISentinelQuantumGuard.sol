// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ISentinelQuantumGuard
 * @dev Interface for the Quantum-Resistant Security Layer.
 * Handles lattice-based parameter calibration and rotation of quantum-safe keys.
 */
interface ISentinelQuantumGuard {
  /**
   * @notice Emitted when the Dilithium/Falcon keys are rotated.
   */
  event EncryptionKeysRotated(uint256 timestamp);

  /**
   * @notice Emitted when lattice parameters are recalibrated.
   * @param newHardnessLevel The new security parameter for the lattice scheme.
   */
  event LatticeParametersCalibrated(uint256 newHardnessLevel);

  /**
   * @notice Emitted when the coherence level is updated.
   * @param newCoherenceLevel The new coherence level (0-100).
   */
  event CoherenceUpdated(uint256 newCoherenceLevel);

  /**
   * @notice Emitted when the heartbeat threshold is updated.
   * @param newHeartbeat The new heartbeat duration in seconds.
   */
  event HeartbeatUpdated(uint256 newHeartbeat);

  /**
   * @notice Emitted when the guard enters an emergency freeze state.
   */
  event EmergencyFreezeOccurred(uint256 timestamp);

  /**
   * @notice Emitted when the guard is unfrozen by the admin.
   */
  event EmergencyUnfreezeOccurred(uint256 timestamp);

  /**
   * @notice Returns the current coherence level of the quantum state (0-100).
   */
  function getCoherenceLevel() external view returns (uint256);

  /**
   * @notice Returns true if the guard is in an emergency freeze state.
   */
  function isFrozen() external view returns (bool);

  /**
   * @notice Rotates the underlying Dilithium/Falcon encryption keys.
   * Called during threat interception to neutralize potential side-channel attacks.
   */
  function rotateEncryptionKeys() external;

  /**
   * @notice Calibrates lattice parameters based on the latest entropy seeds.
   * Adjusts the hardness level for lattice-based signature schemes to maintain
   * resistance against evolving quantum heuristics.
   */
  function calibrateLatticeParameters() external;

  /**
   * @notice Returns the current hardness level of the lattice.
   * @dev Restrictable to authorized system components.
   */
  function getHardnessLevel() external view returns (uint256);

  /**
   * @notice Returns the timestamp of the last successful lattice calibration.
   */
  function lastCalibration() external view returns (uint256);
}
