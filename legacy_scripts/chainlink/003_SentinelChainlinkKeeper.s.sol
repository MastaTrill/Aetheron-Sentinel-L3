// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// HISTORICAL ONLY.
// This script depends on the deprecated sentinel-l3-v1.0 tree and must not be
// used by active release workflows.

import 'forge-std/Script.sol';
import { SentinelChainlinkKeeper } from '../../sentinel-l3-v1.0/contracts/SentinelChainlinkKeeper.sol';
import { SentinelCore } from '../../sentinel-l3-v1.0/contracts/SentinelCore.sol';

contract SentinelChainlinkKeeperDeploy is Script {
  function run() external {
    uint256 pk = vm.envUint('OWNER_PRIVATE_KEY');
    vm.startBroadcast(pk);

    SentinelCore core = SentinelCore(payable(vm.envAddress('SENTINEL_CORE_ADDRESS')));
    SentinelChainlinkKeeper keeper = new SentinelChainlinkKeeper(address(core));

    console2.log('SentinelChainlinkKeeper', address(keeper));
    console2.log('SentinelCore', address(core));

    vm.stopBroadcast();
  }
}
