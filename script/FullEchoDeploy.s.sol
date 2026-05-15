// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/EchoLiquidityHolder.sol";
import "../src/IEchoToken.sol";

contract FullEchoDeploy is Script {
    address constant ECHO = 0xA4EB2A8226cAB3A43aa06b5F77aC7310797114E2;
    address constant AERO_ROUTER = 0x4200000000000000000000000000000000000001;
    address payable constant OLD_HOLDER = payable(0x3d865Ef386F74f4cA42B4569eC61c25eeba037b0);

    uint256 constant TOKENS = 1000000000000000000000000000000;
    uint256 constant ETH_AMOUNT = 1000000000000000000;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        IEchoToken token = IEchoToken(ECHO);

        EchoLiquidityHolder holder = new EchoLiquidityHolder(ECHO, AERO_ROUTER);
        console2.log("New holder:", address(holder));

        uint256 stuck = token.balanceOf(OLD_HOLDER);
        token.mint(address(holder), stuck);

        uint256 deadline = block.timestamp + 10 minutes;

        holder.seedLiquidity{value: ETH_AMOUNT}(TOKENS, 0, 0, deadline, false);

        holder.lock();

        vm.stopBroadcast();
    }
}
