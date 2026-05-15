// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/EchoLiquidityModule.sol";

contract DeployModule is Script {
    address constant ECHO = 0xA4EB2A8226cAB3A43aa06b5F77aC7310797114E2;
    address constant AERO_ROUTER = 0x4200000000000000000000000000000000000001;

    address payable constant HOLDER = payable(0x0000000000000000000000000000000000000000);

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        EchoLiquidityModule module = new EchoLiquidityModule(ECHO, HOLDER, AERO_ROUTER);

        vm.stopBroadcast();

        console2.log("EchoLiquidityModule:", address(module));
    }
}
