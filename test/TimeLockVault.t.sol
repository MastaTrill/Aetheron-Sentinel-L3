// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/treasury/TimeLockVault.sol";
import "../contracts/mocks/MockToken.sol";

contract TimeLockVaultTest is Test {
    TimeLockVault public vault;
    MockToken public token;
    
    address public admin = address(0x1);
    address public guardian = address(0x2);
    address public beneficiary1 = address(0x3);
    address public beneficiary2 = address(0x4);
    
    uint256 constant ONE_YEAR = 365 days;
    uint256 constant TWO_YEARS = 730 days;
    
    function setUp() public {
        token = new MockToken("Time Lock Token", "TLT", 0);
        vault = new TimeLockVault(address(token), address(this));
        
        // Setup roles
        vault.grantRole(vault.ADMIN_ROLE(), admin);
        vault.grantRole(vault.GUARDIAN_ROLE(), guardian);
        
        // Mint tokens to test
        token.mint(admin, 1_000_000 ether);
        token.mint(beneficiary1, 1000 ether);
        token.mint(beneficiary2, 1000 ether);
    }
    
    // ============ Vesting Schedule Creation ============
    
    function testCreateVestingSchedule() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary1;
        
        bytes32 scheduleId = vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            30 days,
            ONE_YEAR,
            true, // revocable
            beneficiaries
        );
        
        assertTrue(scheduleId != bytes32(0));
        
        (uint256 totalAmount, , , , , , , uint256 vested) = vault.getScheduleInfo(scheduleId);
        assertEq(totalAmount, 1000 ether);
        assertEq(vested, 0);
    }
    
    function testCreateVestingScheduleWithMultipleBeneficiaries() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](2);
        beneficiaries[0] = beneficiary1;
        beneficiaries[1] = beneficiary2;
        
        bytes32 scheduleId = vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            30 days,
            ONE_YEAR,
            false, // not revocable
            beneficiaries
        );
        
        bytes32[] memory ben1Schedules = vault.getBeneficiarySchedules(beneficiary1);
        bytes32[] memory ben2Schedules = vault.getBeneficiarySchedules(beneficiary2);
        
        assertEq(ben1Schedules.length, 1);
        assertEq(ben2Schedules.length, 1);
        assertEq(ben1Schedules[0], scheduleId);
    }
    
    function testCreateVestingScheduleInvalidDuration() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary1;
        
        vm.expectRevert("Duration must be > 0");
        vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            0,
            0,
            false,
            beneficiaries
        );
    }
    
    function testCreateVestingScheduleNoBeneficiaries() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](0);
        
        vm.expectRevert("Need beneficiaries");
        vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            0,
            ONE_YEAR,
            false,
            beneficiaries
        );
    }
    
    // ============ Deposit to Schedule ============
    
    function testDepositToSchedule() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary1;
        
        bytes32 scheduleId = vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            30 days,
            ONE_YEAR,
            true,
            beneficiaries
        );
        
        // Approve and deposit
        vm.prank(admin);
        token.approve(address(vault), 500 ether);
        
        vm.prank(admin);
        vault.depositToSchedule(scheduleId, 500 ether);
        
        assertEq(vault.getVaultBalance(), 500 ether);
    }
    
    function testDepositToRevokedSchedule() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary1;
        
        bytes32 scheduleId = vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            30 days,
            ONE_YEAR,
            true,
            beneficiaries
        );
        
        // Revoke schedule
        vm.prank(admin);
        vault.revokeSchedule(scheduleId);
        
        // Try to deposit
        vm.prank(admin);
        token.approve(address(vault), 500 ether);
        
        vm.prank(admin);
        vm.expectRevert("Schedule revoked");
        vault.depositToSchedule(scheduleId, 500 ether);
    }
    
    // ============ Claiming ============
    
    function testClaimBeforeCliff() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary1;
        
        bytes32 scheduleId = vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            30 days, // Cliff
            ONE_YEAR,
            true,
            beneficiaries
        );
        
        // Deposit tokens
        vm.prank(admin);
        token.approve(address(vault), 1000 ether);
        
        vm.prank(admin);
        vault.depositToSchedule(scheduleId, 1000 ether);
        
        // Try to claim before cliff
        vm.prank(beneficiary1);
        uint256 claimable = vault.claimable(beneficiary1);
        assertEq(claimable, 0);
    }
    
    function testClaimAfterCliff() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary1;
        
        bytes32 scheduleId = vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            30 days,
            ONE_YEAR,
            true,
            beneficiaries
        );
        
        // Deposit tokens
        vm.prank(admin);
        token.approve(address(vault), 1000 ether);
        
        vm.prank(admin);
        vault.depositToSchedule(scheduleId, 1000 ether);
        
        // Warp past cliff
        vm.warp(block.timestamp + 31 days);
        
        // Now should have some vested
        uint256 claimable = vault.claimable(beneficiary1);
        assertGt(claimable, 0);
    }
    
    function testClaimAfterFullVesting() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary1;
        
        bytes32 scheduleId = vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            30 days,
            ONE_YEAR,
            true,
            beneficiaries
        );
        
        // Deposit tokens
        vm.prank(admin);
        token.approve(address(vault), 1000 ether);
        
        vm.prank(admin);
        vault.depositToSchedule(scheduleId, 1000 ether);
        
        // Warp past full vesting
        vm.warp(block.timestamp + TWO_YEARS);
        
        uint256 claimable = vault.claimable(beneficiary1);
        assertEq(claimable, 1000 ether);
    }
    
    function testClaimOnlyBeneficiary() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary1;
        
        bytes32 scheduleId = vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            30 days,
            ONE_YEAR,
            true,
            beneficiaries
        );
        
        // Deposit tokens
        vm.prank(admin);
        token.approve(address(vault), 1000 ether);
        
        vm.prank(admin);
        vault.depositToSchedule(scheduleId, 1000 ether);
        
        // Warp past cliff
        vm.warp(block.timestamp + 31 days);
        
        // Non-beneficiary tries to claim
        vm.prank(beneficiary2);
        vm.expectRevert("Not a beneficiary");
        vault.claim(beneficiary2);
    }
    
    // ============ Revocation ============
    
    function testRevokeSchedule() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary1;
        
        bytes32 scheduleId = vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            30 days,
            ONE_YEAR,
            true, // revocable
            beneficiaries
        );
        
        // Deposit tokens
        vm.prank(admin);
        token.approve(address(vault), 1000 ether);
        
        vm.prank(admin);
        vault.depositToSchedule(scheduleId, 1000 ether);
        
        // Warp past cliff
        vm.warp(block.timestamp + 31 days);
        
        // Claim some
        vm.prank(beneficiary1);
        vault.claim(beneficiary1);
        
        // Revoke remaining
        vm.prank(admin);
        vault.revokeSchedule(scheduleId);
        
        (, , , , , bool revoked, , ) = vault.getScheduleInfo(scheduleId);
        assertTrue(revoked);
    }
    
    function testRevokeNonRevocableSchedule() public {
        vm.prank(admin);
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary1;
        
        bytes32 scheduleId = vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            30 days,
            ONE_YEAR,
            false, // NOT revocable
            beneficiaries
        );
        
        vm.prank(admin);
        vm.expectRevert("Not revocable");
        vault.revokeSchedule(scheduleId);
    }
    
    // ============ Emergency Controls ============
    
    function testToggleEmergencyPause() public {
        assertFalse(vault.emergencyPause());
        
        vm.prank(guardian);
        vault.toggleEmergencyPause();
        
        assertTrue(vault.emergencyPause());
        
        vm.prank(guardian);
        vault.toggleEmergencyPause();
        
        assertFalse(vault.emergencyPause());
    }
    
    function testInitiateEmergencyWithdrawal() public {
        // Give vault some tokens
        token.mint(address(vault), 100 ether);
        
        vm.prank(guardian);
        vault.initiateEmergencyWithdrawal(beneficiary1);
        
        assertTrue(vault.emergencyApproved(guardian));
    }
    
    function testExecuteEmergencyWithdrawalDelay() public {
        // Give vault some tokens
        token.mint(address(vault), 100 ether);
        
        vm.prank(guardian);
        vault.initiateEmergencyWithdrawal(beneficiary1);
        
        // Try to execute immediately - should fail
        vm.prank(guardian);
        vm.expectRevert("Delay not passed");
        vault.executeEmergencyWithdrawal(beneficiary1, 0);
    }
    
    function testExecuteEmergencyWithdrawalAfterDelay() public {
        // Give vault some tokens
        token.mint(address(vault), 100 ether);
        
        vm.prank(guardian);
        vault.initiateEmergencyWithdrawal(beneficiary1);
        
        // Warp past delay
        vm.warp(block.timestamp + 48 hours + 1 seconds);
        
        uint256 balanceBefore = token.balanceOf(beneficiary1);
        
        vm.prank(guardian);
        vault.executeEmergencyWithdrawal(beneficiary1, 0);
        
        assertEq(token.balanceOf(beneficiary1), balanceBefore + 100 ether);
    }
    
    // ============ Access Control ============
    
    function testOnlyAdminCanCreateSchedule() public {
        vm.prank(beneficiary1);
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary2;
        
        vm.expectRevert();
        vault.createVestingSchedule(
            1000 ether,
            block.timestamp,
            30 days,
            ONE_YEAR,
            true,
            beneficiaries
        );
    }
    
    function testOnlyGuardianCanEmergencyPause() public {
        vm.prank(beneficiary1);
        vm.expectRevert();
        vault.toggleEmergencyPause();
    }
}
