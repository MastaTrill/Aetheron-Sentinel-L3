// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ISentinelQuantumGuard } from '../ISentinelQuantumGuard.sol';

/**
 * @title DilithiumVerifierWrapper
 * @dev Routes signature verification between Dilithium 2 and Dilithium 5
 * based on the current lattice hardness level. Uses precompile at 0x105
 * for Dilithium 5 when hardness >= 2048, otherwise uses internal Dilithium 2 logic.
 */
contract DilithiumVerifierWrapper {
    ISentinelQuantumGuard public immutable s_quantumGuard;
    error InvalidSignature();

    constructor(address quantumGuard) {
        s_quantumGuard = ISentinelQuantumGuard(quantumGuard);
    }

    /**
     * @notice Verifies a system signature using the appropriate Dilithium variant.
     * @param pubKey The public key (32 bytes).
     * @param msgHash The message hash to verify.
     * @param sig The signature bytes.
     * @return True if signature is valid.
     * @dev When hardness >= 2048, routes to Dilithium 5 precompile (0x105).
     *      Otherwise uses internal verification (placeholder for Dilithium 2).
     */
    function verifySystemSignature(
        bytes32 pubKey,
        bytes32 msgHash,
        bytes memory sig
    ) external view returns (bool) {
        uint256 hardness = s_quantumGuard.getHardnessLevel();

        if (hardness >= 2048) {
            // Route to Dilithium 5 precompile at address 0x105
            (bool success, bytes memory result) = address(0x105).staticcall(
                abi.encodeWithSignature("verify(bytes32,bytes32,bytes)", pubKey, msgHash, sig)
            );
            if (!success || !abi.decode(result, (bool))) {
                revert InvalidSignature();
            }
            return true;
        }

        // Dilithium 2 verification - internal placeholder
        // For testing, we revert since real verification logic requires precompile
        revert InvalidSignature();
    }
}