// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SentinelFixedSupply } from "../src/sentinel-replacement/SentinelFixedSupply.sol";
import { SentinelFixedSupplyFactory } from "../src/sentinel-replacement/SentinelFixedSupplyFactory.sol";

contract SentinelFixedSupplyTest {
    SentinelFixedSupply internal token;
    address internal constant RECIPIENT = address(0xBEEF);

    constructor() {
        token = new SentinelFixedSupply(address(this));
    }

    function testInitialSupply() public view {
        require(token.totalSupply() == 1_000_000_000 ether, "supply");
        require(token.balanceOf(address(this)) == token.totalSupply(), "allocation");
    }

    function testTransferConservesSupply() public {
        token.transfer(RECIPIENT, 123 ether);
        require(token.balanceOf(RECIPIENT) == 123 ether, "recipient");
        require(token.totalSupply() == 1_000_000_000 ether, "supply changed");
    }

    function testFactoryRejectsUnauthorizedCaller() public {
        SentinelFixedSupplyFactory factory = new SentinelFixedSupplyFactory(RECIPIENT);
        (bool ok,) = address(factory).call(abi.encodeWithSelector(
            factory.create.selector, 1_000_000_000 ether, RECIPIENT, address(this), bytes32(0), bytes("")
        ));
        require(!ok, "unauthorized caller succeeded");
    }

    function testFactoryRejectsWrongSupply() public {
        SentinelFixedSupplyFactory factory = new SentinelFixedSupplyFactory(address(this));
        (bool ok,) = address(factory).call(abi.encodeWithSelector(
            factory.create.selector, 1 ether, RECIPIENT, address(this), bytes32(0), bytes("")
        ));
        require(!ok, "wrong supply succeeded");
    }

    function testFactoryCreatesExactSupply() public {
        SentinelFixedSupplyFactory factory = new SentinelFixedSupplyFactory(address(this));
        address asset = factory.create(1_000_000_000 ether, RECIPIENT, address(this), bytes32(uint256(1)), "");
        SentinelFixedSupply created = SentinelFixedSupply(asset);
        require(created.totalSupply() == 1_000_000_000 ether, "factory supply");
        require(created.balanceOf(RECIPIENT) == created.totalSupply(), "factory recipient");
    }
}
