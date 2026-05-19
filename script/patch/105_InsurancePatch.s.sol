// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import 'forge-std/Script.sol';
import { SentinelInsuranceProtocol } from '../../contracts/SentinelInsuranceProtocol.sol';

contract InsurancePatch is Script {
  function run() external {
    uint256 pk = vm.envUint('OWNER_PRIVATE_KEY');
    address insuranceAddr = vm.envAddress('SENTINEL_INSURANCE_PROTOCOL');

    vm.startBroadcast(pk);

    SentinelInsuranceProtocol insurance = SentinelInsuranceProtocol(insuranceAddr);
    // Example: set up claims manager, operator, etc.
    // insurance.setClaimsManager(...);
    // insurance.setOperator(...);

    vm.stopBroadcast();
  }
}
