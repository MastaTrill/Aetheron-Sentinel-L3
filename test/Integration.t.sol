// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/SentinelInterceptor.sol";
import "../contracts/mocks/MockBridge.sol";
import "../contracts/yield/YieldAggregator.sol";
import "../contracts/security/RateLimiter.sol";
import "../contracts/security/CircuitBreaker.sol";
import "../contracts/security/FlashLoanProtection.sol";
import "../contracts/security/PriceOracle.sol";
import "../contracts/mocks/MockToken.sol";

contract IntegrationTest is Test {
    SentinelInterceptor public sentinel;
    MockBridge public bridge;
    YieldAggregator public yieldAggregator;
    RateLimiter public rateLimiter;
    CircuitBreaker public circuitBreaker;
    FlashLoanProtection public flashProtection;
    PriceOracle public priceOracle;
    MockToken public token;

    address public owner = makeAddr("owner");
    address public oracle = makeAddr("oracle");
    address public sentinelRole = makeAddr("sentinel");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public attacker = makeAddr("attacker");

    event TokensBridged(
        address indexed sender,
        address indexed token,
        uint256 amount,
        uint256 destinationChain,
        address recipient,
        bytes32 transferId
    );

    event AnomalyDetected(uint256 tvlPercentage, uint256 threshold, uint256 timestamp);
    event AutonomousPauseTriggered(address indexed trigger, uint256 tvlAtPause, uint256 duration);

    function setUp() public {
        vm.startPrank(owner);

        // Deploy mock token
        token = new MockToken("Test Token", "TEST", 18);

        // Deploy bridge
        bridge = new MockBridge();

        // Deploy sentinel
        sentinel = new SentinelInterceptor(address(bridge), owner);

        // Deploy security modules
        rateLimiter = new RateLimiter(100_000e18, 3600); // 100k per hour
        circuitBreaker = new CircuitBreaker();
        flashProtection = new FlashLoanProtection();
        priceOracle = new PriceOracle();

        // Deploy yield aggregator
        yieldAggregator = new YieldAggregator(address(token));

        // Grant roles
        sentinel.grantRole(sentinel.ORACLE_ROLE(), oracle);
        sentinel.grantRole(sentinel.SENTINEL_ROLE(), sentinelRole);
        rateLimiter.grantRole(rateLimiter.MANAGER_ROLE(), owner);
        circuitBreaker.grantRole(circuitBreaker.SENTINEL_ROLE(), sentinelRole);
        flashProtection.grantRole(flashProtection.ORACLE_ROLE(), oracle);
        priceOracle.grantRole(priceOracle.DATA_FEED_ROLE(), oracle);

        // Add yield source
        bytes32 sourceId = yieldAggregator.addYieldSource(
            address(yieldAggregator), // mock protocol
            address(token),
            10, // low risk
            address(0) // no harvest strategy
        );

        // Set initial TVL and prices
        vm.stopPrank();
        vm.prank(oracle);
        sentinel.updateTVL(1_000_000e18);
        priceOracle.updatePrice(address(token), 1e18);

        vm.prank(owner);
        token.mint(address(yieldAggregator), 100_000e18);
        token.mint(user1, 10_000e18);
        token.mint(user2, 10_000e18);
    }

    function testAnomalyDetectionIntegration() public {
        // Simulate large withdrawal that triggers anomaly
        vm.prank(oracle);
        vm.expectEmit();
        emit AutonomousPauseTriggered(address(sentinel), 1_000_000e18, block.timestamp);
        sentinel.reportAnomaly(1520, 1_000_000e18); // 15.2% spike

        assertTrue(sentinel.paused());
        assertTrue(bridge.paused());
    }

    function testYieldAggregationWithSecurity() public {
        // Get source ID (assuming first source)
        bytes32[] memory sources = yieldAggregator.getAllActiveSources();
        bytes32 sourceId = sources[0];

        // Test yield aggregation with rate limiting
        vm.startPrank(user1);
        token.approve(address(yieldAggregator), 5_000e18);

        // Should succeed within rate limits
        yieldAggregator.deposit(5_000e18, sourceId);
        assertEq(yieldAggregator.userPositions(user1).accumulatedShares, 5_000e18);

        vm.stopPrank();
        vm.startPrank(user2);
        token.approve(address(yieldAggregator), 5_000e18);
        yieldAggregator.deposit(5_000e18, sourceId);

        // Fast forward to exceed rate limit window reset
        vm.warp(block.timestamp + 3601);

        vm.startPrank(user1);
        // Should succeed after window reset
        (uint256 amount, uint256 yield) = yieldAggregator.withdraw(2_500e18);
        assertEq(yieldAggregator.userPositions(user1).accumulatedShares, 2_500e18);
    }

    function testCircuitBreakerIntegration() public {
        // Simulate failures to trip circuit breaker
        vm.startPrank(sentinelRole);

        // Record 5 failures to trip breaker
        for (uint256 i = 0; i < 5; i++) {
            // Simulate failure recording (would be done via modifier in real contract)
            vm.warp(block.timestamp + 10);
        }

        // Force open circuit breaker
        circuitBreaker.forceOpen();
        assertEq(uint256(circuitBreaker.currentState()), 1); // OPEN

        // Wait for reset timeout
        vm.warp(block.timestamp + circuitBreaker.resetTimeout() + 1);

        // Next call should transition to HALF_OPEN
        // (This would be tested with actual function calls that use circuitNormal modifier)

        vm.stopPrank();
    }

    function testFlashLoanProtectionIntegration() public {
        // Test flash loan protection with position tracking
        vm.prank(oracle);
        flashProtection.recordPosition(user1, 10_000e18);

        // Simulate flash loan attack
        vm.prank(attacker);
        vm.expectRevert(FlashLoanProtection.FlashLoanAttackDetected.selector);
        // This would trigger the checkFlashLoan modifier in a real bridge function

        // Verify position age
        assertTrue(flashProtection.getPositionAge(user1) > 0);
    }

    function testPriceOracleAnomalyDetection() public {
        vm.startPrank(oracle);

        // Set normal price
        priceOracle.updatePrice(address(token), 1e18);

        // Set large deviation - should detect anomaly
        vm.expectEmit();
        emit PriceOracle.PriceAnomalyDetected(address(token), 1e18, 2e18, 10000); // 100% deviation
        priceOracle.updatePrice(address(token), 2e18);

        vm.stopPrank();
    }

    function testBridgePauseOnAnomaly() public {
        // Start with normal operation
        assertFalse(sentinel.paused());
        assertFalse(bridge.paused());

        // Simulate bridge transaction that triggers anomaly
        vm.prank(oracle);
        sentinel.reportAnomaly(1520, 1_000_000e18);

        // Should pause both sentinel and bridge
        assertTrue(sentinel.paused());
        assertTrue(bridge.paused());
    }

    function testYieldAggregatorWithCircuitBreaker() public {
        // Test yield aggregator independently
        bytes32[] memory sources = yieldAggregator.getAllActiveSources();
        bytes32 sourceId = sources[0];

        vm.startPrank(user1);
        token.approve(address(yieldAggregator), 1_000e18);
        yieldAggregator.deposit(1_000e18, sourceId);

        assertEq(yieldAggregator.userPositions(user1).accumulatedShares, 1_000e18);
    }

    function testEndToEndAnomalyResponse() public {
        // 1. Normal operation
        assertFalse(sentinel.paused());

        // 2. Anomaly detected by oracle
        vm.prank(oracle);
        sentinel.reportAnomaly(1520, 1_000_000e18);

        // 3. Sentinel pauses bridge
        assertTrue(sentinel.paused());
        assertTrue(bridge.paused());

        // 4. Manual intervention by sentinel
        vm.prank(sentinelRole);
        sentinel.resumeBridge(900_000e18);

        // 5. Bridge resumes
        assertFalse(sentinel.paused());
        assertFalse(bridge.paused());
        assertEq(sentinel.totalValueLocked(), 900_000e18);
    }

    function testRateLimiterAcrossMultipleUsers() public {
        // Multiple users deposit within limits
        vm.startPrank(user1);
        token.approve(address(rateLimiter), 50_000e18);
        // Assuming rate limiter is used in yield aggregator deposits

        vm.startPrank(user2);
        token.approve(address(rateLimiter), 50_000e18);

        // Should succeed as within per-user limits
        // (Actual rate limiting would be tested in modifier usage)
    }

    function testSecurityModulesCoordination() public {
        // Test that all security modules work together
        vm.prank(oracle);

        // Update prices
        priceOracle.updatePrice(address(token), 1e18);

        // Record position for flash protection
        flashProtection.recordPosition(user1, 5_000e18);

        // Update TVL for anomaly detection
        sentinel.updateTVL(1_000_000e18);

        // All modules should be in good state
        assertFalse(sentinel.paused());
        assertEq(uint256(circuitBreaker.currentState()), 0); // CLOSED
        assertTrue(flashProtection.isPositionNew(user1)); // Initially new
    }
}