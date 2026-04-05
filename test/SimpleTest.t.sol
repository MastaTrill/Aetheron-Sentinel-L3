// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

contract SimpleTest is Test {
    function testSimple() public {
        console.log("Test is working!");
        assertTrue(true);
    }
}