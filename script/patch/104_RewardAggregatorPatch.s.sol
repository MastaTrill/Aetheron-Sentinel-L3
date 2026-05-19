// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import 'forge-std/Script.sol';
import { SentinelRewardAggregator } from '../../contracts/SentinelRewardAggregator.sol';

contract RewardAggregatorPatch is Script {
  function run() external {
    uint256 pk = vm.envUint('OWNER_PRIVATE_KEY');
    address aggAddr = vm.envAddress('SENTINEL_REWARD_AGGREGATOR');

    vm.startBroadcast(pk);

    SentinelRewardAggregator agg = SentinelRewardAggregator(aggAddr);
    // Example: set up reward sources, operator, etc.
    // agg.setRewardSource(...);
    // agg.setOperator(...);

    vm.stopBroadcast();
  }
}
