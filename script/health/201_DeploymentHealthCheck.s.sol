// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import 'forge-std/Script.sol';
import { SentinelCore } from '../../contracts/SentinelCore.sol';
import { SentinelToken } from '../../contracts/SentinelToken.sol';
import { SentinelStaking } from '../../contracts/SentinelStaking.sol';
import { SentinelRewardAggregator } from '../../contracts/SentinelRewardAggregator.sol';
import { SentinelInsuranceProtocol } from '../../contracts/SentinelInsuranceProtocol.sol';
import { SentinelAMM } from '../../contracts/SentinelAMM.sol';
import { AetheronBridge } from '../../contracts/AetheronBridge.sol';

contract DeploymentHealthCheck is Script {
  function run() external view {
    address coreAddr = vm.envAddress('SENTINEL_CORE');
    address tokenAddr = vm.envAddress('SENTINEL_TOKEN');
    address stakingAddr = vm.envAddress('SENTINEL_STAKING');
    address aggAddr = vm.envAddress('SENTINEL_REWARD_AGGREGATOR');
    address insuranceAddr = vm.envAddress('SENTINEL_INSURANCE_PROTOCOL');
    address ammAddr = vm.envAddress('SENTINEL_AMM');
    address bridgeAddr = vm.envAddress('AETHERON_BRIDGE');

    // SentinelCore: owner must not be zero
    require(SentinelCore(coreAddr).owner() != address(0), 'SentinelCore: owner not set');
    // SentinelToken: owner must not be zero
    require(SentinelToken(tokenAddr).owner() != address(0), 'SentinelToken: owner not set');
    // SentinelStaking: stakingToken must match SentinelToken
    require(
      address(uint160(address(SentinelStaking(stakingAddr).stakingToken()))) == tokenAddr,
      'Staking: stakingToken mismatch'
    );
    // SentinelRewardAggregator: check aggregator address is not zero (customize as needed)
    require(aggAddr != address(0), 'RewardAggregator: address not set');
    // SentinelInsuranceProtocol: core must match SentinelCore
    require(
      SentinelInsuranceProtocol(insuranceAddr).sentinelCore() == coreAddr,
      'Insurance: core mismatch'
    );
    // SentinelAMM: owner must not be zero
    require(SentinelAMM(ammAddr).owner() != address(0), 'AMM: owner not set');
    // AetheronBridge: owner must not be zero
    require(AetheronBridge(bridgeAddr).owner() != address(0), 'AetheronBridge: owner not set');

    // Add more invariants as needed
  }
}
