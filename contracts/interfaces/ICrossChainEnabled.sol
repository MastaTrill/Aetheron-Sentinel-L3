// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface CrossChainEnabled {
    function crossChainCall(uint256 _chainId) external payable;
}
