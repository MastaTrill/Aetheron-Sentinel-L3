// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/Address.sol";
import "forge-std/Bytes32.sol";
import "forge-std/ContractFactory.sol";

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./RateLimiter.sol";

contract RateLimiterTest is Test {
    RateLimiter public rateLimiter;
    address public owner = makeAddr("owner");
    address public manager = makeAddr("manager");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public attacker = makeAddr("attacker");

    function setUp() public {
        vm.prank(owner);
        rateLimiter = new RateLimiter(1000000e18, 3600); // 1M per hour
        
        // Grant manager role
        rateLimiter.grantRole(rateLimiter.MANAGER_ROLE(), manager);
    }

    function testDeployment() public view {
        assertEq(rateLimiter.maxWithdrawalPerWindow(), 1000000e18);
        assertEq(rateLimiter.windowDuration(), 3600);
        assertEq(rateLimiter.windowStart(), block.timestamp);
        assertEq(rateLimiter.currentWindowAmount(), 0);
    }

    function testBasicRateLimit() public {
        // First withdrawal - should succeed
        vm.prank(user1);
        rateLimiter.processWithdrawal(user1, 500000e18, 1);

        // Second withdrawal - should succeed
        rateLimiter.processWithdrawal(user1, 300000e18, 1);

        // Third withdrawal - should exceed limit
        vm.expectRevert(RateLimitExceeded(
            300000e18,
            200000e18,
            3600
        ));
        rateLimiter.processWithdrawal(user1, 300000e18, 1);
    }

    function testChainSpecificLimits() public {
        // Set chain-specific limit
        vm.prank(manager);
        rateLimiter.setChainLimit(100, 500000e18); // 500K for chain 100

        // Test with chain-specific limit
        vm.prank(user1);
        rateLimiter.processWithdrawal(user1, 400000e18, 100); // Should succeed

        // Exceed chain-specific limit
        vm.expectRevert(RateLimitExceeded(
            200000e18,
            100000e18,
            3600
        ));
        rateLimiter.processWithdrawal(user1, 200000e18, 100);
    }

    function testWindowReset() public {
        // Set up initial withdrawal
        vm.prank(user1);
        rateLimiter.processWithdrawal(user1, 500000e18, 1);

        // Fast forward to next window
        vm.advanceBlock();
        vm.advanceBlock();

        // Update window manually for testing
        vm.prank(owner);
        rateLimiter._updateWindow();

        // Should be able to withdraw again after window reset
        rateLimiter.processWithdrawal(user1, 600000e18, 1);

        assertEq(rateLimiter.currentWindowAmount(), 600000e18);
    }

    function testAverageWindowCalculation() public {
        // Make withdrawals in different windows
        vm.prank(user1);
        rateLimiter.processWithdrawal(user1, 200000e18, 1);

        // Fast forward to next window
        vm.advanceBlock();
        vm.prank(owner);
        rateLimiter._updateWindow();

        // Make withdrawal in second window
        rateLimiter.processWithdrawal(user1, 400000e18, 1);

        // Fast forward to third window
        vm.advanceBlock();
        vm.prank(owner);
        rateLimiter._updateWindow();

        // Make withdrawal in third window
        rateLimiter.processWithdrawal(user1, 300000e18, 1);

        // Calculate average (sum of all 10 windows / 10)
        uint256 avg = rateLimiter.getAverageWindowAmount();
        assertEq(avg, (200000e18 + 400000e18 + 300000e18) / 10);
    }

    function testManagerFunctions() public {
        // Test manager can update limits
        vm.prank(manager);
        
        // Update withdrawal limit
        rateLimiter.setMaxWithdrawalPerWindow(2000000e18);
        assertEq(rateLimiter.maxWithdrawalPerWindow(), 2000000e18);
        
        // Update window duration
        rateLimiter.setWindowDuration(7200); // 2 hours
        assertEq(rateLimiter.windowDuration(), 7200);
        
        // Set chain-specific limit
        rateLimiter.setChainLimit(200, 1000000e18);
        assertEq(rateLimiter.chainLimits(200), 1000000e18);
    }

    function testUnauthorizedManagerFunctions() public {
        // Owner should not be able to call manager functions
        vm.prank(owner);
        vm.expectRevert();
        rateLimiter.setMaxWithdrawalPerWindow(3000000e18);
        
        // Regular user should not be able to call manager functions
        vm.prank(user1);
        vm.expectRevert();
        rateLimiter.setChainLimit(300, 500000e18);
    }

    function testGetWindowStats() public {
        // Make a withdrawal
        vm.prank(user1);
        rateLimiter.processWithdrawal(user1, 300000e18, 1);

        // Get window stats
        (uint256 remaining, uint256 amountUsed, uint256 limit) =
            rateLimiter.getWindowStats();

        assertGt(remaining, 0);
        assertEq(amountUsed, 300000e18);
        assertEq(limit, 1000000e18);
    }

    function testRateLimitExceedance() public {
        // Set up to exceed limit
        vm.prank(user1);
        rateLimiter.processWithdrawal(user1, 900000e18, 1);

        // Try to exceed limit - should revert
        vm.expectRevert(RateLimitExceeded(
            200000e18,
            100000e18,
            3600
        ));
        rateLimiter.processWithdrawal(user1, 200000e18, 1);
    }

    function testZeroAmount() public {
        // Zero amount should be allowed
        vm.prank(user1);
        rateLimiter.processWithdrawal(user1, 0, 1);

        assertEq(rateLimiter.currentWindowAmount(), 0);
    }

    function testMultipleUsers() public {
        // User1 makes withdrawal
        vm.prank(user1);
        rateLimiter.processWithdrawal(user1, 400000e18, 1);

        // User2 makes withdrawal
        vm.prank(user2);
        rateLimiter.processWithdrawal(user2, 300000e18, 1);

        // Check amounts are tracked globally
        assertEq(rateLimiter.currentWindowAmount(), 700000e18);
    }

    function testInvalidConstructorParameters() public {
        // Test invalid window duration
        vm.expectRevert(InvalidWindowDuration());
        new RateLimiter(1000000e18, 0);
        
        // Test invalid limit
        vm.expectRevert(InvalidLimit());
        new RateLimiter(0, 3600);
    }

    function testChainLimitOverrides() public {
        // Set global limit and chain-specific limit
        vm.prank(manager);
        rateLimiter.setChainLimit(150, 200000e18); // Lower than global

        // Test with chain-specific limit
        vm.prank(user1);
        rateLimiter.processWithdrawal(user1, 150000e18, 150); // Should succeed

        // Exceed chain-specific limit
        vm.expectRevert(RateLimitExceeded(
            100000e18,
            50000e18,
            3600
        ));
        rateLimiter.processWithdrawal(user1, 100000e18, 150);
    }

    function testNoChainLimit() public {
        // Test without chain-specific limit
        vm.prank(user1);
        rateLimiter.processWithdrawal(user1, 500000e18, 999); // No chain limit set
        assertEq(rateLimiter.currentWindowAmount(), 500000e18);
    }
}