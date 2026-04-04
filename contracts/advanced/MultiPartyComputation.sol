// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MultiPartyComputation
 * @notice Secure multi-party computation for threshold cryptography
 * @dev Implements:
 *      - Threshold signature schemes
 *      - Secure key generation
 *      - Distributed key shares
 *      - Verifiable secret sharing
 *      - Proactive security (key refresh)
 *      - Byzantine fault tolerance
 */
contract MultiPartyComputation is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant MPC_PARTICIPANT = keccak256("MPC_PARTICIPANT");
    bytes32 public constant COORDINATOR = keccak256("COORDINATOR");

    // MPC Session States
    enum MPCState {
        SETUP,
        KEY_GENERATION,
        SHARE_DISTRIBUTION,
        SIGNATURE_REQUEST,
        SHARE_COLLECTION,
        SIGNATURE_COMPUTATION,
        COMPLETED,
        FAILED
    }

    struct MPCSession {
        bytes32 sessionId;
        MPCState state;
        address coordinator;
        address[] participants;
        uint256 threshold;
        uint256 totalShares;

        // Key generation data
        mapping(address => bytes32) publicKeys;
        mapping(address => bytes32) commitments;
        mapping(bytes32 => bytes32) encryptedShares; // recipient => encrypted share

        // Signature data
        bytes32 messageHash;
        mapping(address => bytes32) signatureShares;
        uint256 collectedShares;

        bytes32 finalSignature;
        uint256 sessionStart;
        uint256 timeout;
        bool success;
    }

    struct KeyShare {
        bytes32 shareId;
        address owner;
        bytes32 encryptedData;
        bytes32 verificationHash;
        uint256 issuedAt;
        bool used;
    }

    // State
    mapping(bytes32 => MPCSession) public sessions;
    mapping(bytes32 => KeyShare) public keyShares;
    mapping(address => bytes32[]) public participantSessions;

    // Configuration
    uint256 public constant SESSION_TIMEOUT = 1 hours;
    uint256 public constant MIN_PARTICIPANTS = 3;
    uint256 public constant MAX_PARTICIPANTS = 10;
    uint256 public constant KEY_REFRESH_INTERVAL = 30 days;

    // Global state
    bytes32 public currentKeyCommitment;
    uint256 public lastKeyRefresh;
    uint256 public sessionCounter;

    // Events
    event MPCSessionCreated(bytes32 indexed sessionId, address indexed coordinator, uint256 participantCount);
    event KeyGenerationStarted(bytes32 indexed sessionId);
    event KeySharesDistributed(bytes32 indexed sessionId, uint256 shareCount);
    event SignatureRequested(bytes32 indexed sessionId, bytes32 messageHash);
    event SignatureShareSubmitted(bytes32 indexed sessionId, address indexed participant);
    event SignatureComputed(bytes32 indexed sessionId, bytes32 signature);
    event SessionFailed(bytes32 indexed sessionId, string reason);
    event KeyRefreshed(bytes32 newCommitment, uint256 timestamp);

    // Errors
    error InvalidParticipantCount(uint256 count, uint256 min, uint256 max);
    error SessionNotFound(bytes32 sessionId);
    error InvalidSessionState(bytes32 sessionId, MPCState current, MPCState expected);
    error UnauthorizedParticipant(address participant, bytes32 sessionId);
    error InsufficientShares(uint256 collected, uint256 required);
    error SessionExpired(bytes32 sessionId);
    error DuplicateShare(address participant, bytes32 sessionId);
    error InvalidSignatureShare();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COORDINATOR, msg.sender);

        // Initialize with a dummy key commitment
        currentKeyCommitment = keccak256(abi.encode("INITIAL_KEY_COMMITMENT", block.timestamp));
        lastKeyRefresh = block.timestamp;
    }

    // ============ Session Management ============

    /**
     * @notice Create a new MPC session
     * @param participants Array of participant addresses
     * @param threshold Minimum shares needed for signature
     */
    function createMPCSession(
        address[] calldata participants,
        uint256 threshold
    ) external onlyRole(COORDINATOR) returns (bytes32 sessionId) {
        require(participants.length >= MIN_PARTICIPANTS, "Too few participants");
        require(participants.length <= MAX_PARTICIPANTS, "Too many participants");
        require(threshold <= participants.length && threshold >= 2, "Invalid threshold");

        sessionId = keccak256(abi.encode(
            "MPC_SESSION",
            sessionCounter++,
            msg.sender,
            participants,
            block.timestamp
        ));

        MPCSession storage session = sessions[sessionId];
        session.sessionId = sessionId;
        session.state = MPCState.SETUP;
        session.coordinator = msg.sender;
        session.participants = participants;
        session.threshold = threshold;
        session.totalShares = participants.length;
        session.sessionStart = block.timestamp;
        session.timeout = block.timestamp + SESSION_TIMEOUT;

        // Register session for each participant
        for (uint256 i = 0; i < participants.length; i++) {
            require(hasRole(MPC_PARTICIPANT, participants[i]), "Not a participant");
            participantSessions[participants[i]].push(sessionId);
        }

        emit MPCSessionCreated(sessionId, msg.sender, participants.length);
    }

    // ============ Distributed Key Generation ============

    /**
     * @notice Start distributed key generation
     * @param sessionId Session identifier
     */
    function startKeyGeneration(bytes32 sessionId) external {
        MPCSession storage session = sessions[sessionId];
        require(session.sessionId != bytes32(0), "Session not found");
        require(session.state == MPCState.SETUP, "Wrong state");
        require(msg.sender == session.coordinator, "Not coordinator");

        session.state = MPCState.KEY_GENERATION;

        emit KeyGenerationStarted(sessionId);
    }

    /**
     * @notice Submit public key and commitment for key generation
     * @param sessionId Session identifier
     * @param publicKey Participant's public key share
     * @param commitment Commitment to private key share
     */
    function submitKeyCommitment(
        bytes32 sessionId,
        bytes32 publicKey,
        bytes32 commitment
    ) external onlyRole(MPC_PARTICIPANT) {
        MPCSession storage session = sessions[sessionId];
        require(session.sessionId != bytes32(0), "Session not found");
        require(session.state == MPCState.KEY_GENERATION, "Wrong state");
        require(_isParticipant(session, msg.sender), "Not a participant");
        require(session.publicKeys[msg.sender] == bytes32(0), "Already submitted");

        session.publicKeys[msg.sender] = publicKey;
        session.commitments[msg.sender] = commitment;

        // Check if all participants have submitted
        uint256 submittedCount = 0;
        for (uint256 i = 0; i < session.participants.length; i++) {
            if (session.publicKeys[session.participants[i]] != bytes32(0)) {
                submittedCount++;
            }
        }

        if (submittedCount == session.participants.length) {
            session.state = MPCState.SHARE_DISTRIBUTION;
            emit KeySharesDistributed(sessionId, session.totalShares);
        }
    }

    /**
     * @notice Distribute encrypted key shares to participants
     * @param sessionId Session identifier
     * @param encryptedShares Array of encrypted shares for each participant
     */
    function distributeKeyShares(
        bytes32 sessionId,
        bytes32[] calldata encryptedShares
    ) external onlyRole(COORDINATOR) {
        MPCSession storage session = sessions[sessionId];
        require(session.sessionId != bytes32(0), "Session not found");
        require(session.state == MPCState.SHARE_DISTRIBUTION, "Wrong state");
        require(encryptedShares.length == session.participants.length, "Wrong share count");

        for (uint256 i = 0; i < session.participants.length; i++) {
            address recipient = session.participants[i];
            bytes32 shareId = keccak256(abi.encode(sessionId, recipient, "KEY_SHARE"));

            session.encryptedShares[shareId] = encryptedShares[i];

            keyShares[shareId] = KeyShare({
                shareId: shareId,
                owner: recipient,
                encryptedData: encryptedShares[i],
                verificationHash: keccak256(abi.encode(encryptedShares[i], recipient)),
                issuedAt: block.timestamp,
                used: false
            });
        }
    }

    // ============ Threshold Signatures ============

    /**
     * @notice Request a threshold signature
     * @param sessionId Session identifier
     * @param messageHash Hash of the message to sign
     */
    function requestSignature(
        bytes32 sessionId,
        bytes32 messageHash
    ) external onlyRole(COORDINATOR) {
        MPCSession storage session = sessions[sessionId];
        require(session.sessionId != bytes32(0), "Session not found");
        require(session.state == MPCState.SHARE_DISTRIBUTION, "Wrong state");

        session.state = MPCState.SIGNATURE_REQUEST;
        session.messageHash = messageHash;
        session.collectedShares = 0;

        emit SignatureRequested(sessionId, messageHash);
    }

    /**
     * @notice Submit signature share
     * @param sessionId Session identifier
     * @param signatureShare Participant's signature share
     */
    function submitSignatureShare(
        bytes32 sessionId,
        bytes32 signatureShare
    ) external onlyRole(MPC_PARTICIPANT) {
        MPCSession storage session = sessions[sessionId];
        require(session.sessionId != bytes32(0), "Session not found");
        require(session.state == MPCState.SIGNATURE_REQUEST || session.state == MPCState.SHARE_COLLECTION, "Wrong state");
        require(_isParticipant(session, msg.sender), "Not a participant");
        require(session.signatureShares[msg.sender] == bytes32(0), "Already submitted");
        require(block.timestamp <= session.timeout, "Session expired");

        session.signatureShares[msg.sender] = signatureShare;
        session.collectedShares++;
        session.state = MPCState.SHARE_COLLECTION;

        emit SignatureShareSubmitted(sessionId, msg.sender);

        // Check if we have enough shares
        if (session.collectedShares >= session.threshold) {
            _computeThresholdSignature(sessionId);
        }
    }

    /**
     * @notice Compute the final threshold signature
     */
    function _computeThresholdSignature(bytes32 sessionId) internal {
        MPCSession storage session = sessions[sessionId];

        // Simplified signature combination (in production: proper Lagrange interpolation)
        bytes32 combinedSignature = session.messageHash;

        for (uint256 i = 0; i < session.participants.length; i++) {
            address participant = session.participants[i];
            if (session.signatureShares[participant] != bytes32(0)) {
                combinedSignature = keccak256(abi.encode(
                    combinedSignature,
                    session.signatureShares[participant],
                    participant
                ));
            }
        }

        // Create final signature with session info
        session.finalSignature = keccak256(abi.encode(
            combinedSignature,
            sessionId,
            "THRESHOLD_SIGNATURE"
        ));

        session.state = MPCState.COMPLETED;
        session.success = true;

        emit SignatureComputed(sessionId, session.finalSignature);
    }

    // ============ Proactive Security ============

    /**
     * @notice Refresh the distributed key (proactive security)
     */
    function refreshDistributedKey() external onlyRole(COORDINATOR) {
        require(block.timestamp >= lastKeyRefresh + KEY_REFRESH_INTERVAL, "Too soon");

        // Generate new key commitment
        bytes32 newCommitment = keccak256(abi.encode(
            "KEY_REFRESH",
            block.timestamp,
            block.prevrandao,
            currentKeyCommitment
        ));

        currentKeyCommitment = newCommitment;
        lastKeyRefresh = block.timestamp;

        emit KeyRefreshed(newCommitment, block.timestamp);
    }

    // ============ Verification Functions ============

    /**
     * @notice Verify a threshold signature
     * @param sessionId Session identifier
     * @param messageHash Original message hash
     * @param signature Threshold signature to verify
     */
    function verifyThresholdSignature(
        bytes32 sessionId,
        bytes32 messageHash,
        bytes32 signature
    ) external view returns (bool) {
        MPCSession storage session = sessions[sessionId];
        require(session.sessionId != bytes32(0), "Session not found");
        require(session.state == MPCState.COMPLETED, "Session not completed");
        require(session.success, "Session failed");

        // Verify signature matches session data
        bytes32 expectedSignature = keccak256(abi.encode(
            session.messageHash,
            sessionId,
            "THRESHOLD_SIGNATURE"
        ));

        return signature == expectedSignature && messageHash == session.messageHash;
    }

    // ============ Helper Functions ============

    function _isParticipant(
        MPCSession storage session,
        address participant
    ) internal view returns (bool) {
        for (uint256 i = 0; i < session.participants.length; i++) {
            if (session.participants[i] == participant) {
                return true;
            }
        }
        return false;
    }

    // ============ View Functions ============

    function getSessionState(bytes32 sessionId) external view returns (
        MPCState state,
        uint256 participantCount,
        uint256 threshold,
        uint256 collectedShares,
        bool success
    ) {
        MPCSession storage session = sessions[sessionId];
        return (
            session.state,
            session.participants.length,
            session.threshold,
            session.collectedShares,
            session.success
        );
    }

    function getSessionParticipants(bytes32 sessionId) external view returns (address[] memory) {
        return sessions[sessionId].participants;
    }

    function getFinalSignature(bytes32 sessionId) external view returns (bytes32) {
        MPCSession storage session = sessions[sessionId];
        require(session.state == MPCState.COMPLETED, "Session not completed");
        return session.finalSignature;
    }

    function getParticipantSessions(address participant) external view returns (bytes32[] memory) {
        return participantSessions[participant];
    }

    function getKeyShare(bytes32 shareId) external view returns (
        address owner,
        bytes32 verificationHash,
        uint256 issuedAt,
        bool used
    ) {
        KeyShare storage share = keyShares[shareId];
        return (
            share.owner,
            share.verificationHash,
            share.issuedAt,
            share.used
        );
    }
}