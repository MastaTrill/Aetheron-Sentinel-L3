 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.0;

 /// Minimal compatibility stub for OApp used by SentinelCoreLoop.sol
 /// This stub provides the constructor signature so inheritance/constructor call resolves.
 abstract contract OApp {
     constructor(address _endpoint, address _owner) {}
 }
