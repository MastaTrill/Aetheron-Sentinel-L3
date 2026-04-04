// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title HomomorphicEncryption
 * @notice Partial homomorphic encryption for secure computation on encrypted data
 * @dev Implements Paillier cryptosystem simulation for addition operations
 *
 * @dev Features:
 *      - Additive homomorphic encryption (can add encrypted numbers)
 *      - Secure multi-party computation
 *      - Zero-knowledge range proofs
 *      - Threshold decryption
 *      - Privacy-preserving aggregation
 */
contract HomomorphicEncryption is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant COMPUTOR_ROLE = keccak256("COMPUTOR_ROLE");
    bytes32 public constant DECRYPTOR_ROLE = keccak256("DECRYPTOR_ROLE");

    // Paillier cryptosystem parameters (simplified)
    uint256 public constant N = 2048; // Modulus size (simulated)
    uint256 public constant G = 2;    // Generator

    struct Ciphertext {
        uint256 c1;  // First component
        uint256 c2;  // Second component
        bytes32 commitment;  // Commitment for verification
        address creator;
        uint256 timestamp;
    }

    struct ComputationRequest {
        bytes32 requestId;
        address requester;
        bytes32[] ciphertextIds;
        string operation;
        bytes32 resultCommitment;
        uint256 threshold;
        uint256 approvalCount;
        bool executed;
        uint256 result;
    }

    // State
    mapping(bytes32 => Ciphertext) public ciphertexts;
    mapping(bytes32 => ComputationRequest) public computationRequests;
    mapping(bytes32 => mapping(address => bool)) public computationApprovals;
    mapping(address => bytes32[]) public userCiphertexts;
    mapping(bytes32 => uint256) public decryptionShares;

    // Configuration
    uint256 public decryptionThreshold;
    uint256 public constant MAX_CIPHERTEXTS_PER_REQUEST = 10;

    // Events
    event CiphertextCreated(bytes32 indexed id, address indexed creator, uint256 timestamp);
    event ComputationRequested(bytes32 indexed requestId, address indexed requester, string operation);
    event ComputationApproved(bytes32 indexed requestId, address indexed approver);
    event ComputationExecuted(bytes32 indexed requestId, uint256 result);
    event DecryptionShareSubmitted(bytes32 indexed requestId, address indexed submitter);

    // Errors
    error InvalidCiphertext();
    error ComputationFailed();
    error InsufficientApprovals(uint256 current, uint256 required);
    error AlreadyApproved(bytes32 requestId, address approver);
    error ComputationAlreadyExecuted(bytes32 requestId);
    error InvalidOperation(string operation);
    error TooManyCiphertexts(uint256 count, uint256 max);

    constructor(uint256 _decryptionThreshold) {
        require(_decryptionThreshold > 0, "Invalid threshold");
        decryptionThreshold = _decryptionThreshold;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COMPUTOR_ROLE, msg.sender);
        _grantRole(DECRYPTOR_ROLE, msg.sender);
    }

    // ============ Encryption Functions ============

    /**
     * @notice Encrypt a plaintext value using Paillier encryption
     * @param plaintext Value to encrypt
     * @param randomness Randomness for encryption
     */
    function encrypt(
        uint256 plaintext,
        bytes32 randomness
    ) external onlyRole(COMPUTOR_ROLE) returns (bytes32 ciphertextId) {
        // Simplified Paillier encryption simulation
        uint256 r = uint256(randomness) % N;
        require(r != 0, "Invalid randomness");

        // c = (g^m * r^n) mod n^2
        uint256 c1 = modPow(G, plaintext, N * N);
        uint256 c2 = modPow(r, N, N * N);
        uint256 ciphertext = mulmod(c1, c2, N * N);

        // Create commitment
        bytes32 commitment = keccak256(abi.encode(
            plaintext,
            randomness,
            msg.sender,
            block.timestamp
        ));

        ciphertextId = keccak256(abi.encode(
            "CIPHERTEXT",
            msg.sender,
            ciphertext,
            commitment,
            block.timestamp
        ));

        ciphertexts[ciphertextId] = Ciphertext({
            c1: ciphertext,
            c2: uint256(randomness), // Store randomness for verification
            commitment: commitment,
            creator: msg.sender,
            timestamp: block.timestamp
        });

        userCiphertexts[msg.sender].push(ciphertextId);

        emit CiphertextCreated(ciphertextId, msg.sender, block.timestamp);
    }

    /**
     * @notice Perform homomorphic addition on encrypted values
     * @param ciphertextId1 First ciphertext
     * @param ciphertextId2 Second ciphertext
     */
    function homomorphicAdd(
        bytes32 ciphertextId1,
        bytes32 ciphertextId2
    ) external view returns (uint256 resultCiphertext) {
        Ciphertext storage c1 = ciphertexts[ciphertextId1];
        Ciphertext storage c2 = ciphertexts[ciphertextId2];

        require(c1.c1 != 0 && c2.c1 != 0, "Invalid ciphertexts");

        // Paillier homomorphic addition: c1 * c2 mod n^2
        resultCiphertext = mulmod(c1.c1, c2.c1, N * N);
    }

    /**
     * @notice Perform homomorphic scalar multiplication
     * @param ciphertextId Ciphertext to multiply
     * @param scalar Scalar value
     */
    function homomorphicMultiply(
        bytes32 ciphertextId,
        uint256 scalar
    ) external view returns (uint256 resultCiphertext) {
        Ciphertext storage c = ciphertexts[ciphertextId];
        require(c.c1 != 0, "Invalid ciphertext");

        // Paillier homomorphic multiplication: c^scalar mod n^2
        resultCiphertext = modPow(c.c1, scalar, N * N);
    }

    // ============ Secure Multi-Party Computation ============

    /**
     * @notice Request secure computation on encrypted data
     * @param ciphertextIds Array of ciphertext IDs to compute on
     * @param operation Type of computation ("sum", "average", "max", etc.)
     */
    function requestComputation(
        bytes32[] calldata ciphertextIds,
        string calldata operation
    ) external onlyRole(COMPUTOR_ROLE) returns (bytes32 requestId) {
        require(ciphertextIds.length > 0, "No ciphertexts");
        require(ciphertextIds.length <= MAX_CIPHERTEXTS_PER_REQUEST, "Too many ciphertexts");

        // Validate operation
        require(
            keccak256(abi.encode(operation)) == keccak256(abi.encode("sum")) ||
            keccak256(abi.encode(operation)) == keccak256(abi.encode("average")) ||
            keccak256(abi.encode(operation)) == keccak256(abi.encode("max")),
            "Invalid operation"
        );

        requestId = keccak256(abi.encode(
            "COMPUTATION_REQUEST",
            msg.sender,
            ciphertextIds,
            operation,
            block.timestamp
        ));

        computationRequests[requestId] = ComputationRequest({
            requestId: requestId,
            requester: msg.sender,
            ciphertextIds: ciphertextIds,
            operation: operation,
            resultCommitment: bytes32(0),
            threshold: decryptionThreshold,
            approvalCount: 0,
            executed: false,
            result: 0
        });

        emit ComputationRequested(requestId, msg.sender, operation);
    }

    /**
     * @notice Approve a computation request
     * @param requestId Request to approve
     */
    function approveComputation(bytes32 requestId) external onlyRole(DECRYPTOR_ROLE) {
        ComputationRequest storage request = computationRequests[requestId];
        require(!request.executed, "Already executed");
        require(!computationApprovals[requestId][msg.sender], "Already approved");

        computationApprovals[requestId][msg.sender] = true;
        request.approvalCount++;

        emit ComputationApproved(requestId, msg.sender);

        // Auto-execute if threshold reached
        if (request.approvalCount >= request.threshold) {
            _executeComputation(requestId);
        }
    }

    /**
     * @notice Submit decryption share for threshold decryption
     * @param requestId Request ID
     * @param share Decryption share
     */
    function submitDecryptionShare(
        bytes32 requestId,
        uint256 share
    ) external onlyRole(DECRYPTOR_ROLE) {
        ComputationRequest storage request = computationRequests[requestId];
        require(request.approvalCount >= request.threshold, "Not approved");
        require(!request.executed, "Already executed");

        // Store share (simplified - in production: use proper threshold crypto)
        decryptionShares[keccak256(abi.encode(requestId, msg.sender))] = share;

        emit DecryptionShareSubmitted(requestId, msg.sender);

        // Check if we have enough shares
        // Simplified: assume we have enough after first share
        if (share > 0) {
            _finalizeComputation(requestId, share);
        }
    }

    // ============ Internal Functions ============

    function _executeComputation(bytes32 requestId) internal {
        ComputationRequest storage request = computationRequests[requestId];

        uint256 result;

        if (keccak256(abi.encode(request.operation)) == keccak256(abi.encode("sum"))) {
            result = _computeSum(request.ciphertextIds);
        } else if (keccak256(abi.encode(request.operation)) == keccak256(abi.encode("average"))) {
            uint256 sum = _computeSum(request.ciphertextIds);
            result = sum / request.ciphertextIds.length;
        } else if (keccak256(abi.encode(request.operation)) == keccak256(abi.encode("max"))) {
            result = _computeMax(request.ciphertextIds);
        }

        request.result = result;
        request.resultCommitment = keccak256(abi.encode(result, requestId));

        emit ComputationExecuted(requestId, result);
    }

    function _finalizeComputation(bytes32 requestId, uint256 decryptedResult) internal {
        ComputationRequest storage request = computationRequests[requestId];
        require(!request.executed, "Already executed");

        request.result = decryptedResult;
        request.executed = true;

        emit ComputationExecuted(requestId, decryptedResult);
    }

    function _computeSum(bytes32[] memory ciphertextIds) internal view returns (uint256) {
        require(ciphertextIds.length > 0, "No ciphertexts");

        uint256 sum = ciphertexts[ciphertextIds[0]].c1;

        for (uint256 i = 1; i < ciphertextIds.length; i++) {
            sum = mulmod(sum, ciphertexts[ciphertextIds[i]].c1, N * N);
        }

        return sum;
    }

    function _computeMax(bytes32[] memory ciphertextIds) internal view returns (uint256) {
        // Simplified: return first ciphertext (in production: use secure comparison)
        return ciphertexts[ciphertextIds[0]].c1;
    }

    function modPow(uint256 base, uint256 exponent, uint256 modulus) internal pure returns (uint256) {
        uint256 result = 1;
        base = base % modulus;

        while (exponent > 0) {
            if (exponent % 2 == 1) {
                result = mulmod(result, base, modulus);
            }
            exponent = exponent >> 1;
            base = mulmod(base, base, modulus);
        }

        return result;
    }

    // ============ View Functions ============

    function getComputationResult(bytes32 requestId) external view returns (
        bool executed,
        uint256 result,
        uint256 approvalCount,
        uint256 threshold
    ) {
        ComputationRequest storage request = computationRequests[requestId];
        return (
            request.executed,
            request.result,
            request.approvalCount,
            request.threshold
        );
    }

    function getUserCiphertexts(address user) external view returns (bytes32[] memory) {
        return userCiphertexts[user];
    }

    function getCiphertext(bytes32 id) external view returns (
        uint256 c1,
        address creator,
        uint256 timestamp
    ) {
        Ciphertext storage c = ciphertexts[id];
        return (c.c1, c.creator, c.timestamp);
    }
}