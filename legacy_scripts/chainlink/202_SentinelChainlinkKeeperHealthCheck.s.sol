// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// HISTORICAL ONLY.
// This script depends on the deprecated sentinel-l3-v1.0 tree and must not be
// used by active release workflows.

import 'forge-std/Script.sol';
import { SentinelChainlinkKeeper } from '../../sentinel-l3-v1.0/contracts/SentinelChainlinkKeeper.sol';

contract SentinelChainlinkKeeperHealthCheck is Script {
  function run() external view {
    address keeperAddr = vm.envAddress('SENTINEL_CHAINLINK_KEEPER');
    address coreAddr = vm.envAddress('SENTINEL_CORE');

    require(address(SentinelChainlinkKeeper(keeperAddr).sentinelCore()) == coreAddr, 'Keeper: core mismatch');
    require(SentinelChainlinkKeeper(keeperAddr).owner() != address(0), 'Keeper: owner not set');
    require(SentinelChainlinkKeeper(keeperAddr).upkeepInterval() > 0, 'Keeper: interval not set');

    console2.log('SentinelChainlinkKeeper health check passed');
  }
}
