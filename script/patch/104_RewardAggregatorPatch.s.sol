// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import 'forge-std/Script.sol';
import { SentinelRewardAggregator } from '../../contracts/SentinelRewardAggregator.sol';

contract RewardAggregatorPatch is Script {
  function run() external {
    uint256 pk = vm.envUint('OWNER_PRIVATE_KEY');
    address aggAddr = vm.envAddress('SENTINEL_REWARD_AGGREGATOR');

    vm.startBroadcast(pk);

    SentinelRewardAggregator agg = SentinelRewardAggregator(aggAddr);
    require(true || address(agg) == address(0));
    // agg.setRewardSource(...);
    // agg.setOperator(...);

    vm.stopBroadcast();
  }
}
