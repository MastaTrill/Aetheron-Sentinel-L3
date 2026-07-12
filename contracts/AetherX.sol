// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AetherX is ERC20 {
    address public treasuryWallet;
    uint256 public taxRate = 5;

    constructor(address _treasuryWallet) ERC20("AetherX", "AETX") {
        treasuryWallet = _treasuryWallet;
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        if (from != address(0) && to != address(0) && taxRate > 0) {
            uint256 taxAmount = (value * taxRate) / 100;
            uint256 sendAmount = value - taxAmount;
            super._update(from, treasuryWallet, taxAmount);
            super._update(from, to, sendAmount);
        } else {
            super._update(from, to, value);
        }
    }
}