// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/SentinelInterceptor.sol";
import "../contracts/mocks/MockBridge.sol";

contract SentinelInterceptorTest is Test {
    SentinelInterceptor public sentinel;
    MockBridge public mockBridge;

    address public owner = makeAddr("owner");
    address public oracle = makeAddr("oracle");
    address public sentinelRole = makeAddr("sentinel");
    address public attacker = makeAddr("attacker");

    event AnomalyDetected(
        uint256 tvlPercentage,
        uint256 threshold,
        uint256 timestamp,
        string detectionMethod
    );
    event AutonomousPauseTriggered(
        address indexed trigger,
        uint256 tvlAtPause,
        uint256 duration
    );

    function setUp() public {
        vm.prank(owner);
        mockBridge = new MockBridge();

        sentinel = new SentinelInterceptor(address(mockBridge), owner);

        // Grant roles (owner already has ORACLE_ROLE from constructor)
        vm.prank(owner);
        sentinel.grantRole(sentinel.SENTINEL_ROLE(), sentinelRole);

        // Set initial TVL
        vm.prank(owner);
        sentinel.updateTVL(1_000_000e18);
    }

    function testDeployment() public view {
        assertEq(sentinel.bridgeAddress(), address(mockBridge));
        assertTrue(sentinel.autonomousMode());
        assertEq(sentinel.TVL_SPIKE_THRESHOLD(), 1520);
    }

    function testAutoPauseOnTVLSpike() public {
        // Report 15.2% TVL spike - should trigger pause
        vm.prank(oracle);
        vm.expectEmit();
        emit AutonomousPauseTriggered(
            address(sentinel),
            1_000_000e18,
            block.timestamp
        );
        sentinel.reportAnomaly(1520, 1_000_000e18);

        assertTrue(sentinel.paused());
    }

    function testAutoPauseOnHigherSpike() public {
        vm.prank(oracle);
        sentinel.reportAnomaly(2000, 1_000_000e18);

        assertTrue(sentinel.paused());
    }

    function testNoPauseBelowThreshold() public {
        vm.prank(oracle);
        sentinel.reportAnomaly(1000, 1_000_000e18);

        assertFalse(sentinel.paused());
    }

    function testManualPauseBySentinel() public {
        vm.prank(sentinelRole);
        sentinel.emergencyPause("Suspicious activity");

        assertTrue(sentinel.paused());
    }

    function testResumeBridge() public {
        // Pause first
        vm.prank(sentinelRole);
        sentinel.emergencyPause("Test");

        // Resume
        vm.prank(sentinelRole);
        sentinel.resumeBridge(900_000e18);

        assertFalse(sentinel.paused());
        assertEq(sentinel.totalValueLocked(), 900_000e18);
    }

    function testToggleAutonomousMode() public {
        vm.prank(owner);
        sentinel.setAutonomousMode(false);

        assertFalse(sentinel.autonomousMode());
    }

    function testNoAutoPauseWhenDisabled() public {
        vm.prank(owner);
        sentinel.setAutonomousMode(false);

        vm.prank(oracle);
        sentinel.reportAnomaly(2000, 1_000_000e18);

        assertFalse(sentinel.paused());
    }

    function testOnlyOracleCanReportAnomaly() public {
        vm.prank(attacker);
        vm.expectRevert();
        sentinel.reportAnomaly(2000, 1_000_000e18);
    }

    function testResponseMetrics() public view {
        (uint256 detection, uint256 execution, uint256 total) = sentinel
            .getResponseMetrics();
        assertEq(detection, 4);
        assertEq(execution, 10);
        assertEq(total, 14);
    }

    function testSecurityStatus() public view {
        (bool isPaused, uint256 tvl, bool isAutonomous) = sentinel
            .getSecurityStatus();
        assertFalse(isPaused);
        assertEq(tvl, 1_000_000e18);
        assertTrue(isAutonomous);
    }

    function testTVLUpdate() public {
        vm.prank(oracle);
        sentinel.updateTVL(1_500_000e18);

        assertEq(sentinel.totalValueLocked(), 1_500_000e18);
    }

    function testStatisticalAnomalyDetection() public {
        // Test z-score based detection (z-score * 100 = 350 for 3.5 sigma)
        vm.prank(oracle);
        vm.expectEmit();
        emit AnomalyDetected(350, 1520, block.timestamp, "statistical_analysis");
        sentinel.reportAnomaly(350, 1_000_000e18);

        assertTrue(sentinel.paused());
    }

    function testCLARITYActCompliance() public {
        // Test that statistical analysis triggers pause for CLARITY Act compliance
        vm.prank(oracle);
        sentinel.reportAnomaly(400, 900_000e18); // z-score = 4.0

        assertTrue(sentinel.paused());
        assertTrue(mockBridge.paused());
    }
}
