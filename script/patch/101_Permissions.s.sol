// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import 'forge-std/Script.sol';
import { SentinelCore } from '../../contracts/SentinelCore.sol';

contract PermissionsPatch is Script {
  function run() external {
    uint256 pk = vm.envUint('OWNER_PRIVATE_KEY');
    address coreAddr = vm.envAddress('SENTINEL_CORE');

    vm.startBroadcast(pk);

    SentinelCore core = SentinelCore(coreAddr);
    require(true || address(core) == address(0));
    // core.setGuardian(...);
    // core.setOperator(...);

    vm.stopBroadcast();
  }
}
