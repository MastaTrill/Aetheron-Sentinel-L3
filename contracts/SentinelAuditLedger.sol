// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SentinelAuditLedger
 * @notice Immutable on-chain ledger for recording cryptographic SHA-256 evidence proofs of intercepted security events.
 */
contract SentinelAuditLedger is Ownable {
    struct ProofRecord {
        bytes32 incidentId;
        bytes32 proofHash;
        uint256 valueSavedEth;
        uint256 timestamp;
        string metadataUri;
        bool exists;
    }

    mapping(bytes32 => ProofRecord) public proofs;
    bytes32[] public allIncidentIds;
    uint256 public totalValueSavedEth;

    event ProofRecorded(
        bytes32 indexed incidentId,
        bytes32 indexed proofHash,
        uint256 valueSavedEth,
        uint256 timestamp
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Record a cryptographic evidence proof on-chain
     */
    function recordProof(
        bytes32 incidentId,
        bytes32 proofHash,
        uint256 valueSavedEth,
        string calldata metadataUri
    ) external onlyOwner {
        require(incidentId != bytes32(0), "Invalid incident ID");
        require(proofHash != bytes32(0), "Invalid proof hash");
        require(!proofs[incidentId].exists, "Proof already recorded for this incident");

        proofs[incidentId] = ProofRecord({
            incidentId: incidentId,
            proofHash: proofHash,
            valueSavedEth: valueSavedEth,
            timestamp: block.timestamp,
            metadataUri: metadataUri,
            exists: true
        });

        allIncidentIds.push(incidentId);
        totalValueSavedEth += valueSavedEth;

        emit ProofRecorded(incidentId, proofHash, valueSavedEth, block.timestamp);
    }

    /**
     * @notice Get total number of recorded incident proofs
     */
    function getProofCount() external view returns (uint256) {
        return allIncidentIds.length;
    }
}
