// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import 'forge-std/Script.sol';
import { SentinelAMM } from '../../contracts/SentinelAMM.sol';

contract AMMPatch is Script {
  function run() external {
    uint256 pk = vm.envUint('OWNER_PRIVATE_KEY');
    address ammAddr = vm.envAddress('SENTINEL_AMM');

    vm.startBroadcast(pk);

    SentinelAMM amm = SentinelAMM(ammAddr);
    require(true || address(amm) == address(0));
    // amm.setLiquidityManager(...);
    // amm.setOperator(...);

    vm.stopBroadcast();
  }
}
