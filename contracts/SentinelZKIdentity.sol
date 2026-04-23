// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SentinelZKIdentity
 * @notice Decentralized Identity with Zero-Knowledge Proofs
 * Privacy-preserving identity verification and credential management
 */
contract SentinelZKIdentity is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // Identity structure with ZK capabilities
    struct ZKIdentity {
        bytes32 identityHash;
        bytes32 publicKey;
        uint256 reputation;
        uint256 trustScore;
        uint256 creationTime;
        bool isActive;
        bool isVerified;
        bytes32[] credentials;
        mapping(bytes32 => ZKCredential) credentialStore;
    }

    // Zero-Knowledge credential structure
    struct ZKCredential {
        bytes32 credentialId;
        string credentialType;
        bytes32 issuerId;
        bytes32 subjectId;
        uint256 issuanceTime;
        uint256 expirationTime;
        bytes32 proofHash;
        bool isValid;
        bool isRevoked;
        mapping(bytes32 => bytes32) attributes; // ZK-hashed attributes
    }

    // ZK Proof verification structure
    struct ZKProof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256[] inputs;
        bytes32 publicInputsHash;
        bool verified;
        uint256 verificationTime;
    }

    // State variables
    mapping(address => ZKIdentity) public identities;
    mapping(bytes32 => ZKProof) public proofs;
    mapping(bytes32 => address) public credentialIssuers;

    // Reverse lookup mappings
    mapping(bytes32 => address) public identityHashToOwner; // identityHash => owner address
    mapping(bytes32 => address) public credentialToOwner; // credentialId => owner address

    bytes32[] public activeIdentities;
    bytes32[] public verifiedCredentials;

    // Identity parameters
    uint256 public constant MIN_REPUTATION = 100;
    uint256 public constant MAX_TRUST_SCORE = 1000;
    uint256 public constant IDENTITY_EXPIRY = 365 days;
    uint256 public constant CREDENTIAL_VALIDITY = 180 days;

    event IdentityCreated(address indexed user, bytes32 identityHash);
    event CredentialIssued(
        bytes32 indexed credentialId,
        bytes32 indexed identityId,
        string credentialType
    );
    event ZKProofVerified(bytes32 indexed proofId, bool success);
    event IdentityVerified(bytes32 indexed identityHash, uint256 trustScore);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "ZKI: zero owner");
        if (initialOwner != msg.sender) {
            _transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Create a new ZK identity
     * @param publicKey User's public key for ZK operations
     * @return identityHash Unique identifier for the new identity
     */
    function createZKIdentity(bytes32 publicKey) external returns (bytes32) {
        require(
            identities[msg.sender].creationTime == 0,
            "Identity already exists"
        );

        bytes32 identityHash = keccak256(
            abi.encodePacked(
                msg.sender,
                publicKey,
                block.timestamp,
                "zk_identity_v1"
            )
        );

        identities[msg.sender].identityHash = identityHash;
        identities[msg.sender].publicKey = publicKey;
        identities[msg.sender].reputation = 500; // Starting reputation
        identities[msg.sender].trustScore = 600; // Starting trust score
        identities[msg.sender].creationTime = block.timestamp;
        identities[msg.sender].isActive = true;
        identities[msg.sender].isVerified = false;

        activeIdentities.push(identityHash);
        identityHashToOwner[identityHash] = msg.sender;

        emit IdentityCreated(msg.sender, identityHash);
        return identityHash;
    }

    /**
     * @notice Issue a ZK credential to an identity
     * @param identityId Target identity
     * @param credentialType Type of credential (KYC, AML, etc.)
     * @param attributes Hashed credential attributes
     * @param validityPeriod How long the credential is valid
     */
    function issueZKCredential(
        bytes32 identityId,
        string calldata credentialType,
        bytes32[] calldata attributes,
        uint256 validityPeriod
    ) external onlyOwner returns (bytes32) {
        require(
            validityPeriod <= CREDENTIAL_VALIDITY,
            "Validity period too long"
        );

        bytes32 credentialId = keccak256(
            abi.encodePacked(
                identityId,
                credentialType,
                block.timestamp,
                msg.sender
            )
        );

        ZKCredential storage credential = identities[
            _getIdentityOwner(identityId)
        ].credentialStore[credentialId];

        credential.credentialId = credentialId;
        credential.credentialType = credentialType;
        credential.issuerId = keccak256(abi.encodePacked(msg.sender));
        credential.subjectId = identityId;
        credential.issuanceTime = block.timestamp;
        credential.expirationTime = block.timestamp + validityPeriod;
        credential.isValid = true;
        credential.isRevoked = false;

        // Store ZK-hashed attributes
        for (uint256 i = 0; i < attributes.length; i++) {
            bytes32 attrKey = keccak256(abi.encodePacked("attr", i));
            credential.attributes[attrKey] = attributes[i];
        }

        // Generate proof hash
        credential.proofHash = keccak256(
            abi.encodePacked(credentialId, attributes, block.timestamp)
        );

        // Add to identity's credentials
        ZKIdentity storage identity = identities[_getIdentityOwner(identityId)];
        identity.credentials.push(credentialId);

        // Update credential issuers registry
        credentialIssuers[credentialId] = msg.sender;

        verifiedCredentials.push(credentialId);
        credentialToOwner[credentialId] = _getIdentityOwner(identityId);

        emit CredentialIssued(credentialId, identityId, credentialType);
        return credentialId;
    }

    /**
     * @notice Submit ZK proof for identity verification
     * @param proof ZK-SNARK proof
     * @param publicInputsHash Hash of public inputs
     * @param proofType Type of verification (identity, credential, etc.)
     */
    function submitZKProof(
        ZKProof calldata proof,
        bytes32 publicInputsHash,
        string calldata proofType
    ) external returns (bool) {
        require(identities[msg.sender].isActive, "Identity not active");

        bytes32 proofId = keccak256(
            abi.encodePacked(
                msg.sender,
                publicInputsHash,
                proofType,
                block.timestamp
            )
        );

        // Verify ZK proof (simplified for demonstration)
        bool isValid = _verifyZKProof(proof, publicInputsHash);

        proofs[proofId] = ZKProof({
            a: proof.a,
            b: proof.b,
            c: proof.c,
            inputs: proof.inputs,
            publicInputsHash: publicInputsHash,
            verified: isValid,
            verificationTime: block.timestamp
        });

        // Update identity based on verification
        if (isValid) {
            ZKIdentity storage identity = identities[msg.sender];

            if (
                keccak256(abi.encodePacked(proofType)) ==
                keccak256(abi.encodePacked("identity_verification"))
            ) {
                identity.isVerified = true;
                identity.trustScore = Math.min(
                    identity.trustScore + 100,
                    MAX_TRUST_SCORE
                );
                emit IdentityVerified(
                    identity.identityHash,
                    identity.trustScore
                );
            }

            identity.reputation = Math.min(identity.reputation + 10, 1000);
        }

        emit ZKProofVerified(proofId, isValid);
        return isValid;
    }

    /**
     * @notice Verify ZK credential presentation
     * @param credentialId Credential to verify
     * @param presentationProof ZK proof of credential possession
     */
    function verifyZKCredential(
        bytes32 credentialId,
        ZKProof calldata presentationProof
    ) external view returns (bool) {
        ZKCredential storage credential = _getCredential(credentialId);
        require(
            credential.isValid && !credential.isRevoked,
            "Credential invalid"
        );
        require(
            block.timestamp <= credential.expirationTime,
            "Credential expired"
        );

        // Verify presentation proof
        bytes32 publicInputsHash = keccak256(
            abi.encodePacked(
                credentialId,
                credential.subjectId,
                "credential_presentation"
            )
        );

        bool isValid = _verifyZKProof(presentationProof, publicInputsHash);

        if (isValid) {
            // Update credential usage metrics
            // Could track verification frequency, etc.
        }

        return isValid;
    }

    /**
     * @notice Revoke a ZK credential
     * @param credentialId Credential to revoke
     */
    function revokeZKCredential(bytes32 credentialId) external {
        ZKCredential storage credential = _getCredential(credentialId);
        require(
            credentialIssuers[credentialId] == msg.sender,
            "Not credential issuer"
        );

        credential.isRevoked = true;

        // Update identity reputation
        address identityOwner = _getIdentityOwner(credential.subjectId);
        identities[identityOwner].reputation = Math.max(
            identities[identityOwner].reputation > 50
                ? identities[identityOwner].reputation - 50
                : 0,
            0
        );
    }

    /**
     * @notice Get identity information
     * @param user Address to query
     */
    function getZKIdentity(
        address user
    )
        external
        view
        returns (
            bytes32 identityHash,
            uint256 reputation,
            uint256 trustScore,
            bool isVerified,
            uint256 credentialCount
        )
    {
        return (
            identities[user].identityHash,
            identities[user].reputation,
            identities[user].trustScore,
            identities[user].isVerified,
            identities[user].credentials.length
        );
    }

    /**
     * @notice Get credential information
     * @param credentialId Credential to query
     */
    function getZKCredential(
        bytes32 credentialId
    )
        external
        view
        returns (
            string memory credentialType,
            bytes32 issuerId,
            uint256 issuanceTime,
            uint256 expirationTime,
            bool isValid,
            bool isRevoked
        )
    {
        ZKCredential storage credential = _getCredential(credentialId);
        return (
            credential.credentialType,
            credential.issuerId,
            credential.issuanceTime,
            credential.expirationTime,
            credential.isValid,
            credential.isRevoked
        );
    }

    /**
     * @notice Check if identity meets requirements
     * @param user Address to check
     * @param minReputation Minimum reputation required
     * @param minTrustScore Minimum trust score required
     */
    function checkIdentityRequirements(
        address user,
        uint256 minReputation,
        uint256 minTrustScore
    ) external view returns (bool) {
        return
            identities[user].isActive &&
            identities[user].isVerified &&
            identities[user].reputation >= minReputation &&
            identities[user].trustScore >= minTrustScore;
    }

    /**
     * @dev Get identity owner from identity hash using reverse mapping
     */
    function _getIdentityOwner(
        bytes32 identityId
    ) internal view returns (address) {
        address owner = identityHashToOwner[identityId];
        require(owner != address(0), "Identity not found");
        return owner;
    }

    /**
     * @dev Get credential from owner's credentialStore using reverse mapping
     */
    function _getCredential(
        bytes32 credentialId
    ) internal view returns (ZKCredential storage) {
        address owner = credentialToOwner[credentialId];
        require(owner != address(0), "Credential not found");
        return identities[owner].credentialStore[credentialId];
    }

    /**
     * @dev Verify ZK-SNARK proof (simplified demonstration)
     */
    function _verifyZKProof(
        ZKProof memory proof,
        bytes32 publicInputsHash
    ) internal pure returns (bool) {
        // In production, this would verify the actual ZK-SNARK proof
        // using the verifying key and pairing operations

        // Simplified verification for demonstration
        bytes32 proofHash = keccak256(
            abi.encodePacked(
                proof.a[0],
                proof.a[1],
                proof.b[0][0],
                proof.b[0][1],
                proof.b[1][0],
                proof.b[1][1],
                proof.c[0],
                proof.c[1],
                proof.inputs,
                publicInputsHash
            )
        );

        // Simulate verification success rate (90% for demo)
        return uint256(proofHash) % 100 < 90;
    }
}
