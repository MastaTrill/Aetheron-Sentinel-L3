// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/EchoLiquidityHolder.sol";

contract SeedLiquidity is Script {
    address payable constant HOLDER = payable(0x0000000000000000000000000000000000000000);
    uint256 constant TOKENS = 1000000000000000000000000000000;
    uint256 constant ETH_AMOUNT = 1000000000000000000;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        EchoLiquidityHolder holder = EchoLiquidityHolder(HOLDER);

        uint256 deadline = block.timestamp + 10 minutes;

        holder.seedLiquidity{value: ETH_AMOUNT}(TOKENS, 0, 0, deadline, false);

        holder.lock();

        vm.stopBroadcast();
    }
}
