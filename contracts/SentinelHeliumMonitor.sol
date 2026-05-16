// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title SentinelHeliumMonitor
 * @notice IoT device security monitoring using Helium network
 * Validates device authenticity and monitors network health
 */
contract SentinelHeliumMonitor is Ownable {
  // Helium network parameters
  uint256 public constant MIN_SIGNAL_STRENGTH = 20; // dBm
  uint256 public constant MAX_LATENCY = 5000; // ms
  uint256 public constant MIN_UPTIME = 95; // %

  struct IoTDevice {
    bytes32 deviceId;
    address owner;
    uint256 signalStrength;
    uint256 latency;
    uint256 uptime;
    uint256 lastSeen;
    bool isActive;
    uint256 securityScore;
  }

  struct NetworkHealth {
    uint256 totalDevices;
    uint256 activeDevices;
    uint256 averageLatency;
    uint256 averageSignalStrength;
    uint256 networkUptime;
    uint256 lastUpdated;
  }

  mapping(bytes32 => IoTDevice) public devices;
  mapping(address => bytes32[]) public ownerDevices;

  NetworkHealth public networkHealth;

  event DeviceRegistered(bytes32 indexed deviceId, address indexed owner);
  event DeviceUpdate(bytes32 indexed deviceId, uint256 signalStrength, uint256 latency);
  event SecurityAlert(bytes32 indexed deviceId, string alertType, uint256 severity);
  event NetworkHealthUpdate(uint256 totalDevices, uint256 activeDevices, uint256 uptime);

  constructor() Ownable(msg.sender) {}

  /**
   * @notice Register IoT device with Helium network
   */
  function registerDevice(bytes32 deviceId, bytes memory heliumProof, bytes memory) external {
    require(devices[deviceId].deviceId == bytes32(0), 'Device already registered');

    // Verify Helium proof (simplified)
    require(_verifyHeliumProof(deviceId, heliumProof), 'Invalid Helium proof');

    devices[deviceId] = IoTDevice({
      deviceId: deviceId,
      owner: msg.sender,
      signalStrength: 0,
      latency: 0,
      uptime: 100,
      lastSeen: block.timestamp,
      isActive: true,
      securityScore: 50 // Initial neutral score
    });

    ownerDevices[msg.sender].push(deviceId);

    networkHealth.totalDevices++;
    _updateNetworkHealth();

    emit DeviceRegistered(deviceId, msg.sender);
  }

  /**
   * @notice Update device telemetry
   */
  function updateDeviceTelemetry(
    bytes32 deviceId,
    uint256 signalStrength,
    uint256 latency,
    bytes memory telemetryProof
  ) external {
    IoTDevice storage device = devices[deviceId];
    require(device.owner == msg.sender, 'Not device owner');
    require(device.isActive, 'Device not active');

    // Verify telemetry proof
    require(_verifyTelemetryProof(deviceId, telemetryProof), 'Invalid telemetry proof');

    device.signalStrength = signalStrength;
    device.latency = latency;
    device.lastSeen = block.timestamp;

    // Update security score
    device.securityScore = _calculateSecurityScore(signalStrength, latency);

    // Check for anomalies
    if (signalStrength < MIN_SIGNAL_STRENGTH) {
      emit SecurityAlert(deviceId, 'LowSignalStrength', 6);
    }
    if (latency > MAX_LATENCY) {
      emit SecurityAlert(deviceId, 'HighLatency', 7);
    }

    _updateNetworkHealth();

    emit DeviceUpdate(deviceId, signalStrength, latency);
  }

  /**
   * @notice Report device anomaly
   */
  function reportAnomaly(
    bytes32 deviceId,
    string calldata anomalyType,
    uint256 severity,
    bytes memory
  ) external {
    IoTDevice storage device = devices[deviceId];
    require(device.isActive, 'Device not active');

    // Validate reporter (could be oracle or other devices)
    require(_validateReporter(msg.sender), 'Unauthorized reporter');

    // Update device security score
    if (severity > 5) {
      device.securityScore = device.securityScore > 10 ? device.securityScore - 10 : 0;
    }

    emit SecurityAlert(deviceId, anomalyType, severity);

    _updateNetworkHealth();
  }

  /**
   * @notice Deactivate compromised device
   */
  function deactivateDevice(bytes32 deviceId) external {
    IoTDevice storage device = devices[deviceId];
    require(device.owner == msg.sender || msg.sender == owner(), 'Not authorized');

    device.isActive = false;
    networkHealth.activeDevices--;

    emit SecurityAlert(deviceId, 'DeviceDeactivated', 10);
  }

  /**
   * @notice Get device security status
   */
  function getDeviceStatus(
    bytes32 deviceId
  ) external view returns (bool isActive, uint256 securityScore, uint256 uptime, uint256 lastSeen) {
    IoTDevice memory device = devices[deviceId];
    return (device.isActive, device.securityScore, _calculateUptime(deviceId), device.lastSeen);
  }

  /**
   * @notice Get network health metrics
   */
  function getNetworkHealth()
    external
    view
    returns (
      uint256 totalDevices,
      uint256 activeDevices,
      uint256 averageLatency,
      uint256 networkUptime
    )
  {
    return (
      networkHealth.totalDevices,
      networkHealth.activeDevices,
      networkHealth.averageLatency,
      networkHealth.networkUptime
    );
  }

  /**
   * @dev Verify Helium network proof
   */
  function _verifyHeliumProof(bytes32, bytes memory proof) internal pure returns (bool) {
    // Simplified verification - would check against Helium API
    return proof.length > 0;
  }

  /**
   * @dev Verify telemetry proof
   */
  function _verifyTelemetryProof(bytes32, bytes memory proof) internal pure returns (bool) {
    // Simplified verification - would check cryptographic proof
    return proof.length > 0;
  }

  /**
   * @dev Validate anomaly reporter
   */
  function _validateReporter(address reporter) internal view returns (bool) {
    return authorizedReporters[reporter] || msg.sender == owner();
  }

  /**
   * @dev Calculate device security score
   */
  function _calculateSecurityScore(
    uint256 signalStrength,
    uint256 latency
  ) internal pure returns (uint256) {
    uint256 score = 50; // Base score

    // Signal strength bonus/penalty
    if (signalStrength > 40) score += 20;
    else if (signalStrength < 20) score -= 20;

    // Latency bonus/penalty
    if (latency < 100) score += 15;
    else if (latency > 1000) score -= 15;

    // Clamp to 0-100
    if (score > 100) score = 100;

    return score;
  }

  /**
   * @dev Calculate device uptime
   */
  function _calculateUptime(bytes32 deviceId) internal view returns (uint256) {
    IoTDevice memory device = devices[deviceId];
    if (!device.isActive) return 0;

    uint256 timeSinceLastSeen = block.timestamp - device.lastSeen;
    if (timeSinceLastSeen > 86400) return 0; // No activity in 24h = 0 uptime

    // Simplified uptime calculation
    return 95; // Assume 95% uptime for active devices
  }

  /**
   * @dev Update network health metrics
   */
  function _updateNetworkHealth() internal {
    // Simplified network health calculation
    networkHealth.activeDevices = networkHealth.totalDevices; // Assume all active
    networkHealth.averageLatency = 150; // Mock average
    networkHealth.averageSignalStrength = 35; // Mock average
    networkHealth.networkUptime = 98; // Mock uptime
    networkHealth.lastUpdated = block.timestamp;

    emit NetworkHealthUpdate(
      networkHealth.totalDevices,
      networkHealth.activeDevices,
      networkHealth.networkUptime
    );
  }
}
