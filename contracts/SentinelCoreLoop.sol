// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ISentinelQuantumGuard } from '../ISentinelQuantumGuard.sol';
import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';
import { ReentrancyGuard } from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/**
 * @dev Interface for the AI-powered Yield Maximizer component.
 * Handles portfolio optimization and predictive yield adjustments.
 */
interface ISentinelYieldMaximizer {
  function executeOptimization() external;
}

/**
 * @title SentinelCoreLoop
 * @dev Central coordination engine for Aetheron Sentinel.
 * Orchestrates threat detection and automated responses across the L3 infrastructure.
 */
contract SentinelCoreLoop is Ownable, ReentrancyGuard {
  ISentinelQuantumGuard public s_quantumGuard;
  ISentinelYieldMaximizer public s_yieldMaximizer;
  bool public s_coreComponentsBootstrapped;
  uint32 public s_anomalyCount; // Packed into Slot 2
  uint32 public s_highThreatAnomalyThreshold; // Packed into Slot 2
  uint32 private s_anomalyPointer; // Packed into Slot 2
  uint64 private s_windowStartTimestamp; // Packed into Slot 2
  // Slot 2: 4+4+4+8+1 = 21 bytes used. 11 bytes free.
  uint64 public s_anomalyWindow; // Packed into Slot 3 (uint64)
  uint64 public s_minAnomalyWindow; // Packed into Slot 3 (uint64)
  uint64 public s_maxAnomalyWindow; // Packed into Slot 3 (uint64)
  uint256 public constant OBSERVATION_SIZE = 16;
  uint256 public constant OBSERVATION_MASK = 15;
  uint256[OBSERVATION_SIZE] private s_anomalyTimestamps;
  uint64 public s_calibrationInterval; // Packed into Slot 3 (uint64)
  // Slot 3: 8+8+8+8 = 32 bytes used. Slot 3 fully packed.
  uint64 public lastSecurityAudit; // Slot 4 (uint64)
  mapping(address => bool) public s_monitors;
  mapping(address => bool) public s_keepers;

  event HighThreatCalibrationTriggered(uint256 finalAnomalyCount);
  event HighThreatThresholdUpdated(uint256 newThreshold);
  event MonitorStatusUpdated(address indexed monitor, bool status);
  event KeeperStatusUpdated(address indexed keeper, bool status);
  event ThreatMitigated(bytes32 indexed threatId, uint256 timestamp);
  event CalibrationIntervalUpdated(uint256 newInterval);
  event ComponentExecutionFailed(address indexed component);
  event TelemetryReset(uint256 timestamp);

  error SentinelCoreLoop__QuantumGuardFrozen();
  error SentinelCoreLoop__AlreadyBootstrapped();
  error SentinelCoreLoop__NotBootstrapped();
  error SentinelCoreLoop__InvalidComponent();
  error SentinelCoreLoop__UnauthorizedMonitor();
  error SentinelCoreLoop__UnauthorizedKeeper();

  constructor(address initialOwner) Ownable(initialOwner) {
    s_highThreatAnomalyThreshold = 16; // Default to max buffer size for bitwise efficiency
    s_anomalyWindow = 30 minutes;
    s_maxAnomalyWindow = 1 hours;
    s_minAnomalyWindow = 5 minutes;
    s_calibrationInterval = 24 hours;
  }

  /**
   * @notice Atomically initializes core system components.
   * @dev Resolves the coreloop-bootstrap-deadlock issue.
   * @param quantumGuard The address of the deployed SentinelQuantumGuard.
   * @param yieldMaximizer The address of the deployed SentinelYieldMaximizer.
   */
  function initializeCoreComponents(address quantumGuard, address yieldMaximizer) external onlyOwner {
    if (s_coreComponentsBootstrapped) revert SentinelCoreLoop__AlreadyBootstrapped();
    if (quantumGuard == address(0) || yieldMaximizer == address(0)) revert SentinelCoreLoop__InvalidComponent();

    s_quantumGuard = ISentinelQuantumGuard(quantumGuard);
    s_yieldMaximizer = ISentinelYieldMaximizer(yieldMaximizer);
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
   * @notice Updates the Yield Maximizer component after bootstrapping.
   * @param yieldMaximizer The address of the new SentinelYieldMaximizer.
   */
  function setYieldMaximizer(address yieldMaximizer) external onlyOwner {
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();
    if (yieldMaximizer == address(0)) revert SentinelCoreLoop__InvalidComponent();

    s_yieldMaximizer = ISentinelYieldMaximizer(yieldMaximizer);
  }

  /**
   * @notice Atomically updates both core components to prevent logical race conditions.
   * @dev Optimizes gas for Multisig owners by grouping updates into a single transaction.
   */
  function reconfigureComponents(address quantumGuard, address yieldMaximizer) external onlyOwner {
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();
    if (quantumGuard == address(0) || yieldMaximizer == address(0)) revert SentinelCoreLoop__InvalidComponent();

    s_quantumGuard = ISentinelQuantumGuard(quantumGuard);
    s_yieldMaximizer = ISentinelYieldMaximizer(yieldMaximizer);

    // Reset telemetry to ensure new components start with a clean security state
    _resetAnomalyCount();
  }

  /**
   * @notice Updates the anomaly threshold required to trigger autonomous calibration.
   * @param newThreshold The number of anomalies before high-threat logic kicks in.
   */
  function setHighThreatThreshold(uint32 newThreshold) external onlyOwner { // newThreshold is already uint32
    if (newThreshold == 0 || newThreshold > OBSERVATION_SIZE)
      revert SentinelCoreLoop__InvalidComponent();

    _resetAnomalyCount();
    s_highThreatAnomalyThreshold = newThreshold;
    emit HighThreatThresholdUpdated(newThreshold);
  }

  /**
   * @notice Updates the period required for one anomaly to decay.
   * @param newDecayPeriod The duration in seconds.
   */
  function setAnomalyDecayPeriod(uint64 newDecayPeriod) external onlyOwner {
    s_anomalyWindow = newDecayPeriod; // newDecayPeriod is uint64
    s_maxAnomalyWindow = newDecayPeriod; // newDecayPeriod is uint64
  }

  /**
   * @notice Authorizes or revokes a monitor's ability to execute threat responses.
   * @param monitor The address of the monitoring bot or service.
   * @param status True to authorize, false to revoke.
   */
  function setMonitor(address monitor, bool status) external onlyOwner {
    s_monitors[monitor] = status;
    emit MonitorStatusUpdated(monitor, status);
  }

  /**
   * @notice Authorizes or revokes a keeper's ability to execute the core loop.
   * @param keeper The address of the keeper bot or service.
   * @param status True to authorize, false to revoke.
   */
  function setKeeper(address keeper, bool status) external onlyOwner {
    s_keepers[keeper] = status;
    emit KeeperStatusUpdated(keeper, status);
  }

  /**
   * @notice Batch authorizes or revokes keepers to save gas.
   * @param keepers The array of keeper addresses.
   * @param status True to authorize, false to revoke.
   */
  function setKeepers(address[] calldata keepers, bool status) external onlyOwner {
    for (uint256 i = 0; i < keepers.length; ++i) {
      s_keepers[keepers[i]] = status;
      emit KeeperStatusUpdated(keepers[i], status);
    }
  }

  /**
   * @notice Batch authorizes or revokes monitors to save gas when managing multiple bots.
   * @param monitors The array of monitor addresses.
   * @param status True to authorize, false to revoke.
   */
  function setMonitors(address[] calldata monitors, bool status) external onlyOwner {
    for (uint256 i = 0; i < monitors.length; ++i) {
      s_monitors[monitors[i]] = status;
      emit MonitorStatusUpdated(monitors[i], status);
    }
  }

  /**
   * @notice Updates the interval between scheduled quantum calibrations.
   * @param newInterval The new interval in seconds.
   */
  function setCalibrationInterval(uint64 newInterval) external onlyOwner {
    s_calibrationInterval = newInterval;
    emit CalibrationIntervalUpdated(newInterval);
  }

  /**
   * @notice Manually resets the anomaly counter.
   */
  function resetAnomalyCount() external onlyOwner {
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();
    _resetAnomalyCount();
    emit TelemetryReset(block.timestamp);
  }

  function _resetAnomalyCount() internal {
    s_anomalyCount = 0;
    s_windowStartTimestamp = uint64(block.timestamp);
    s_anomalyPointer = 0;
    delete s_anomalyTimestamps;
  }

  /**
   * @notice Triggers a key rotation on the Quantum Guard.
   * @dev Called when an anomaly is detected to refresh post-quantum security parameters.
   */
  function triggerQuantumKeyRotation() external onlyOwner nonReentrant {
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();
    try s_quantumGuard.rotateEncryptionKeys() {
      // Success
    } catch {
      emit ComponentExecutionFailed(address(s_quantumGuard));
    }
  }

  /**
   * @notice Forces a lattice parameter calibration on the Quantum Guard.
   * @dev Used during high-threat scenarios to increase the security hardness.
   */
  function forceQuantumCalibration() external onlyOwner nonReentrant {
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();
    try s_quantumGuard.calibrateLatticeParameters() {
      // Success
    } catch {
      emit ComponentExecutionFailed(address(s_quantumGuard));
    }
  }

  /**
   * @notice Top-level orchestration loop as defined in the Whitepaper.
   * @dev This should be called by an automated keeper or SentinelCore.
   */
  function executeCoreLoop() external nonReentrant {
    if (!s_keepers[msg.sender] && msg.sender != owner())
      revert SentinelCoreLoop__UnauthorizedKeeper();
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();

    // Active Window Expansion: Periodically relax sensitivity if no threats are being reported
    uint64 cWindow = s_anomalyWindow;
    if (cWindow < s_maxAnomalyWindow) {
      uint256 lastTrigger = s_windowStartTimestamp;
      if (block.timestamp - lastTrigger > cWindow) {
        unchecked {
          uint64 relaxed = cWindow + (cWindow >> 3);
          s_anomalyWindow = relaxed > s_maxAnomalyWindow ? s_maxAnomalyWindow : relaxed;
        }
        s_windowStartTimestamp = uint64(block.timestamp);
      }
    }

    // Phase 4: Yield Optimization
    // Only optimize if system is in a stable security state (maximum window)
    if (s_anomalyWindow == s_maxAnomalyWindow) {
        _executeYieldOptimization();
    }

    // Phase 6: Quantum Calibration
    address guardAddr = address(s_quantumGuard);
    assembly {
      // s_calibrationInterval is the 4th uint64 in Slot 3 (bits 192-255)
      let slot3Val := sload(3)
      let calibInterval := and(shr(192, slot3Val), 0xffffffffffffffff)

      // --- Check if calibration is due ---
      // Selector for lastCalibration()
      mstore(0x00, shl(224, 0x582496d6)) // 0x582496d6 is lastCalibration() selector

      // staticcall(gas, address, argsOffset, argsSize, retOffset, retSize)
      // Call lastCalibration()
      let successStaticCall := staticcall(gas(), guardAddr, 0x00, 0x04, 0x00, 0x20) // returns uint256

      let lastCalibTimestamp := 0
      if eq(successStaticCall, 1) { // If staticcall succeeded
        lastCalibTimestamp := mload(0x00) // Load returned timestamp
      }

      // Check if calibration is due: block.timestamp >= lastCalibTimestamp + calibInterval
      let shouldCalibrate := 0
      if iszero(lt(timestamp(), add(lastCalibTimestamp, calibInterval))) {
        shouldCalibrate := 1
      }

      // --- Perform calibration if due ---
      if eq(shouldCalibrate, 1) {
        // Selector for calibrateLatticeParameters()
        mstore(0x00, shl(224, 0x11166624)) // 0x11166624 is calibrateLatticeParameters() selector

        // Call calibrateLatticeParameters()
        // call(gas, address, value, argsOffset, argsSize, retOffset, retSize)
        let calibSuccess := call(gas(), guardAddr, 0, 0x00, 0x04, 0x00, 0x00) // No return value expected

        if eq(calibSuccess, 0) { // If calibration call failed
          // Emit ComponentExecutionFailed(address(guard))
          // keccak256("ComponentExecutionFailed(address)")
          let eventSig := 0x0f279f5370d03222851419793132c3cbba966367373f7405ba0788647ba78028
          // Address is indexed, so it's a topic (log2)
          // log2(offset, size, topic1, topic2)
          log2(0, 0, eventSig, guardAddr)
        }
      }
    }

    // Phase 7: Metrics Update
    emit CoreLoopExecuted(block.timestamp);
  }

  function _quantumGuardFrozen() internal view returns (bool frozen) {
    try s_quantumGuard.isFrozen() returns (bool _frozen) {
      return _frozen;
    } catch {
      return true;
    }
  }

  function _recordAnomaly(uint256 currentTimestamp) internal returns (bool highThreat) {
    uint64 oldestTimestamp;
    uint32 currentCount;
    uint32 currentThreshold;
    uint256 pointer;
    uint256 windowStart;
    uint256 bootstrapped;

    assembly {
      let slot2Val := sload(2)
      currentCount := and(slot2Val, 0xffffffff)
      currentThreshold := and(shr(32, slot2Val), 0xffffffff)
      pointer := and(shr(64, slot2Val), 0xffffffff)
      windowStart := and(shr(96, slot2Val), 0xffffffffffffffff)
      bootstrapped := and(shr(160, slot2Val), 0xff)

      let lookbackIndex := and(sub(pointer, currentThreshold), 15)
      oldestTimestamp := sload(add(s_anomalyTimestamps.slot, lookbackIndex))
      if lt(oldestTimestamp, windowStart) { oldestTimestamp := 0 }
      sstore(add(s_anomalyTimestamps.slot, pointer), currentTimestamp)
    }

    uint256 newCount;
    uint256 newPointer;
    uint256 newWindowStart;
    uint256 ageSinceOldest = oldestTimestamp == 0 || currentTimestamp < oldestTimestamp
      ? 0
      : currentTimestamp - oldestTimestamp;
    uint256 ref = oldestTimestamp == 0 ? windowStart : uint256(oldestTimestamp);
    uint256 ageSinceWindow = ref == 0 || currentTimestamp < ref ? 0 : currentTimestamp - ref;

    if (ageSinceOldest <= s_anomalyWindow) {
      highThreat = true;
      uint64 shrunkWindow;
      unchecked { shrunkWindow = (s_anomalyWindow >> 1) + (s_anomalyWindow >> 2); }
      s_anomalyWindow = shrunkWindow < s_minAnomalyWindow ? s_minAnomalyWindow : shrunkWindow;
      newCount = 0;
      newPointer = 0;
      newWindowStart = currentTimestamp;
    } else {
      newCount = currentCount < 16 ? currentCount + 1 : 16;
      newPointer = (pointer + 1) & 15;
      newWindowStart = windowStart;

      if (ageSinceWindow > s_anomalyWindow) {
        if (s_anomalyWindow < s_maxAnomalyWindow) {
          uint64 relaxed;
          unchecked { relaxed = s_anomalyWindow + (s_anomalyWindow >> 3); }
          s_anomalyWindow = relaxed > s_maxAnomalyWindow ? s_maxAnomalyWindow : relaxed;
        }
      }
    }

    assembly {
      let newVal := or(newCount, shl(32, currentThreshold))
      newVal := or(newVal, shl(64, newPointer))
      newVal := or(newVal, shl(96, newWindowStart))
      newVal := or(newVal, shl(160, bootstrapped))
      sstore(2, newVal)
    }
  }

  /**
   * @notice Executes an automated threat response.
   * @dev Accessible by authorized monitors or the owner.
   */
  function executeThreatResponse(bytes32 threatId) external nonReentrant {
    if (!s_monitors[msg.sender] && msg.sender != owner())
      revert SentinelCoreLoop__UnauthorizedMonitor();
    if (!s_coreComponentsBootstrapped) revert SentinelCoreLoop__NotBootstrapped();

    // Security check: Verify the Quantum-Resistant layer is not in an emergency freeze.
    // This prevents the loop from performing actions based on potentially compromised
    // or stale oracle data.
    if (_quantumGuardFrozen()) revert SentinelCoreLoop__QuantumGuardFrozen();

    bool highThreat = _recordAnomaly(block.timestamp);

    if (highThreat) {
      try s_quantumGuard.calibrateLatticeParameters() {} catch {
        emit ComponentExecutionFailed(address(s_quantumGuard));
      }
      emit HighThreatCalibrationTriggered(s_anomalyCount);
    }

    _mitigateThreat(threatId);
  }

  /**
   * @dev Internal Phase 4 logic: Triggers the AI-driven optimization engine.
   */
  function _executeYieldOptimization() internal {
    // Security: Cap gas for yield optimization to prevent siphoning
    try s_yieldMaximizer.executeOptimization{gas: 1_000_000}() {
      // Yield optimization successful
    } catch {
      // Log failure to core metrics for monitoring
      emit ComponentExecutionFailed(address(s_yieldMaximizer));
    }
  }

  function _mitigateThreat(bytes32 threatId) internal {
    // Notification hook for cross-chain security mesh
    emit ThreatMitigated(threatId, block.timestamp);
  }

  event CoreLoopExecuted(uint256 timestamp);
}
