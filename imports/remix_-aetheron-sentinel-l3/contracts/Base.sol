// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Base {
    uint256 public createdAt;

    constructor() {
        createdAt = block.timestamp;
    }
}
