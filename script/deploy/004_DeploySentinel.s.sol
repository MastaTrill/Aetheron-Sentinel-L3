// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script } from 'forge-std/Script.sol';
import { LiquidityVault } from 'contracts/treasury/LiquidityVault.sol';

contract DeploySentinel is Script {
  function run() external {
    uint256 deployerPrivateKey = vm.envUint('PRIVATE_KEY');
    vm.startBroadcast(deployerPrivateKey);

    // Replace with your actual pool address
    // e.g., Aerodrome ECHO/WETH: 0x2dCDEA8a708f1FDECA5e2E59d4cb70Bd2E9BdEC8
    address pool = 0x2dCDEA8a708f1FDECA5e2E59d4cb70Bd2E9BdEC8;
    address owner = 0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB;

    new LiquidityVault(pool, owner);

    vm.stopBroadcast();
  }
}
