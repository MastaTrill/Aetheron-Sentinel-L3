// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import {EchoV2LiquidityModule} from "src/EchoV2LiquidityModule.sol";

contract DeployLiquidity is Script {
    function run() external {
        vm.startBroadcast();

        address token = 0xA4EB2A8226cAB3A43aa06b5F77aC7310797114E2;
        address weth = 0x4200000000000000000000000000000000000006;
        address factory = 0x4200000000000000000000000000000000000001;
        address owner = 0xA4737aa4b1E8a3C8f221BE9E55F5BDa307eCC1Fa;

        new EchoV2LiquidityModule(token, weth, factory, owner);

        vm.stopBroadcast();
    }
}
