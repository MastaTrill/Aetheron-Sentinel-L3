// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/IEchoToken.sol";

contract MigrateEchoSupply is Script {
    address constant ECHO = 0xA4EB2A8226cAB3A43aa06b5F77aC7310797114E2;
    address payable constant OLD_HOLDER = payable(0x3d865Ef386F74f4cA42B4569eC61c25eeba037b0);
    address payable constant NEW_HOLDER = payable(0x0000000000000000000000000000000000000000);

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        IEchoToken token = IEchoToken(ECHO);

        uint256 stuck = token.balanceOf(OLD_HOLDER);
        token.mint(NEW_HOLDER, stuck);

        vm.stopBroadcast();

        console2.log("Migrated:", stuck);
    }
}
