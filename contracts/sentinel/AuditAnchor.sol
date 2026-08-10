// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AuditAnchor
 * @notice Immutable on-chain cryptographic anchor for DeFAI TEE Attestation Envelopes.
 * @dev Records SHA-256 / keccak256 digests of TEE execution envelopes with anti-replay guarantees.
 */
contract AuditAnchor is Ownable, Pausable, ReentrancyGuard {
    struct AnchorRecord {
        bytes32 envelopeHash;
        address submitter;
        uint256 timestamp;
        uint256 blockNumber;
        bool exists;
    }

    mapping(bytes32 => AnchorRecord) private _anchors;
    bytes32[] private _allHashes;

    event AnchorRecorded(
        bytes32 indexed envelopeHash,
        address indexed submitter,
        uint256 timestamp,
        uint256 blockNumber
    );

    event AnchorBatchRecorded(
        bytes32 indexed batchRoot,
        uint256 count,
        address indexed submitter,
        uint256 timestamp
    );

    error InvalidEnvelopeHash();
    error DuplicateEnvelopeHash(bytes32 envelopeHash);
    error EmptyBatch();
    error BatchTooLarge(uint256 size, uint256 max);

    uint256 public constant MAX_BATCH_SIZE = 100;

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Record a single TEE attestation envelope hash on-chain.
     * @param envelopeHash The 32-byte cryptographic hash of the TEE envelope.
     */
    function recordHash(bytes32 envelopeHash) external whenNotPaused nonReentrant {
        if (envelopeHash == bytes32(0)) revert InvalidEnvelopeHash();
        if (_anchors[envelopeHash].exists) revert DuplicateEnvelopeHash(envelopeHash);

        _anchors[envelopeHash] = AnchorRecord({
            envelopeHash: envelopeHash,
            submitter: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number,
            exists: true
        });

        _allHashes.push(envelopeHash);

        emit AnchorRecorded(envelopeHash, msg.sender, block.timestamp, block.number);
    }

    /**
     * @notice Record a batch of TEE attestation envelope hashes in a single transaction.
     * @param hashes Array of 32-byte envelope hashes.
     */
    function recordHashBatch(bytes32[] calldata hashes) external whenNotPaused nonReentrant {
        uint256 len = hashes.length;
        if (len == 0) revert EmptyBatch();
        if (len > MAX_BATCH_SIZE) revert BatchTooLarge(len, MAX_BATCH_SIZE);

        bytes32 accumulatedRoot = bytes32(0);

        for (uint256 i = 0; i < len; i++) {
            bytes32 h = hashes[i];
            if (h == bytes32(0)) revert InvalidEnvelopeHash();
            if (_anchors[h].exists) revert DuplicateEnvelopeHash(h);

            _anchors[h] = AnchorRecord({
                envelopeHash: h,
                submitter: msg.sender,
                timestamp: block.timestamp,
                blockNumber: block.number,
                exists: true
            });

            _allHashes.push(h);

            emit AnchorRecorded(h, msg.sender, block.timestamp, block.number);
            accumulatedRoot = keccak256(abi.encodePacked(accumulatedRoot, h));
        }

        emit AnchorBatchRecorded(accumulatedRoot, len, msg.sender, block.timestamp);
    }

    /**
     * @notice Check whether a given envelope hash has been anchored.
     */
    function isHashAnchored(bytes32 envelopeHash) external view returns (bool) {
        return _anchors[envelopeHash].exists;
    }

    /**
     * @notice Retrieve the full record for an anchored envelope hash.
     */
    function getAnchor(bytes32 envelopeHash) external view returns (AnchorRecord memory) {
        return _anchors[envelopeHash];
    }

    /**
     * @notice Total number of anchored envelope hashes.
     */
    function getTotalAnchors() external view returns (uint256) {
        return _allHashes.length;
    }

    /**
     * @notice Retrieve paginated list of anchored hashes.
     */
    function getAnchoredHashes(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        uint256 total = _allHashes.length;
        if (offset >= total) return new bytes32[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        bytes32[] memory result = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = _allHashes[i];
        }
        return result;
    }

    /**
     * @notice Pause anchoring in an emergency.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume anchoring.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
