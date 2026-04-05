// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/insurance/CoveragePool.sol";
import "../contracts/mocks/MockToken.sol";

contract CoveragePoolTest is Test {
    CoveragePool public coveragePool;
    MockToken public coverageToken;
    
    address public admin = address(0x1);
    address public claimsAdjuster = address(0x2);
    address public riskManager = address(0x3);
    address public insured1 = address(0x4);
    address public insured2 = address(0x5);
    address public protocol = address(0x6);
    
    function setUp() public {
        coverageToken = new MockToken("Coverage Token", "COV", 0);
        coveragePool = new CoveragePool(address(coverageToken));
        
        // Setup roles
        coveragePool.grantRole(coveragePool.CLAIMS_ADJUSTER_ROLE(), claimsAdjuster);
        coveragePool.grantRole(coveragePool.RISK_MANAGER_ROLE(), riskManager);
        
        // Whitelist insured
        coveragePool.whitelistPolicyholder(insured1, true);
        coveragePool.whitelistPolicyholder(insured2, true);
        
        // Setup protocol risk
        vm.prank(riskManager);
        coveragePool.assessProtocolRisk(protocol, CoveragePool.RiskTier.Medium);
        
        // Mint tokens
        coverageToken.mint(address(coveragePool), 1_000_000 ether);
        coverageToken.mint(insured1, 10_000 ether);
        coverageToken.mint(insured2, 10_000 ether);
    }
    
    // ============ Policy Creation ============
    
    function testCreatePolicy() public {
        vm.prank(insured1);
        coverageToken.approve(address(coveragePool), 10_000 ether);
        
        vm.prank(insured1);
        uint256 policyId = coveragePool.createPolicy(
            protocol,
            insured1,
            1000 ether,
            30 days
        );
        
        assertEq(policyId, 0);
        
        (address prot, address insured, uint256 coverageAmount, , , bool isActive, ) = 
            coveragePool.getPolicy(policyId);
        
        assertEq(prot, protocol);
        assertEq(insured, insured1);
        assertEq(coverageAmount, 1000 ether);
        assertTrue(isActive);
    }
    
    function testCreatePolicyBelowMinimum() public {
        vm.prank(insured1);
        coverageToken.approve(address(coveragePool), 10 ether);
        
        vm.prank(insured1);
        vm.expectRevert("Coverage too low");
        coveragePool.createPolicy(
            protocol,
            insured1,
            10 ether, // Below minimum
            30 days
        );
    }
    
    function testCreatePolicyInsufficientPoolCapacity() public {
        // Add a large policy first to use up pool capacity
        vm.prank(insured2);
        coverageToken.approve(address(coveragePool), 1_000_000 ether);
        
        vm.prank(insured2);
        coveragePool.createPolicy(
            protocol,
            insured2,
            900_000 ether,
            365 days
        );
        
        // Try to create another policy
        vm.prank(insured1);
        coverageToken.approve(address(coveragePool), 10_000 ether);
        
        vm.prank(insured1);
        vm.expectRevert("Insufficient pool capacity");
        coveragePool.createPolicy(
            protocol,
            insured1,
            100_000 ether,
            30 days
        );
    }
    
    // ============ Policy Management ============
    
    function testRenewPolicy() public {
        uint256 policyId = _createPolicy();
        
        // Warp past end
        vm.warp(block.timestamp + 31 days);
        
        vm.prank(insured1);
        coverageToken.approve(address(coveragePool), 10_000 ether);
        
        vm.prank(insured1);
        coveragePool.renewPolicy(policyId, 30 days);
        
        (address prot, , , , uint256 endTime, bool isActive, ) = coveragePool.getPolicy(policyId);
        assertTrue(isActive);
        assertGt(endTime, block.timestamp);
    }
    
    function testCancelPolicy() public {
        uint256 policyId = _createPolicy();
        
        vm.prank(insured1);
        coveragePool.cancelPolicy(policyId);
        
        (, , , , , bool isActive, ) = coveragePool.getPolicy(policyId);
        assertFalse(isActive);
    }
    
    // ============ Claims ============
    
    function testSubmitClaim() public {
        uint256 policyId = _createPolicy();
        
        vm.prank(insured1);
        uint256 claimId = coveragePool.submitClaim(
            policyId,
            100 ether,
            "Test claim",
            keccak256("evidence")
        );
        
        assertEq(claimId, 0);
        
        (uint256 polId, address claimant, uint256 amount, , CoveragePool.ClaimStatus status, , ) = 
            coveragePool.getClaim(claimId);
        
        assertEq(polId, policyId);
        assertEq(claimant, insured1);
        assertEq(amount, 100 ether);
        assertEq(uint8(status), uint8(CoveragePool.ClaimStatus.Pending));
    }
    
    function testSubmitClaimExceedingCoverage() public {
        uint256 policyId = _createPolicy();
        
        vm.prank(insured1);
        vm.expectRevert("Invalid claim amount");
        coveragePool.submitClaim(
            policyId,
            10_000 ether, // More than coverage
            "Too much",
            keccak256("evidence")
        );
    }
    
    function testSubmitClaimMaxReached() public {
        uint256 policyId = _createPolicy();
        
        // Submit max claims
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(insured1);
            coveragePool.submitClaim(
                policyId,
                10 ether,
                "Claim",
                keccak256("evidence")
            );
        }
        
        // Try to submit one more
        vm.prank(insured1);
        vm.expectRevert("Max claims reached");
        coveragePool.submitClaim(
            policyId,
            10 ether,
            "One more",
            keccak256("evidence")
        );
    }
    
    // ============ Claims Processing ============
    
    function testReviewClaim() public {
        uint256 claimId = _submitClaim();
        
        vm.prank(claimsAdjuster);
        coveragePool.reviewClaim(claimId, 80);
        
        (, , , , CoveragePool.ClaimStatus status, , ) = coveragePool.getClaim(claimId);
        assertEq(uint8(status), uint8(CoveragePool.ClaimStatus.UnderReview));
    }
    
    function testApproveClaim() public {
        uint256 claimId = _submitClaim();
        
        vm.prank(claimsAdjuster);
        coveragePool.reviewClaim(claimId, 80);
        
        vm.prank(claimsAdjuster);
        coveragePool.approveClaim(claimId, 100 ether);
        
        (, , , uint256 payoutAmount, CoveragePool.ClaimStatus status, , ) = 
            coveragePool.getClaim(claimId);
        
        assertEq(uint8(status), uint8(CoveragePool.ClaimStatus.Approved));
        assertEq(payoutAmount, 100 ether);
    }
    
    function testRejectClaim() public {
        uint256 claimId = _submitClaim();
        
        vm.prank(claimsAdjuster);
        coveragePool.reviewClaim(claimId, 20);
        
        vm.prank(claimsAdjuster);
        coveragePool.rejectClaim(claimId, "Insufficient evidence");
        
        (, , , , CoveragePool.ClaimStatus status, , ) = coveragePool.getClaim(claimId);
        assertEq(uint8(status), uint8(CoveragePool.ClaimStatus.Rejected));
    }
    
    function testExecutePayout() public {
        uint256 claimId = _createApprovedClaim();
        
        uint256 balanceBefore = coverageToken.balanceOf(insured1);
        
        coveragePool.executePayout(claimId);
        
        uint256 balanceAfter = coverageToken.balanceOf(insured1);
        assertEq(balanceAfter - balanceBefore, 100 ether);
    }
    
    function testExecutePayoutOnlyApproved() public {
        uint256 claimId = _submitClaim();
        
        vm.expectRevert("Not approved");
        coveragePool.executePayout(claimId);
    }
    
    // ============ Risk Assessment ============
    
    function testAssessProtocolRisk() public {
        vm.prank(riskManager);
        coveragePool.assessProtocolRisk(protocol, CoveragePool.RiskTier.High);
        
        (, , , CoveragePool.RiskTier tier) = coveragePool.getProtocolRisk(protocol);
        assertEq(uint8(tier), uint8(CoveragePool.RiskTier.High));
    }
    
    function testCalculatePremium() public {
        (uint256 premium, ) = coveragePool.calculatePremium(
            protocol,
            1000 ether,
            365 days
        );
        
        // Medium tier = 250 bps = 2.5%
        // 1000 * 0.025 = 25 ether
        assertEq(premium, 25 ether);
    }
    
    // ============ Pool Management ============
    
    function testDepositToPool() public {
        coverageToken.mint(address(this), 1000 ether);
        coverageToken.approve(address(coveragePool), 1000 ether);
        
        coveragePool.depositToPool(1000 ether);
        
        (uint256 poolValue, , , , , , ) = coveragePool.getPoolStats();
        assertEq(poolValue, 1_001_000 ether); // Initial 1M + 1000
    }
    
    function testWithdrawFromPool() public {
        coveragePool.withdrawFromPool(100 ether);
        
        (uint256 poolValue, , , , , , ) = coveragePool.getPoolStats();
        assertEq(poolValue, 999_900 ether);
    }
    
    // ============ View Functions ============
    
    function testGetPoolStats() public {
        _createPolicy();
        
        (uint256 poolValue, uint256 premiums, , uint256 deployed, , uint256 totalPolicies, uint256 activePolicies) = 
            coveragePool.getPoolStats();
        
        assertEq(poolValue, 1_000_000 ether);
        assertEq(premiums, 25 ether); // From policy creation
        assertEq(deployed, 1000 ether); // Coverage amount
        assertEq(totalPolicies, 1);
        assertEq(activePolicies, 1);
    }
    
    // ============ Helpers ============
    
    function _createPolicy() internal returns (uint256) {
        vm.prank(insured1);
        coverageToken.approve(address(coveragePool), 10_000 ether);
        
        vm.prank(insured1);
        return coveragePool.createPolicy(
            protocol,
            insured1,
            1000 ether,
            30 days
        );
    }
    
    function _submitClaim() internal returns (uint256) {
        uint256 policyId = _createPolicy();
        
        vm.prank(insured1);
        return coveragePool.submitClaim(
            policyId,
            100 ether,
            "Test claim",
            keccak256("evidence")
        );
    }
    
    function _createApprovedClaim() internal returns (uint256) {
        uint256 claimId = _submitClaim();
        
        vm.prank(claimsAdjuster);
        coveragePool.reviewClaim(claimId, 80);
        
        vm.prank(claimsAdjuster);
        coveragePool.approveClaim(claimId, 100 ether);
        
        return claimId;
    }
}
