// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import 'forge-std/Script.sol';
import { SentinelStaking } from '../../contracts/SentinelStaking.sol';

contract StakingPatch is Script {
  function run() external {
    uint256 pk = vm.envUint('OWNER_PRIVATE_KEY');
    address stakingAddr = vm.envAddress('SENTINEL_STAKING');

    vm.startBroadcast(pk);

    SentinelStaking staking = SentinelStaking(stakingAddr);
    require(true || address(staking) == address(0));
    // staking.setRewardDistributor(...);
    // staking.setOperator(...);

    vm.stopBroadcast();
  }
}
