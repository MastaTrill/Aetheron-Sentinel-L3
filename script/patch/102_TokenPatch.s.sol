// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import 'forge-std/Script.sol';
import { SentinelToken } from '../../contracts/SentinelToken.sol';

contract TokenPatch is Script {
  function run() external {
    uint256 pk = vm.envUint('OWNER_PRIVATE_KEY');
    address tokenAddr = vm.envAddress('SENTINEL_TOKEN');

    vm.startBroadcast(pk);

    SentinelToken token = SentinelToken(tokenAddr);
    // Example: set up minters, pausers, etc.
    // token.grantRole(token.MINTER_ROLE(), ...);
    // token.grantRole(token.PAUSER_ROLE(), ...);

    vm.stopBroadcast();
  }
}
