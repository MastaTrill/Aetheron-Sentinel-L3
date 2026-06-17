// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import 'forge-std/Test.sol';
import '../contracts/SentinelAMM.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract MockToken is ERC20 {
  constructor(string memory name, string memory symbol) ERC20(name, symbol) {
    _mint(msg.sender, 1000000 * 10 ** 18);
  }
}

contract SentinelAMMTest is Test {
  SentinelAMM public amm;
  MockToken public token0;
  MockToken public token1;
  address public owner = address(0xA1B);
  address public user = address(0x123);

  function setUp() public {
    amm = new SentinelAMM(owner);
    token0 = new MockToken('Token 0', 'TK0');
    token1 = new MockToken('Token 1', 'TK1');

    vm.startPrank(owner);
    // Create a 0.3% fee pool (Index 2 in feeTiers)
    uint256 poolId = amm.createPool(address(token0), address(token1), 2);

    token0.approve(address(amm), type(uint256).max);
    token1.approve(address(amm), type(uint256).max);

    // Initial liquidity: 10,000 of each
    amm.addQuantumLiquidity(poolId, 10000e18, 10000e18, 0, 2e18, false);
    vm.stopPrank();
  }

  function testSwapFeeApplication() public {
    uint256 swapAmount = 1000e18;
    uint256 expectedFee = (swapAmount * 30) / 10000; // 0.3% is 3 tokens
    uint256 amountInAfterFee = swapAmount - expectedFee;

    // Calculate expected output: (997 * 10000) / (10000 + 997)
    uint256 expectedOut = (amountInAfterFee * 10000e18) / (10000e18 + amountInAfterFee);

    deal(address(token0), user, swapAmount);
    vm.startPrank(user);
    token0.approve(address(amm), swapAmount);

    uint256 balanceBefore = token1.balanceOf(user);
    uint256 actualOut = amm.executeQuantumSwap(2, address(token0), swapAmount, 0);
    uint256 balanceAfter = token1.balanceOf(user);

    assertEq(actualOut, expectedOut, 'Output amount mismatch');
    assertEq(balanceAfter - balanceBefore, actualOut, 'Balance mismatch');

    // Verify fee collection state
    assertEq(amm.totalFeesCollected(), expectedFee, 'Total fees mismatch');
    vm.stopPrank();
  }
}
