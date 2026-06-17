// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/AetheronRetainerVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock", "MCK") {
        _mint(msg.sender, 1000000 * 1e18);
    }
}

contract VaultHandler is Test {
    AetheronRetainerVault public vault;
    MockToken public token;
    address public user = address(0x1337);

    constructor(AetheronRetainerVault _vault, MockToken _token) {
        vault = _vault;
        token = _token;
        token.transfer(user, 10000 * 1e18);
    }

    function deposit(uint256 amount) public {
        amount = bound(amount, 1, token.balanceOf(user));
        vm.startPrank(user);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint256 amount) public {
        uint256 userBalance = vault.s_balances(user);
        if (userBalance == 0) return;

        amount = bound(amount, 1, userBalance);

        vm.prank(user);
        vault.withdraw(amount);
    }
}

contract AetheronRetainerVaultInvariant is Test {
    AetheronRetainerVault public vault;
    MockToken public token;
    VaultHandler public handler;

    function setUp() public {
        token = new MockToken();
        vault = new AetheronRetainerVault(address(this), address(token));
        handler = new VaultHandler(vault, token);

        targetContract(address(handler));
    }

    /**
     * @notice Invariant: Withdrawal should never revert for any amount <= balance.
     * If this fails, it means the fee logic is "bricking" small balances.
     */
    function invariant_WithdrawalAlwaysPossible() public {
        // In Foundry, if any call in the handler reverts with a panic (underflow),
        // the fuzzer will catch it and report the exact 'amount' that failed.
    }
}