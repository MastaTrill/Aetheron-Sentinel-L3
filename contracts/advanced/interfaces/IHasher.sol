// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IHasher {
    function pedersen(bytes32 a, bytes32 b) external pure returns (bytes32);
}
