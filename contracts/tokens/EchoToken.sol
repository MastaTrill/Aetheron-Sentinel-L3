// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import { ERC20Capped } from '@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol';
import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';

contract EchoToken is ERC20Capped, Ownable {
    constructor(address initialOwner, uint256 cap) ERC20Capped(cap) ERC20('Cosmic Echo', 'ECHO') Ownable(initialOwner) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
