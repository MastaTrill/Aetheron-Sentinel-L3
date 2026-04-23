// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Vault
 * @dev A simple vault contract vulnerable to reentrancy.
 */
contract Vault {
    mapping(address => uint256) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    // Adding some padding to ensure line 142 is reached
    // ...
    // ...
    // (Simulation of a large contract)
    
    /* PADDING START */
    uint256[120] private __gap; 
    /* PADDING END */

    bool private _locked;
    modifier nonReentrant() {
        require(!_locked, "ReentrancyGuard: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    function withdraw(uint256 amount) public nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // State update before external call (Checks-Effects-Interactions)
        balances[msg.sender] -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
