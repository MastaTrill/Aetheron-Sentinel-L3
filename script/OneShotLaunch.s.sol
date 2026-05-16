// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/EchoV2LiquidityModule.sol";

interface IWETH {
    function deposit() external payable;
    function transfer(address to, uint256 value) external returns (bool);
}

contract OneShotLaunch is Script {
    address constant TOKEN = 0xA4EB2A8226cAB3A43aa06b5F77aC7310797114E2;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant FACTORY = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da;
    address constant MODULE = 0x0F0ceDE2349c53A20A6c7f1F28e9e84cE9d8c2cd;
    address constant OWNER = 0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB;
    address constant LOCKER = 0x000000000000000000000000000000000000dEaD;

    function run() external {
        vm.startBroadcast();

        IERC20 token = IERC20(TOKEN);
        IWETH weth = IWETH(WETH);
        EchoV2LiquidityModule module = EchoV2LiquidityModule(MODULE);

        uint256 amountTokenDesired = 3_000e18;
        uint256 amountETHDesired = 0.00015 ether;

        // 1) Send TOKEN to module
        require(token.transfer(MODULE, amountTokenDesired), "token transfer failed");

        // 2) Wrap ETH -> WETH, send WETH to module
        weth.deposit{value: amountETHDesired}();
        require(weth.transfer(MODULE, amountETHDesired), "weth transfer failed");

        // 3) Module seeds volatile TOKEN/WETH liquidity directly into the pair
        module.seedLiquidityVolatile(amountTokenDesired, amountETHDesired);

        vm.stopBroadcast();
    }
}
