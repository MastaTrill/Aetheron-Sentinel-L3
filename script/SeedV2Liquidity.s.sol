// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/EchoV2LiquidityModule.sol";

contract SeedV2Liquidity is Script {
    function run() external {
        vm.startBroadcast();

        EchoV2LiquidityModule module =
            EchoV2LiquidityModule(0x420B3d4Ba88387Fb128D1cc7f317040C135EcEEB);

        uint256 amountTokenDesired = 100_000e18;
        uint256 amountWethDesired = 0.1 ether;

        module.seedLiquidityVolatile(amountTokenDesired, amountWethDesired);

        vm.stopBroadcast();
    }
}
