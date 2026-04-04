// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title HardwareAttestation
 * @notice TPM and secure enclave attestation for hardware-backed trust
 * @dev Implements:
 *      - TPM 2.0 remote attestation
 *      - Secure enclave quote verification
 *      - Hardware root of trust
 *      - Attestation certificate chains
 *      - Firmware integrity verification
 *      - Secure boot attestation
 */
contract HardwareAttestation is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant ATTESTATION_ADMIN = keccak256("ATTESTATION_ADMIN");
    bytes32 public constant VERIFIER = keccak256("VERIFIER");

    // Attestation types
    enum AttestationType {
        TPM_QUOTE,
        SECURE_ENCLAVE_QUOTE,
        FIRMWARE_MEASUREMENT,
        SECURE_BOOT_ATTESTATION,
        HARDWARE_IDENTITY
    }

    struct AttestationCertificate {
        bytes32 certId;
        AttestationType certType;
        address attestedEntity;
        bytes32 measurement;          // PCR values or enclave measurement
        bytes32 nonce;               // Freshness nonce
        uint256 timestamp;
        bytes signature;            // Attestation signature
        bytes32 rootOfTrust;        // Hardware root public key
        bool isValid;
        uint256 expiryTime;
        bytes32[] certificateChain; // Certificate chain for verification
    }

    struct HardwareIdentity {
        bytes32 identityId;
        string manufacturer;
        string model;
        string firmwareVersion;
        bytes32 hardwareFingerprint;
        bytes32[] pcrValues;        // TPM PCR registers
        bytes32 endorsementKey;     // TPM EK
        uint256 registrationTime;
        bool isActive;
        uint256 securityLevel;      // 1-5 scale
    }

    struct AttestationChallenge {
        bytes32 challengeId;
        address challenger;
        bytes32 nonce;
        uint256 challengeTime;
        uint256 responseDeadline;
        bool fulfilled;
        bytes32 attestedMeasurement;
    }

    struct FirmwareIntegrity {
        bytes32 firmwareId;
        bytes32 expectedHash;
        bytes32 measuredHash;
        bool integrityVerified;
        uint256 lastVerification;
        bytes32[] securityPatches;
    }

    // State
    mapping(bytes32 => AttestationCertificate) public attestationCertificates;
    mapping(address => HardwareIdentity) public hardwareIdentities;
    mapping(bytes32 => AttestationChallenge) public attestationChallenges;
    mapping(bytes32 => FirmwareIntegrity) public firmwareIntegrity;

    address[] public registeredHardware;
    bytes32[] public activeCertificates;

    // Configuration
    uint256 public constant CERTIFICATE_LIFETIME = 365 days;
    uint256 public constant CHALLENGE_TIMEOUT = 1 hours;
    uint256 public constant MAX_CERT_CHAIN_LENGTH = 10;

    // Known root of trust keys (in production, these would be well-known TPM manufacturer keys)
    mapping(bytes32 => bool) public trustedRootsOfTrust;

    // Events
    event HardwareRegistered(address indexed hardware, bytes32 identityId, string manufacturer);
    event AttestationSubmitted(bytes32 indexed certId, AttestationType certType, address attested);
    event AttestationVerified(bytes32 indexed certId, bool isValid);
    event ChallengeIssued(bytes32 indexed challengeId, address challenger);
    event ChallengeResponded(bytes32 indexed challengeId, bytes32 measurement);
    event FirmwareIntegrityVerified(bytes32 indexed firmwareId, bool verified);
    event FirmwareIntegrityCompromised(bytes32 indexed firmwareId);
    event RootOfTrustAdded(bytes32 indexed rootKey);

    // Errors
    error HardwareNotRegistered(address hardware);
    error InvalidAttestationSignature();
    error CertificateChainInvalid();
    error AttestationExpired(bytes32 certId);
    error ChallengeTimeout(bytes32 challengeId);
    error UntrustedRootOfTrust(bytes32 rootKey);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ATTESTATION_ADMIN, msg.sender);
        _grantRole(VERIFIER, msg.sender);

        // Initialize with known trusted roots (simplified)
        _initializeTrustedRoots();
    }

    // ============ Hardware Identity Management ============

    /**
     * @notice Register hardware identity with TPM/enclave details
     * @param manufacturer Hardware manufacturer
     * @param model Hardware model
     * @param firmwareVersion Current firmware version
     * @param hardwareFingerprint Unique hardware fingerprint
     * @param endorsementKey TPM endorsement key
     */
    function registerHardwareIdentity(
        string calldata manufacturer,
        string calldata model,
        string calldata firmwareVersion,
        bytes32 hardwareFingerprint,
        bytes32 endorsementKey
    ) external returns (bytes32 identityId) {
        identityId = keccak256(abi.encode(
            "HARDWARE_IDENTITY",
            msg.sender,
            hardwareFingerprint,
            block.timestamp
        ));

        HardwareIdentity storage hardware = hardwareIdentities[msg.sender];
        hardware.identityId = identityId;
        hardware.manufacturer = manufacturer;
        hardware.model = model;
        hardware.firmwareVersion = firmwareVersion;
        hardware.hardwareFingerprint = hardwareFingerprint;
        hardware.endorsementKey = endorsementKey;
        hardware.registrationTime = block.timestamp;
        hardware.isActive = true;
        hardware.securityLevel = 3; // Default medium security

        // Initialize PCR values (Platform Configuration Registers)
        hardware.pcrValues = new bytes32[](24); // TPM 2.0 has 24 PCRs
        for (uint256 i = 0; i < 24; i++) {
            hardware.pcrValues[i] = bytes32(0); // Will be set during attestation
        }

        registeredHardware.push(msg.sender);

        emit HardwareRegistered(msg.sender, identityId, manufacturer);
    }

    /**
     * @notice Update PCR values during runtime attestation
     * @param pcrIndex PCR register index (0-23)
     * @param newValue New PCR value
     */
    function updatePCRValue(
        uint256 pcrIndex,
        bytes32 newValue
    ) external {
        require(pcrIndex < 24, "Invalid PCR index");
        require(hardwareIdentities[msg.sender].isActive, "Hardware not registered");

        HardwareIdentity storage hardware = hardwareIdentities[msg.sender];
        hardware.pcrValues[pcrIndex] = newValue;
    }

    // ============ Remote Attestation ============

    /**
     * @notice Submit TPM quote or enclave attestation
     * @param certType Type of attestation
     * @param measurement Attested measurement (PCR composite or enclave quote)
     * @param nonce Freshness nonce
     * @param signature Attestation signature
     * @param certChain Certificate chain for verification
     */
    function submitAttestation(
        AttestationType certType,
        bytes32 measurement,
        bytes32 nonce,
        bytes calldata signature,
        bytes32[] calldata certChain
    ) external returns (bytes32 certId) {
        require(hardwareIdentities[msg.sender].isActive, "Hardware not registered");
        require(certChain.length <= MAX_CERT_CHAIN_LENGTH, "Certificate chain too long");

        certId = keccak256(abi.encode(
            "ATTESTATION_CERT",
            msg.sender,
            certType,
            measurement,
            nonce,
            block.timestamp
        ));

        HardwareIdentity storage hardware = hardwareIdentities[msg.sender];

        AttestationCertificate storage cert = attestationCertificates[certId];
        cert.certId = certId;
        cert.certType = certType;
        cert.attestedEntity = msg.sender;
        cert.measurement = measurement;
        cert.nonce = nonce;
        cert.timestamp = block.timestamp;
        cert.signature = signature;
        cert.rootOfTrust = hardware.endorsementKey;
        cert.expiryTime = block.timestamp + CERTIFICATE_LIFETIME;
        cert.certificateChain = certChain;

        activeCertificates.push(certId);

        emit AttestationSubmitted(certId, certType, msg.sender);

        // Auto-verify if possible
        if (_canAutoVerify(certType, certChain)) {
            bool isValid = verifyAttestation(certId);
            cert.isValid = isValid;
            emit AttestationVerified(certId, isValid);
        }
    }

    /**
     * @notice Verify attestation certificate
     * @param certId Certificate to verify
     */
    function verifyAttestation(bytes32 certId) public returns (bool isValid) {
        AttestationCertificate storage cert = attestationCertificates[certId];
        require(cert.certId != bytes32(0), "Certificate not found");
        require(block.timestamp <= cert.expiryTime, "Certificate expired");

        // Verify certificate chain
        if (!_verifyCertificateChain(cert.certificateChain, cert.rootOfTrust)) {
            return false;
        }

        // Verify signature against root of trust
        bytes32 messageHash = keccak256(abi.encode(
            cert.certType,
            cert.measurement,
            cert.nonce,
            cert.timestamp,
            cert.attestedEntity
        ));

        address signer = messageHash.recover(cert.signature);
        bytes32 expectedSigner = cert.rootOfTrust;

        // In production, this would verify against the TPM endorsement key
        isValid = (bytes32(uint256(uint160(signer))) == expectedSigner);

        cert.isValid = isValid;

        // Update hardware security level based on verification
        if (isValid) {
            HardwareIdentity storage hardware = hardwareIdentities[cert.attestedEntity];
            hardware.securityLevel = _calculateSecurityLevel(cert.certType, cert.certificateChain.length);
        }

        return isValid;
    }

    // ============ Challenge-Response Attestation ============

    /**
     * @notice Issue attestation challenge for freshness
     * @param targetHardware Hardware to challenge
     */
    function issueAttestationChallenge(
        address targetHardware
    ) external onlyRole(VERIFIER) returns (bytes32 challengeId) {
        require(hardwareIdentities[targetHardware].isActive, "Hardware not registered");

        bytes32 nonce = keccak256(abi.encode(
            "ATTESTATION_CHALLENGE",
            targetHardware,
            block.timestamp,
            block.prevrandao
        ));

        challengeId = keccak256(abi.encode(
            "CHALLENGE",
            targetHardware,
            nonce,
            block.timestamp
        ));

        AttestationChallenge storage challenge = attestationChallenges[challengeId];
        challenge.challengeId = challengeId;
        challenge.challenger = msg.sender;
        challenge.nonce = nonce;
        challenge.challengeTime = block.timestamp;
        challenge.responseDeadline = block.timestamp + CHALLENGE_TIMEOUT;

        emit ChallengeIssued(challengeId, msg.sender);
    }

    /**
     * @notice Respond to attestation challenge
     * @param challengeId Challenge to respond to
     * @param measurement Current measurement
     * @param proof Proof of possession of measurement
     */
    function respondToChallenge(
        bytes32 challengeId,
        bytes32 measurement,
        bytes calldata proof
    ) external {
        AttestationChallenge storage challenge = attestationChallenges[challengeId];
        require(challenge.challengeId != bytes32(0), "Challenge not found");
        require(msg.sender == _getChallengeTarget(challengeId), "Not challenge target");
        require(block.timestamp <= challenge.responseDeadline, "Challenge expired");
        require(!challenge.fulfilled, "Challenge already fulfilled");

        // Verify proof (simplified - would verify TPM quote or enclave proof)
        require(_verifyChallengeProof(challenge.nonce, measurement, proof), "Invalid proof");

        challenge.fulfilled = true;
        challenge.attestedMeasurement = measurement;

        emit ChallengeResponded(challengeId, measurement);
    }

    function _getChallengeTarget(bytes32 challengeId) internal view returns (address) {
        // Extract target from challenge ID (simplified)
        return address(uint160(uint256(challengeId)));
    }

    // ============ Firmware Integrity ============

    /**
     * @notice Register expected firmware hash
     * @param firmwareVersion Firmware version
     * @param expectedHash Expected SHA-256 hash of firmware
     */
    function registerFirmwareIntegrity(
        string calldata firmwareVersion,
        bytes32 expectedHash
    ) external onlyRole(ATTESTATION_ADMIN) returns (bytes32 firmwareId) {
        firmwareId = keccak256(abi.encode(
            "FIRMWARE_INTEGRITY",
            firmwareVersion,
            expectedHash
        ));

        FirmwareIntegrity storage firmware = firmwareIntegrity[firmwareId];
        firmware.firmwareId = firmwareId;
        firmware.expectedHash = expectedHash;
        firmware.integrityVerified = false;
    }

    /**
     * @notice Verify firmware integrity against measurement
     * @param firmwareId Firmware to verify
     * @param measuredHash Measured hash from hardware
     */
    function verifyFirmwareIntegrity(
        bytes32 firmwareId,
        bytes32 measuredHash
    ) external returns (bool integrityVerified) {
        FirmwareIntegrity storage firmware = firmwareIntegrity[firmwareId];
        require(firmware.firmwareId != bytes32(0), "Firmware not registered");

        integrityVerified = (measuredHash == firmware.expectedHash);
        firmware.measuredHash = measuredHash;
        firmware.integrityVerified = integrityVerified;
        firmware.lastVerification = block.timestamp;

        if (!integrityVerified) {
            // Firmware compromised - deactivate hardware
            HardwareIdentity storage hardware = hardwareIdentities[msg.sender];
            if (hardware.isActive) {
                hardware.isActive = false;
                emit FirmwareIntegrityCompromised(firmwareId);
            }
        }

        emit FirmwareIntegrityVerified(firmwareId, integrityVerified);
        return integrityVerified;
    }

    // ============ Root of Trust Management ============

    /**
     * @notice Add trusted root of trust key
     * @param rootKey Root public key to trust
     */
    function addTrustedRoot(bytes32 rootKey) external onlyRole(ATTESTATION_ADMIN) {
        trustedRootsOfTrust[rootKey] = true;
        emit RootOfTrustAdded(rootKey);
    }

    // ============ Internal Verification Functions ============

    function _initializeTrustedRoots() internal {
        // Add well-known TPM manufacturer roots (simplified)
        bytes32[] memory roots = new bytes32[](3);
        roots[0] = keccak256("INFINEON_ROOT");
        roots[1] = keccak256("STMicroelectronics_ROOT");
        roots[2] = keccak256("NXP_ROOT");

        for (uint256 i = 0; i < roots.length; i++) {
            trustedRootsOfTrust[roots[i]] = true;
        }
    }

    function _verifyCertificateChain(
        bytes32[] memory certChain,
        bytes32 rootOfTrust
    ) internal view returns (bool) {
        if (certChain.length == 0) return false;

        // Start with the root
        bytes32 currentKey = rootOfTrust;

        // Verify each certificate in chain
        for (uint256 i = 0; i < certChain.length; i++) {
            // Simplified chain verification
            bytes32 certHash = certChain[i];
            if (!trustedRootsOfTrust[certHash]) {
                return false;
            }
        }

        return true;
    }

    function _canAutoVerify(
        AttestationType certType,
        bytes32[] memory certChain
    ) internal view returns (bool) {
        // Auto-verify if certificate chain is valid and short
        return certChain.length <= 3 && _isValidCertChain(certChain);
    }

    function _isValidCertChain(bytes32[] memory certChain) internal pure returns (bool) {
        if (certChain.length == 0) return false;

        // Basic validation - check for duplicates
        for (uint256 i = 0; i < certChain.length; i++) {
            for (uint256 j = i + 1; j < certChain.length; j++) {
                if (certChain[i] == certChain[j]) return false;
            }
        }

        return true;
    }

    function _calculateSecurityLevel(
        AttestationType certType,
        uint256 certChainLength
    ) internal pure returns (uint256) {
        uint256 baseLevel = 3; // Medium security

        // Adjust based on certificate type
        if (certType == AttestationType.SECURE_ENCLAVE_QUOTE) {
            baseLevel += 1;
        } else if (certType == AttestationType.SECURE_BOOT_ATTESTATION) {
            baseLevel += 2;
        }

        // Adjust based on certificate chain length (shorter = more trusted)
        if (certChainLength <= 2) {
            baseLevel += 1;
        }

        return baseLevel > 5 ? 5 : baseLevel;
    }

    function _verifyChallengeProof(
        bytes32 nonce,
        bytes32 measurement,
        bytes calldata proof
    ) internal pure returns (bool) {
        // Simplified proof verification
        bytes32 expectedProof = keccak256(abi.encode(nonce, measurement));
        return keccak256(proof) == expectedProof;
    }

    // ============ View Functions ============

    function getHardwareIdentity(address hardware) external view returns (
        string memory manufacturer,
        string memory model,
        string memory firmwareVersion,
        uint256 securityLevel,
        bool isActive
    ) {
        HardwareIdentity storage hw = hardwareIdentities[hardware];
        return (
            hw.manufacturer,
            hw.model,
            hw.firmwareVersion,
            hw.securityLevel,
            hw.isActive
        );
    }

    function getAttestationStatus(bytes32 certId) external view returns (
        AttestationType certType,
        bool isValid,
        uint256 expiryTime,
        address attestedEntity
    ) {
        AttestationCertificate storage cert = attestationCertificates[certId];
        return (
            cert.certType,
            cert.isValid,
            cert.expiryTime,
            cert.attestedEntity
        );
    }

    function getPCRValues(address hardware) external view returns (bytes32[] memory) {
        return hardwareIdentities[hardware].pcrValues;
    }

    function getRegisteredHardware() external view returns (address[] memory) {
        return registeredHardware;
    }

    function getActiveCertificates() external view returns (bytes32[] memory) {
        return activeCertificates;
    }

    function isTrustedRoot(bytes32 rootKey) external view returns (bool) {
        return trustedRootsOfTrust[rootKey];
    }

    function getFirmwareStatus(bytes32 firmwareId) external view returns (
        bool integrityVerified,
        bytes32 expectedHash,
        bytes32 measuredHash,
        uint256 lastVerification
    ) {
        FirmwareIntegrity storage fw = firmwareIntegrity[firmwareId];
        return (
            fw.integrityVerified,
            fw.expectedHash,
            fw.measuredHash,
            fw.lastVerification
        );
    }
}