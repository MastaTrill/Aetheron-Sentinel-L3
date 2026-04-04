// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/yield/YieldAggregator.sol";
import "../contracts/mocks/MockToken.sol";

contract MockYieldSource {
    uint256 public depositedAmount;
    
    function deposit(uint256 _amount) external {
        depositedAmount += _amount;
    }
    
    function withdraw(uint256 _amount) external {
        require(depositedAmount >= _amount, "Insufficient balance");
        depositedAmount -= _amount;
    }
    
    function balance() external view returns (uint256) {
        return depositedAmount;
    }
}

contract YieldAggregatorTest is Test {
    YieldAggregator public aggregator;
    MockToken public depositToken;
    MockYieldSource public mockSource;
    
    address public manager = address(0x1);
    address public security = address(0x2);
    address public user1 = address(0x3);
    address public user2 = address(0x4);
    
    bytes32 public sourceId;
    
    function setUp() public {
        depositToken = new MockToken();
        aggregator = new YieldAggregator(address(depositToken));
        mockSource = new MockYieldSource();
        
        // Setup roles
        aggregator.grantRole(aggregator.MANAGER_ROLE(), manager);
        aggregator.grantRole(aggregator.SECURITY_ROLE(), security);
        
        // Add yield source
        vm.prank(manager);
        sourceId = aggregator.addYieldSource(
            address(mockSource),
            address(depositToken),
            30, // risk score
            address(0) // no harvest strategy
        );
        
        // Setup users
        depositToken.mint(user1, 100_000 ether);
        depositToken.mint(user2, 100_000 ether);
    }
    
    // ============ Deposit ============
    
    function testDeposit() public {
        vm.startPrank(user1);
        depositToken.approve(address(aggregator), 1000 ether);
        
        uint256 shares = aggregator.deposit(1000 ether, sourceId);
        
        assertGt(shares, 0);
        
        (uint256 deposited, , uint256 totalValue) = aggregator.getUserPosition(user1);
        assertEq(deposited, 1000 ether);
        assertEq(totalValue, 1000 ether);
        
        vm.stopPrank();
    }
    
    function testDepositMultipleUsers() public {
        // User 1 deposits
        vm.prank(user1);
        depositToken.approve(address(aggregator), 1000 ether);
        
        vm.prank(user1);
        uint256 shares1 = aggregator.deposit(1000 ether, sourceId);
        
        // User 2 deposits same amount
        vm.prank(user2);
        depositToken.approve(address(aggregator), 1000 ether);
        
        vm.prank(user2);
        uint256 shares2 = aggregator.deposit(1000 ether, sourceId);
        
        // Shares should be equal for equal deposits
        assertEq(shares1, shares2);
    }
    
    function testDepositBelowMinimum() public {
        vm.prank(user1);
        depositToken.approve(address(aggregator), 1); // Below MIN_DEPOSIT
        
        vm.prank(user1);
        vm.expectRevert("Amount too small");
        aggregator.deposit(1, sourceId);
    }
    
    function testDepositToInactiveSource() public {
        // Remove source first
        vm.prank(manager);
        aggregator.removeYieldSource(sourceId);
        
        vm.prank(user1);
        depositToken.approve(address(aggregator), 1000 ether);
        
        vm.prank(user1);
        vm.expectRevert("Source not active");
        aggregator.deposit(1000 ether, sourceId);
    }
    
    function testDepositToHighRiskSource() public {
        // Add high risk source
        vm.prank(manager);
        bytes32 highRiskSource = aggregator.addYieldSource(
            address(0x1234),
            address(depositToken),
            100, // max risk
            address(0)
        );
        
        vm.prank(user1);
        depositToken.approve(address(aggregator), 1000 ether);
        
        vm.prank(user1);
        vm.expectRevert("Source risk too high");
        aggregator.deposit(1000 ether, highRiskSource);
    }
    
    // ============ Withdrawal ============
    
    function testWithdraw() public {
        // Deposit first
        vm.prank(user1);
        depositToken.approve(address(aggregator), 1000 ether);
        
        vm.prank(user1);
        uint256 shares = aggregator.deposit(1000 ether, sourceId);
        
        // Withdraw
        vm.prank(user1);
        (uint256 amount, uint256 yield) = aggregator.withdraw(shares);
        
        assertEq(amount, 1000 ether);
        assertEq(yield, 0); // No yield accumulated
    }
    
    function testWithdrawPartial() public {
        // Deposit
        vm.prank(user1);
        depositToken.approve(address(aggregator), 1000 ether);
        
        vm.prank(user1);
        uint256 shares = aggregator.deposit(1000 ether, sourceId);
        
        // Withdraw half
        vm.prank(user1);
        (uint256 amount, ) = aggregator.withdraw(shares / 2);
        
        assertEq(amount, 500 ether);
    }
    
    function testWithdrawInsufficientShares() public {
        vm.prank(user1);
        depositToken.approve(address(aggregator), 1000 ether);
        
        vm.prank(user1);
        aggregator.deposit(1000 ether, sourceId);
        
        vm.prank(user1);
        vm.expectRevert("Insufficient shares");
        aggregator.withdraw(1_000_000 ether); // More than deposited
    }
    
    // ============ Yield Source Management ============
    
    function testAddYieldSource() public {
        address newSource = address(0x1234);
        
        vm.prank(manager);
        bytes32 newSourceId = aggregator.addYieldSource(
            newSource,
            address(depositToken),
            50,
            address(0)
        );
        
        assertTrue(newSourceId != bytes32(0));
        
        (address protocol, uint256 allocatedAmount, , bool active, uint256 riskScore, ) = 
            aggregator.getYieldSourceInfo(newSourceId);
        
        assertEq(protocol, newSource);
        assertTrue(active);
        assertEq(riskScore, 50);
    }
    
    function testRemoveYieldSource() public {
        vm.prank(manager);
        aggregator.removeYieldSource(sourceId);
        
        (, , , bool active, , ) = aggregator.getYieldSourceInfo(sourceId);
        assertFalse(active);
    }
    
    function testRemoveYieldSourceWithFunds() public {
        // First deposit
        vm.prank(user1);
        depositToken.approve(address(aggregator), 1000 ether);
        
        vm.prank(user1);
        aggregator.deposit(1000 ether, sourceId);
        
        // Try to remove source with funds
        vm.prank(manager);
        vm.expectRevert("Source has allocated funds");
        aggregator.removeYieldSource(sourceId);
    }
    
    // ============ Security Scanning ============
    
    function testSecurityScan() public {
        vm.prank(security);
        address scannedProtocol;
        bool isSafe;
        uint256 riskScore;
        uint256 scanTimestamp;
        (scannedProtocol, isSafe, riskScore, scanTimestamp) = aggregator
            .performSecurityScan(address(mockSource));
        
        // Mock source has no code, should be flagged
        assertFalse(isSafe);
        assertGt(riskScore, 0);
    }
    
    // ============ Emergency Controls ============
    
    function testTriggerEmergencyStop() public {
        vm.prank(security);
        aggregator.triggerEmergencyStop();
        
        // Should not be able to deposit
        vm.prank(user1);
        depositToken.approve(address(aggregator), 1000 ether);
        
        vm.prank(user1);
        vm.expectRevert("Emergency stop active");
        aggregator.deposit(1000 ether, sourceId);
    }
    
    function testResumeOperations() public {
        // Stop
        vm.prank(security);
        aggregator.triggerEmergencyStop();
        
        // Resume
        aggregator.resumeOperations();
        
        // Should work again
        vm.prank(user1);
        depositToken.approve(address(aggregator), 1000 ether);
        
        vm.prank(user1);
        uint256 shares = aggregator.deposit(1000 ether, sourceId);
        
        assertGt(shares, 0);
    }
    
    // ============ View Functions ============
    
    function testGetTotalValueLocked() public {
        assertEq(aggregator.getTotalValueLocked(), 0);
        
        vm.prank(user1);
        depositToken.approve(address(aggregator), 1000 ether);
        
        vm.prank(user1);
        aggregator.deposit(1000 ether, sourceId);
        
        assertEq(aggregator.getTotalValueLocked(), 1000 ether);
    }
    
    function testGetAPY() public {
        // Initially should be 0 or very low
        uint256 apy = aggregator.getAPY(sourceId);
        assertEq(apy, 0);
    }
    
    function testGetAllActiveSources() public {
        bytes32[] memory sources = aggregator.getAllActiveSources();
        assertEq(sources.length, 1);
        assertEq(sources[0], sourceId);
    }
    
    // ============ Access Control ============
    
    function testOnlyManagerCanAddSource() public {
        vm.prank(user1);
        vm.expectRevert();
        aggregator.addYieldSource(
            address(0x1234),
            address(depositToken),
            50,
            address(0)
        );
    }
    
    function testOnlySecurityCanEmergencyStop() public {
        vm.prank(user1);
        vm.expectRevert();
        aggregator.triggerEmergencyStop();
    }
}
