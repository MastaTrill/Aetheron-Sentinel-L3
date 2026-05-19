// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import 'forge-std/Script.sol';
import { AetheronBridge } from '../../contracts/AetheronBridge.sol';

contract AetheronBridgeDeploy is Script {
  function run() external {
    uint256 pk = vm.envUint('OWNER_PRIVATE_KEY');
    vm.startBroadcast(pk);

    AetheronBridge bridge = new AetheronBridge(vm.addr(pk));
    console2.log('AetheronBridge', address(bridge));

    vm.stopBroadcast();
  }
}
