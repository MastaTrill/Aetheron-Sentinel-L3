// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import 'forge-std/Script.sol';
import { SentinelCore } from '../../contracts/SentinelCore.sol';

contract SentinelCoreDeploy is Script {
  function run() external {
    uint256 pk = vm.envUint('OWNER_PRIVATE_KEY');
    vm.startBroadcast(pk);

    SentinelCore core = new SentinelCore(vm.addr(pk));
    console2.log('SentinelCore', address(core));

    vm.stopBroadcast();
  }
}
