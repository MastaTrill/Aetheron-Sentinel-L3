// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/security/AnomalyDetectionOracle.sol";
import "../contracts/SentinelInterceptor.sol";
import "../contracts/mocks/MockBridge.sol";

contract AnomalyDetectionOracleTest is Test {
    AnomalyDetectionOracle public oracle;
    SentinelInterceptor public sentinel;
    MockBridge public mockBridge;

    address public owner = makeAddr("owner");
    address public reporter = makeAddr("reporter");
    address public admin = makeAddr("admin");

    event AnomalyReported(uint256 indexed id, AnomalyDetectionOracle.AnomalyType anomalyType, uint256 severity, uint256 confidence);
    event AnomalyProcessed(uint256 indexed id, bool actionTaken);

    function setUp() public {
        vm.prank(owner);
        mockBridge = new MockBridge();

        vm.prank(owner);
        sentinel = new SentinelInterceptor(address(mockBridge), owner);

        vm.prank(owner);
        oracle = new AnomalyDetectionOracle(address(sentinel));

        // Grant roles
        vm.prank(owner);
        oracle.grantRole(oracle.ADMIN_ROLE(), admin);

        vm.prank(admin);
        oracle.addReporter(reporter);

        // Grant ORACLE_ROLE to oracle on sentinel
        vm.prank(owner);
        sentinel.grantRole(sentinel.ORACLE_ROLE(), address(oracle));

        // Set initial TVL
        vm.prank(address(oracle)); // Oracle can update TVL? Wait, need to check
        // Actually, sentinel has updateTVL with ORACLE_ROLE
        vm.prank(address(oracle));
        sentinel.updateTVL(1_000_000e18);
    }

    function testDeployment() public view {
        assertEq(address(oracle.sentinel()), address(sentinel));
        assertTrue(oracle.hasRole(oracle.ADMIN_ROLE(), admin));
        assertTrue(oracle.hasRole(oracle.REPORTER_ROLE(), reporter));
    }

    function testReportAnomaly() public {
        vm.expectEmit();
        emit AnomalyReported(1, AnomalyDetectionOracle.AnomalyType.TVLSpike, 80, 90);

        vm.prank(reporter);
        oracle.reportAnomaly(AnomalyDetectionOracle.AnomalyType.TVLSpike, 80, 90, abi.encode(1600));

        (AnomalyDetectionOracle.AnomalyType aType, uint256 severity, uint256 confidence,, uint256 timestamp,, bool processed) = oracle.getReport(1);
        assertEq(uint256(aType), uint256(AnomalyDetectionOracle.AnomalyType.TVLSpike));
        assertEq(severity, 80);
        assertEq(confidence, 90);
        assertEq(timestamp, block.timestamp);
        assertFalse(processed);
    }

    function testAutoProcessHighSeverityAnomaly() public {
        // Report high severity TVL spike
        vm.prank(reporter);
        oracle.reportAnomaly(AnomalyDetectionOracle.AnomalyType.TVLSpike, 1600, 95, abi.encode(1600));

        // Should be processed and pause triggered
        (, , , , , , bool processed) = oracle.getReport(1);
        assertTrue(processed);
        assertTrue(sentinel.paused());
    }

    function testManualProcessAnomaly() public {
        // Report low severity anomaly
        vm.prank(reporter);
        oracle.reportAnomaly(AnomalyDetectionOracle.AnomalyType.UnusualActivity, 50, 80, abi.encode(500));

        // Should not be auto-processed
        (, , , , , , bool processed) = oracle.getReport(1);
        assertFalse(processed);

        // Manual process
        vm.prank(admin);
        oracle.processAnomaly(1);

        (, , , , , , bool processedAfter) = oracle.getReport(1);
        assertTrue(processedAfter);
    }

    function testUpdateThreshold() public {
        vm.prank(admin);
        oracle.updateThreshold(AnomalyDetectionOracle.AnomalyType.TVLSpike, 2000);

        assertEq(oracle.anomalyThresholds(AnomalyDetectionOracle.AnomalyType.TVLSpike), 2000);
    }

    function testOnlyReporterCanReport() public {
        vm.prank(makeAddr("attacker"));
        vm.expectRevert();
        oracle.reportAnomaly(AnomalyDetectionOracle.AnomalyType.TVLSpike, 80, 90, "");
    }

    function testOnlyAdminCanUpdateThreshold() public {
        vm.prank(reporter);
        vm.expectRevert();
        oracle.updateThreshold(AnomalyDetectionOracle.AnomalyType.TVLSpike, 2000);
    }

    function testGetCurrentTVL() public view {
        assertEq(oracle.getCurrentTVL(), 1_000_000e18);
    }
}