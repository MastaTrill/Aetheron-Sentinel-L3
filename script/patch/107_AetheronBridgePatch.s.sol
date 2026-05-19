// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import 'forge-std/Script.sol';
import { AetheronBridge } from '../../contracts/AetheronBridge.sol';

contract AetheronBridgePatch is Script {
  function run() external {
    uint256 pk = vm.envUint('OWNER_PRIVATE_KEY');
    address bridgeAddr = vm.envAddress('AETHERON_BRIDGE');

    vm.startBroadcast(pk);

    AetheronBridge bridge = AetheronBridge(bridgeAddr);
    // Example: set up relayers, operator, etc.
    // bridge.setRelayer(...);
    // bridge.setOperator(...);

    vm.stopBroadcast();
  }
}
