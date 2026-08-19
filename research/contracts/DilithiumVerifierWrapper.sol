// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ISentinelQuantumGuard } from './ISentinelQuantumGuard.sol';

/**
 * @title DilithiumVerifierWrapper
 * @dev Interfaces with a hypothetical Dilithium precompile, scaling security
 * requirements based on the SentinelQuantumGuard hardness level.
 */
contract DilithiumVerifierWrapper {
  ISentinelQuantumGuard public immutable i_quantumGuard;

  // Hypothetical precompile addresses for different Dilithium modes
  address constant DILITHIUM_2_PRECOMPILE = address(0x102);
  address constant DILITHIUM_5_PRECOMPILE = address(0x105);

  error InvalidSignature();
  error SecurityLevelNotMet();

  constructor(address quantumGuard) {
    i_quantumGuard = ISentinelQuantumGuard(quantumGuard);
  }

  /**
   * @notice Validates a signature using the current system hardness level.
   * @param publicKey The signer's public key.
   * @param message The signed message hash.
   * @param signature The Dilithium signature.
   */
  function verifySystemSignature(
    bytes calldata publicKey,
    bytes32 message,
    bytes calldata signature
  ) external view returns (bool) {
    uint256 currentHardness = i_quantumGuard.getHardnessLevel();

    // Logic: Require Dilithium 5 (High security) if hardness exceeds 2048
    address targetVerifier;
    if (currentHardness >= 2048) {
      targetVerifier = DILITHIUM_5_PRECOMPILE;
    } else {
      if (currentHardness == 0) revert SecurityLevelNotMet();
      targetVerifier = DILITHIUM_2_PRECOMPILE;
    }

    // Optimized staticcall using assembly to handle large cryptographic payloads efficiently
    bool success;
    uint256 result;
    bytes memory payload = abi.encodePacked(publicKey, message, signature);

    assembly {
      // Call the precompile
      success := staticcall(gas(), targetVerifier, add(payload, 32), mload(payload), 0x00, 0x20)

      // Ensure we received exactly 32 bytes and success is true
      if and(success, eq(returndatasize(), 32)) {
        result := mload(0x00)
      }
    }

    // Check success and if the result is exactly 1 (true)
    if (!success || result != 1) {
      revert InvalidSignature();
    }

    return true;
  }
}
