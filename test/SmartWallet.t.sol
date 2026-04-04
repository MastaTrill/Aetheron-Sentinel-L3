// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/wallet/SmartWallet.sol";

contract SmartWalletTest is Test {
    SmartWallet public wallet;
    
    address public owner = address(0x1);
    address public sessionKey = address(0x2);
    address public guardian = address(0x3);
    address public other = address(0x4);
    
    function setUp() public {
        wallet = new SmartWallet();
        
        // Transfer ownership to our test owner
        wallet.grantRole(wallet.DEFAULT_ADMIN_ROLE(), owner);
    }
    
    // ============ Session Keys ============
    
    function testCreateSessionKey() public {
        vm.prank(owner);
        bytes32 sessionId = wallet.createSessionKey(
            sessionKey,
            10 ether,
            7 days,
            bytes32(1) // permissions
        );
        
        assertTrue(sessionId != bytes32(0));
        
        (address key, uint256 limit, , uint256 validUntil, bool isActive) = 
            wallet.getSessionKeyInfo(sessionId);
        
        assertEq(key, sessionKey);
        assertEq(limit, 10 ether);
        assertTrue(isActive);
        assertEq(validUntil, block.timestamp + 7 days);
    }
    
    function testCreateSessionKeyInvalidLimit() public {
        vm.prank(owner);
        vm.expectRevert("Invalid limit");
        wallet.createSessionKey(
            sessionKey,
            0, // Invalid limit
            7 days,
            bytes32(1)
        );
    }
    
    function testCreateSessionKeyInvalidDuration() public {
        vm.prank(owner);
        vm.expectRevert("Invalid duration");
        wallet.createSessionKey(
            sessionKey,
            10 ether,
            0, // Invalid duration
            bytes32(1)
        );
    }
    
    function testRevokeSessionKey() public {
        vm.prank(owner);
        bytes32 sessionId = wallet.createSessionKey(
            sessionKey,
            10 ether,
            7 days,
            bytes32(1)
        );
        
        vm.prank(owner);
        wallet.revokeSessionKey(sessionId);
        
        (, , , , bool isActive) = wallet.getSessionKeyInfo(sessionId);
        assertFalse(isActive);
    }
    
    function testUpdateSessionLimit() public {
        vm.prank(owner);
        bytes32 sessionId = wallet.createSessionKey(
            sessionKey,
            10 ether,
            7 days,
            bytes32(1)
        );
        
        vm.prank(owner);
        wallet.updateSessionLimit(sessionId, 20 ether);
        
        (address key, uint256 limit, , , ) = wallet.getSessionKeyInfo(sessionId);
        assertEq(limit, 20 ether);
    }
    
    // ============ Transaction Execution ============
    
    function testExecuteTransaction() public {
        // Create session key first
        vm.prank(owner);
        bytes32 sessionId = wallet.createSessionKey(
            sessionKey,
            10 ether,
            7 days,
            bytes32(1)
        );
        
        // Fund wallet
        vm.deal(address(wallet), 100 ether);
        
        // Execute via session key
        vm.prank(sessionKey);
        (bool success, ) = wallet.executeTransaction{value: 0}(other, 1 ether, "");
        
        assertTrue(success);
        assertEq(other.balance, 1 ether);
    }
    
    function testExecuteTransactionExceedsLimit() public {
        vm.prank(owner);
        bytes32 sessionId = wallet.createSessionKey(
            sessionKey,
            0.5 ether, // 0.5 ETH limit
            7 days,
            bytes32(1)
        );
        
        vm.deal(address(wallet), 100 ether);
        
        vm.prank(sessionKey);
        vm.expectRevert("Exceeds tx limit");
        wallet.executeTransaction{value: 0}(other, 1 ether, "");
    }
    
    function testExecuteTransactionDailyLimit() public {
        // Set daily limit
        vm.prank(owner);
        wallet.updateConfig(5 ether, 1 ether, 2);
        
        vm.deal(address(wallet), 100 ether);
        
        // First tx should succeed
        vm.prank(owner);
        (bool success1, ) = wallet.executeTransaction{value: 0}(other, 1 ether, "");
        assertTrue(success1);
        
        // Second tx should fail (would exceed daily limit)
        vm.prank(owner);
        vm.expectRevert("Daily limit exceeded");
        wallet.executeTransaction{value: 0}(other, 5 ether, "");
    }
    
    function testExecuteBatch() public {
        vm.deal(address(wallet), 100 ether);
        
        address[] memory targets = new address[](2);
        targets[0] = other;
        targets[1] = address(0x5);
        
        uint256[] memory values = new uint256[](2);
        values[0] = 1 ether;
        values[1] = 2 ether;
        
        bytes[] memory datas = new bytes[](2);
        
        vm.prank(owner);
        bool[] memory successes = wallet.executeBatch{value: 0}(targets, values, datas);
        
        assertTrue(successes[0]);
        assertTrue(successes[1]);
        assertEq(other.balance, 1 ether);
        assertEq(address(0x5).balance, 2 ether);
    }
    
    // ============ Guardian Management ============
    
    function testAddGuardian() public {
        vm.prank(owner);
        wallet.addGuardian(guardian, 1);
        
        (address[] memory guardians) = wallet.getGuardians(owner);
        
        assertEq(guardians.length, 1);
        assertEq(guardians[0].guardian, guardian);
    }
    
    function testAddDuplicateGuardian() public {
        vm.prank(owner);
        wallet.addGuardian(guardian, 1);
        
        vm.prank(owner);
        vm.expectRevert("Already a guardian");
        wallet.addGuardian(guardian, 1);
    }
    
    function testRemoveGuardian() public {
        vm.prank(owner);
        wallet.addGuardian(guardian, 1);
        
        vm.prank(owner);
        wallet.removeGuardian(guardian);
        
        (address[] memory guardians) = wallet.getGuardians(owner);
        assertEq(guardians.length, 0);
    }
    
    // ============ Social Recovery ============
    
    function testInitiateSocialRecovery() public {
        vm.prank(guardian);
        wallet.initiateSocialRecovery(other);
        
        assertEq(wallet.pendingNewOwner(), other);
        assertEq(wallet.recoveryUnlockTime(), block.timestamp + 48 hours);
    }
    
    function testInitiateSocialRecoveryNotGuardian() public {
        vm.prank(other);
        vm.expectRevert();
        wallet.initiateSocialRecovery(other);
    }
    
    function testCompleteSocialRecoveryTooEarly() public {
        vm.prank(guardian);
        wallet.initiateSocialRecovery(other);
        
        vm.prank(other);
        vm.expectRevert("Too early");
        wallet.completeSocialRecovery();
    }
    
    function testCompleteSocialRecovery() public {
        vm.prank(guardian);
        wallet.initiateSocialRecovery(other);
        
        // Warp past delay
        vm.warp(block.timestamp + 49 hours);
        
        vm.prank(other);
        wallet.completeSocialRecovery();
        
        assertEq(wallet.pendingNewOwner(), address(0));
    }
    
    // ============ Module Support ============
    
    function testAuthorizeModule() public {
        address module = address(0x1234);
        
        vm.prank(owner);
        wallet.authorizeModule(module, true);
        
        assertTrue(wallet.authorizedModules(module));
    }
    
    function testAuthorizeModuleToggle() public {
        address module = address(0x1234);
        
        vm.prank(owner);
        wallet.authorizeModule(module, true);
        
        vm.prank(owner);
        wallet.authorizeModule(module, false);
        
        assertFalse(wallet.authorizedModules(module));
    }
    
    // ============ Configuration ============
    
    function testUpdateConfig() public {
        vm.prank(owner);
        wallet.updateConfig(50 ether, 10 ether, 3);
        
        // Check config was updated (would need getter functions in real contract)
    }
    
    function testToggleGasless() public {
        assertTrue(wallet.config().gaslessEnabled);
        
        vm.prank(owner);
        wallet.toggleGasless();
        
        assertFalse(wallet.config().gaslessEnabled);
    }
    
    function testToggleMultiSig() public {
        assertFalse(wallet.config().multiSigEnabled);
        
        vm.prank(owner);
        wallet.toggleMultiSig();
        
        assertTrue(wallet.config().multiSigEnabled);
    }
    
    // ============ Token Management ============
    
    function testTransferERC20() public {
        // This would test ERC20 transfer
        // Requires mock token
    }
    
    // ============ ETH Reception ============
    
    function testReceiveETH() public {
        vm.deal(address(0x5), 10 ether);
        
        vm.prank(address(0x5));
        (bool success, ) = address(wallet).call{value: 5 ether}("");
        
        assertTrue(success);
        assertEq(address(wallet).balance, 5 ether);
    }
}
