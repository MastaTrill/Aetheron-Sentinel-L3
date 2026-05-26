// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from 'forge-std/Test.sol';
import { SentinelCoreLoop } from '../SentinelCoreLoop.sol';
import { SentinelQuantumGuard } from '../SentinelQuantumGuard.sol';
import { MockV3Aggregator } from '../MockV3Aggregator.sol';

contract SentinelCoreLoopTest is Test {
  SentinelCoreLoop public coreLoop;
  SentinelQuantumGuard public quantumGuard;
  MockV3Aggregator public mockFeed;

  address public owner = address(0xDEADBEEF);
  uint256 public constant INITIAL_HARDNESS = 12;

  function setUp() public {
    vm.startPrank(owner);

    // 100% coherence (8 decimals)
    mockFeed = new MockV3Aggregator(100 * 1e8);
    quantumGuard = new SentinelQuantumGuard(INITIAL_HARDNESS, address(mockFeed));

    coreLoop = new SentinelCoreLoop(owner);
    coreLoop.initializeCoreComponents(address(quantumGuard));

    vm.stopPrank();
  }

  function test_ExecuteThreatResponse_RevertsWhenFrozen() public {
    // 1. Simulate passage of time beyond emergency threshold (24 hours)
    vm.warp(block.timestamp + 25 hours);

    // 2. Trigger oracle update which will detect staleness and freeze the guard
    quantumGuard.updateCoherenceFromOracle();
    assertTrue(quantumGuard.isFrozen());

    // 3. Attempting a threat response through CoreLoop should now revert
    vm.prank(owner);
    vm.expectRevert(SentinelCoreLoop.SentinelCoreLoop__QuantumGuardFrozen.selector);
    coreLoop.executeThreatResponse(keccak256('EXTERNAL_EXPLOIT_DETECTED'));
  }

  function test_TriggerQuantumKeyRotation_Success() public {
    vm.startPrank(owner);

    // Verify the call propagates successfully to the guard
    // (Checks for EncryptionKeysRotated event emission)
    vm.expectEmit(true, false, false, true, address(quantumGuard));
    emit SentinelQuantumGuard.EncryptionKeysRotated(block.timestamp);
    coreLoop.triggerQuantumKeyRotation();
  }

  function test_AutonomousCalibrationTrigger() public {
    vm.startPrank(owner);

    // Threshold is 10. Sliding window triggers when the 11th call wraps the 10-slot buffer
    for (uint256 i = 0; i < 10; i++) {
      coreLoop.executeThreatResponse(keccak256(abi.encode(i)));
    }
    assertEq(coreLoop.s_anomalyCount(), 10);

    // The 10th anomaly should trigger autonomous calibration
    vm.expectEmit(true, false, false, true, address(quantumGuard));
    emit SentinelQuantumGuard.LatticeParametersCalibrated(INITIAL_HARDNESS);

    vm.expectEmit(true, false, false, true, address(coreLoop));
    emit SentinelCoreLoop.HighThreatCalibrationTriggered(10);

    coreLoop.executeThreatResponse(keccak256('FINAL_THREAT'));
    assertEq(coreLoop.s_anomalyCount(), 0); // Count resets after calibration
    vm.stopPrank();
  }

  function test_SlidingWindow_FrequencyEnforcement() public {
    vm.startPrank(owner);
    // Window is 1 hour. Spread 11 threats 2 hours apart.
    for (uint256 i = 0; i < 11; i++) {
      vm.warp(block.timestamp + 2 hours);
      coreLoop.executeThreatResponse(keccak256(abi.encode(i)));
    }

    // Delta (2h) > Window (1h). No trigger should have occurred.
    assertEq(coreLoop.s_anomalyCount(), 11);
    vm.stopPrank();
  }

  function test_DynamicWindowShrinking() public {
    vm.startPrank(owner);
    uint256 initialWindow = coreLoop.s_anomalyWindow();

    // Fire 11 threats instantly to trigger a burst calibration
    for (uint256 i = 0; i < 11; i++) {
      coreLoop.executeThreatResponse(keccak256(abi.encode(i)));
    }

    // Verify the window shrunk by 25% (0.75 multiplier)
    assertEq(coreLoop.s_anomalyWindow(), (initialWindow * 75) / 100);
    vm.stopPrank();
  }
}
