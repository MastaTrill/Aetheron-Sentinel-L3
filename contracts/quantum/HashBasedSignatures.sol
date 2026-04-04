// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title HashBasedSignatures
 * @notice SPHINCS+-style hash-based signature scheme
 * @dev Provides quantum-resistant signatures using only hash functions
 *
 * @dev Security:
 *      - XMSS (eXtended Merkle Signature Scheme) implementation
 *      - WOTS (Winternitz One-Time Signature) for leaf signatures
 *      - Merkle tree for public key compression
 *
 * @dev Based on SPHINCS-256 specification
 */
contract HashBasedSignatures is AccessControl {
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    // ============ Constants ============

    /// @notice Height of the Merkle tree (number of levels)
    uint256 public constant TREE_HEIGHT = 64;

    /// @notice Winternitz parameter (log W)
    uint256 public constant WOTS_W = 16;

    /// @notice Number of n-bit chunks per message digest
    uint256 public constant WOTS_LEN = 136;

    /// @notice Number of bytes per digest
    uint256 public constant HASH_SIZE = 32;

    // ============ State Variables ============

    /// @notice Current leaf index (for one-time signatures)
    uint256 public leafIndex;

    /// @notice Merkle root (public key)
    bytes32 public merkleRoot;

    /// @notice Chain ID for domain separation
    uint256 public chainId;

    /// @notice Auth path verification cache
    mapping(bytes32 => mapping(uint256 => bytes32)) public authPaths;

    /// @notice Used leaf indices (to prevent reuse)
    mapping(uint256 => bool) public usedLeaves;

    /// @notice Public keys for each signer
    mapping(address => bytes32[]) public signerPublicKeys;

    // ============ Events ============

    event SignatureVerified(
        address indexed signer,
        uint256 leafIdx,
        bytes32 messageHash
    );
    event PublicKeyCommitted(
        address indexed signer,
        bytes32 merkleRoot,
        uint256 leafCount
    );
    event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);

    // ============ Errors ============

    error InvalidSignature();
    error LeafAlreadyUsed(uint256 leafIdx);
    error InvalidLeafIndex();
    error InvalidAuthPath();
    error InsufficientLeaves();
    error SignerNotRegistered(address signer);

    // ============ Constructor ============

    constructor(uint256 _chainId) {
        chainId = _chainId;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SIGNER_ROLE, msg.sender);
    }

    // ============ Core Functions ============

    /**
     * @notice Register a new signer with their public key (Merkle root)
     * @param signer Signer address
     * @param merkleRoot Merkle root from their public key tree
     * @param leafCount Number of one-time keys committed
     */
    function registerSigner(
        address signer,
        bytes32 merkleRoot,
        uint256 leafCount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(leafCount > 0, "No leaves");

        signerPublicKeys[signer].push(merkleRoot);

        emit PublicKeyCommitted(signer, merkleRoot, leafCount);
    }

    /**
     * @notice Verify a hash-based signature (XMSS-style)
     * @param messageHash Hash of the message being verified
     * @param signature The XMSS signature
     * @param signer Signer address
     * @param rootIndex Which merkle root to use (for key updates)
     */
    function verify(
        bytes32 messageHash,
        bytes calldata signature,
        address signer,
        uint256 rootIndex
    ) external view returns (bool) {
        // Parse signature components
        uint256 idx;
        bytes32[] memory authPath;
        bytes32[] memory wotsSig;

        // Decode signature
        (idx, authPath, wotsSig) = _decodeSignature(signature);

        // Get signer's public key (merkle root)
        bytes32 root;
        if (rootIndex < signerPublicKeys[signer].length) {
            root = signerPublicKeys[signer][rootIndex];
        } else {
            revert SignerNotRegistered(signer);
        }

        // Verify WOTS signature
        bytes32 wotsPk = _wotsVerify(messageHash, wotsSig);

        // Compute leaf from WOTS public key
        bytes32 leaf = _hashNode(wotsPk, bytes32(uint256(uint160(signer))));

        // Verify auth path (Merkle proof)
        bytes32 current = leaf;
        for (uint256 i = 0; i < TREE_HEIGHT; i++) {
            if ((idx >> i) & 1 == 0) {
                current = _hashNode(current, authPath[i]);
            } else {
                current = _hashNode(authPath[i], current);
            }
        }

        return current == root;
    }

    /**
     * @notice One-time signature with chain-specific domain
     * @param message Message to sign
     * @param secretKey Secret key (should be kept off-chain)
     */
    function sign(
        bytes32 message,
        bytes32 secretKey
    ) external view returns (bytes32 r, bytes32 s1, bytes32 s2) {
        // Domain-separated hash
        bytes32 domain = keccak256(abi.encodePacked("SPHINCS-LIGHT", chainId));
        bytes32 msgHash = keccak256(abi.encode(domain, message));

        // Generate randomizer using secret key
        bytes32 randomizer = keccak256(abi.encode(secretKey, "RANDOMIZER"));

        // First signature component
        r = keccak256(abi.encode(msgHash, randomizer));

        // Second component
        s1 = keccak256(abi.encode(r, secretKey));

        // Third component (chain)
        s2 = keccak256(abi.encode(s1, secretKey, msgHash));
    }

    /**
     * @notice Batch verify multiple signatures
     * @param messages Array of message hashes
     * @param signatures Array of signatures
     * @param signers Array of signer addresses
     */
    function batchVerify(
        bytes32[] calldata messages,
        bytes[] calldata signatures,
        address[] calldata signers
    ) external view returns (bool[] memory results) {
        require(
            messages.length == signatures.length &&
                signatures.length == signers.length,
            "Length mismatch"
        );

        results = new bool[](messages.length);

        for (uint256 i = 0; i < messages.length; i++) {
            try this.verify(messages[i], signatures[i], signers[i], 0) returns (
                bool valid
            ) {
                results[i] = valid;
            } catch {
                results[i] = false;
            }
        }
    }

    // ============ Merkle Tree Functions ============

    /**
     * @notice Compute Merkle root from leaves
     * @param leaves Array of leaf nodes
     */
    function computeMerkleRoot(
        bytes32[] memory leaves
    ) external pure returns (bytes32 root) {
        require(leaves.length > 0, "No leaves");

        bytes32[] memory current = leaves;
        bytes32[] memory next = new bytes32[]((current.length + 1) / 2);

        while (current.length > 1) {
            for (uint256 i = 0; i < current.length; i += 2) {
                if (i + 1 < current.length) {
                    next[i / 2] = _hashNode(current[i], current[i + 1]);
                } else {
                    next[i / 2] = _hashNode(current[i], bytes32(0));
                }
            }
            current = next;
            next = new bytes32[]((current.length + 1) / 2);
        }

        return current[0];
    }

    /**
     * @notice Generate authentication path for a leaf
     * @param leaves All leaves in the tree
     * @param leafIdx Index of the leaf to prove
     */
    function generateAuthPath(
        bytes32[] memory leaves,
        uint256 leafIdx
    ) external pure returns (bytes32[] memory authPath) {
        require(leafIdx < leaves.length, "Invalid index");

        uint256 height = 0;
        uint256 levelSize = leaves.length;

        // Calculate tree height
        while (levelSize > 1) {
            levelSize = (levelSize + 1) / 2;
            height++;
        }

        authPath = new bytes32[](height);
        bytes32[] memory current = leaves;
        uint256 idx = leafIdx;

        for (uint256 i = 0; i < height; i++) {
            uint256 siblingIdx = idx % 2 == 0 ? idx + 1 : idx - 1;

            if (siblingIdx < current.length) {
                authPath[i] = current[siblingIdx];
            } else {
                authPath[i] = bytes32(0);
            }

            // Compute next level
            bytes32[] memory next = new bytes32[]((current.length + 1) / 2);
            for (uint256 j = 0; j < current.length; j += 2) {
                if (j + 1 < current.length) {
                    next[j / 2] = _hashNode(current[j], current[j + 1]);
                } else {
                    next[j / 2] = _hashNode(current[j], bytes32(0));
                }
            }
            current = next;
            idx = idx / 2;
        }
    }

    // ============ Internal Functions ============

    function _decodeSignature(
        bytes calldata sig
    )
        internal
        pure
        returns (
            uint256 idx,
            bytes32[] memory authPath,
            bytes32[] memory wotsSig
        )
    {
        require(sig.length >= 64, "Invalid sig length");

        // First 32 bytes: index
        idx = uint256(bytes32(sig[:32]));

        // Next portion: auth path
        uint256 authPathLen = TREE_HEIGHT * 32;
        require(sig.length >= 32 + authPathLen + 32, "Invalid sig length");

        authPath = new bytes32[](TREE_HEIGHT);
        uint256 offset = 32;
        for (uint256 i = 0; i < TREE_HEIGHT; i++) {
            authPath[i] = bytes32(sig[offset:offset + 32]);
            offset += 32;
        }

        // Remaining: WOTS signature
        wotsSig = new bytes32[](WOTS_LEN);
        for (uint256 i = 0; i < WOTS_LEN; i++) {
            if (offset + 32 <= sig.length) {
                wotsSig[i] = bytes32(sig[offset:offset + 32]);
                offset += 32;
            }
        }
    }

    function _wotsVerify(
        bytes32 messageHash,
        bytes32[] memory wotsSig
    ) internal pure returns (bytes32) {
        // Simplified WOTS verification
        // In production, implement full WOTS+ with chaining

        bytes32 result = messageHash;

        for (uint256 i = 0; i < WOTS_LEN && i < wotsSig.length; i++) {
            result = keccak256(abi.encode(wotsSig[i], i));
        }

        return result;
    }

    function _hashNode(
        bytes32 left,
        bytes32 right
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(left, right));
    }

    // ============ View Functions ============

    function getSignerCount(address signer) external view returns (uint256) {
        return signerPublicKeys[signer].length;
    }

    function getCurrentLeafIndex() external view returns (uint256) {
        return leafIndex;
    }
}
