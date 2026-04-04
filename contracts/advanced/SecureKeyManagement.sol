// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./HardwareSecurityModule.sol";

/**
 * @title SecureKeyManagement
 * @notice Hardware-backed key management with quantum resistance
 * @dev Integrates with HSM for:
 *      - Secure key generation and storage
 *      - Hardware-accelerated cryptography
 *      - Key lifecycle management
 *      - Quantum-resistant algorithms
 *      - Multi-party key operations
 *      - Emergency key recovery
 */
contract SecureKeyManagement is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant KEY_MANAGER = keccak256("KEY_MANAGER");
    bytes32 public constant KEY_USER = keccak256("KEY_USER");
    bytes32 public constant EMERGENCY_RECOVERY = keccak256("EMERGENCY_RECOVERY");

    HardwareSecurityModule public hsm;

    // Key metadata (actual keys never stored on-chain)
    struct KeyMetadata {
        bytes32 keyId;
        address owner;
        KeyType keyType;
        KeyPurpose purpose;
        uint256 createdAt;
        uint256 lastUsed;
        uint256 usageCount;
        bool isActive;
        bool exportable;
        bytes32 keyFingerprint;     // Hash of public key
        bytes32 hsmDeviceId;        // Which HSM holds the key
        uint256 securityLevel;      // 1-5 scale
        bytes32[] authorizedUsers;  // Hashes of authorized user addresses
        KeyPolicy policy;
    }

    enum KeyType {
        SYMMETRIC_AES,
        ASYMMETRIC_RSA,
        ASYMMETRIC_ECC,
        QUANTUM_RESISTANT_KYBER,
        SIGNATURE_ED25519,
        SIGNATURE_DILITHIUM
    }

    enum KeyPurpose {
        ENCRYPTION,
        SIGNATURE,
        KEY_AGREEMENT,
        AUTHENTICATION,
        ATTESTATION
    }

    struct KeyPolicy {
        uint256 maxUsageCount;
        uint256 expiryTime;
        bool requireMFA;
        bool allowDelegation;
        uint256 minSecurityLevel;
        bytes32[] allowedOperations;
    }

    struct KeyOperation {
        bytes32 operationId;
        bytes32 keyId;
        KeyOperationType opType;
        address requester;
        bytes inputData;
        bytes result;
        uint256 timestamp;
        bool authorized;
        bytes32 auditHash;
    }

    enum KeyOperationType {
        ENCRYPT,
        DECRYPT,
        SIGN,
        VERIFY,
        DERIVE,
        WRAP,
        UNWRAP
    }

    struct KeyRecoveryShare {
        bytes32 shareId;
        bytes32 keyId;
        address custodian;
        bytes32 encryptedShare;
        bool revealed;
        uint256 thresholdRequired;
    }

    // State
    mapping(bytes32 => KeyMetadata) public keyMetadata;
    mapping(bytes32 => KeyOperation[]) public keyOperations;
    mapping(bytes32 => KeyRecoveryShare[]) public keyRecoveryShares;

    bytes32[] public activeKeys;
    bytes32[] public expiredKeys;

    // Recovery configuration
    uint256 public recoveryThreshold = 3; // 3-of-5 shares needed
    uint256 public totalRecoveryCustodians = 5;
    mapping(address => bool) public recoveryCustodians;

    // Security settings
    uint256 public constant MAX_KEY_LIFETIME = 365 days;
    uint256 public constant KEY_ROTATION_INTERVAL = 90 days;
    uint256 public constant OPERATION_TIMEOUT = 5 minutes;

    // Events
    event KeyCreated(bytes32 indexed keyId, KeyType keyType, address indexed owner);
    event KeyOperationPerformed(bytes32 indexed keyId, KeyOperationType opType, address requester);
    event KeyRotated(bytes32 indexed oldKeyId, bytes32 indexed newKeyId);
    event KeyExpired(bytes32 indexed keyId);
    event KeyDestroyed(bytes32 indexed keyId, string reason);
    event RecoveryShareGenerated(bytes32 indexed keyId, address custodian);
    event KeyRecovered(bytes32 indexed keyId, uint256 sharesUsed);
    event SecurityPolicyViolation(bytes32 indexed keyId, string violation);

    // Errors
    error KeyNotFound(bytes32 keyId);
    error KeyExpiredError(bytes32 keyId);
    error UnauthorizedKeyAccess(bytes32 keyId, address user);
    error KeyUsageLimitExceeded(bytes32 keyId);
    error InvalidKeyOperation(bytes32 keyId, KeyOperationType operation);
    error PolicyViolation(bytes32 keyId, string reason);
    error InsufficientRecoveryShares(bytes32 keyId, uint256 provided, uint256 required);
    error KeyAlreadyExists(bytes32 keyId);

    constructor(address _hsm) {
        hsm = HardwareSecurityModule(_hsm);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KEY_MANAGER, msg.sender);
        _grantRole(KEY_USER, msg.sender);

        // Initialize recovery custodians
        _initializeRecoveryCustodians();
    }

    // ============ Key Lifecycle Management ============

    /**
     * @notice Create a new secure key
     * @param keyType Type of key to create
     * @param purpose Intended purpose
     * @param exportable Whether key can be exported
     * @param authorizedUsers Addresses allowed to use the key
     */
    function createSecureKey(
        KeyType keyType,
        KeyPurpose purpose,
        bool exportable,
        address[] calldata authorizedUsers
    ) external onlyRole(KEY_MANAGER) returns (bytes32 keyId) {
        keyId = keccak256(abi.encode(
            "SECURE_KEY",
            msg.sender,
            keyType,
            purpose,
            block.timestamp,
            block.number
        ));

        require(keyMetadata[keyId].keyId == bytes32(0), "Key already exists");

        // Create key in HSM
        bytes32 hsmDeviceId = _selectHSMDevice();
        bytes32 hsmKeyId = hsm.generateSecureKey(
            hsmDeviceId,
            _mapToHSMKeyType(keyType),
            _mapToHSMKeyUsage(purpose),
            exportable
        );

        KeyMetadata storage key = keyMetadata[keyId];
        key.keyId = keyId;
        key.owner = msg.sender;
        key.keyType = keyType;
        key.purpose = purpose;
        key.createdAt = block.timestamp;
        key.lastUsed = block.timestamp;
        key.isActive = true;
        key.exportable = exportable;
        key.hsmDeviceId = hsmDeviceId;
        key.securityLevel = _calculateSecurityLevel(keyType, hsmDeviceId);
        
        // Store authorized users - convert addresses to bytes32
        key.authorizedUsers = new bytes32[](authorizedUsers.length);
        for (uint256 i = 0; i < authorizedUsers.length; i++) {
            key.authorizedUsers[i] = bytes32(uint256(uint160(authorizedUsers[i])));
        }

        // Set default policy
        key.policy = KeyPolicy({
            maxUsageCount: 1000000, // 1M operations
            expiryTime: block.timestamp + MAX_KEY_LIFETIME,
            requireMFA: purpose == KeyPurpose.SIGNATURE,
            allowDelegation: false,
            minSecurityLevel: 3,
            allowedOperations: _getDefaultAllowedOperations(purpose)
        });

        activeKeys.push(keyId);

        // Generate recovery shares
        _generateRecoveryShares(keyId);

        emit KeyCreated(keyId, keyType, msg.sender);
        emit RecoveryShareGenerated(keyId, address(0)); // Signal share generation
    }

    /**
     * @notice Perform cryptographic operation with key
     * @param keyId Key to use
     * @param operation Type of operation
     * @param inputData Input data for operation
     */
    function performKeyOperation(
        bytes32 keyId,
        KeyOperationType operation,
        bytes calldata inputData
    ) external onlyRole(KEY_USER) returns (bytes32 operationId, bytes memory result) {
        KeyMetadata storage key = keyMetadata[keyId];
        require(key.keyId != bytes32(0), "Key not found");
        require(key.isActive, "Key not active");
        require(block.timestamp <= key.policy.expiryTime, "Key expired");

        // Check authorization
        require(_isAuthorizedUser(keyId, msg.sender), "Unauthorized access");

        // Check policy compliance
        require(key.usageCount < key.policy.maxUsageCount, "Usage limit exceeded");
        require(_isAllowedOperation(keyId, operation), "Operation not allowed");

        // Perform operation via HSM
        (bytes32 hsmOpId, bytes memory hsmResult) = hsm.performCryptoOperation(
            key.hsmDeviceId,
            keyId, // Assuming keyId maps to HSM key ID
            _mapToHSMOperation(operation),
            inputData
        );

        // Record operation
        operationId = keccak256(abi.encode(
            "KEY_OPERATION",
            keyId,
            operation,
            msg.sender,
            block.timestamp
        ));

        KeyOperation memory op = KeyOperation({
            operationId: operationId,
            keyId: keyId,
            opType: operation,
            requester: msg.sender,
            inputData: inputData,
            result: hsmResult,
            timestamp: block.timestamp,
            authorized: true,
            auditHash: keccak256(abi.encode(hsmOpId, hsmResult))
        });

        keyOperations[keyId].push(op);
        key.usageCount++;
        key.lastUsed = block.timestamp;

        // Check for policy violations
        _checkPolicyCompliance(keyId);

        emit KeyOperationPerformed(keyId, operation, msg.sender);
        return (operationId, hsmResult);
    }

    // ============ Key Rotation & Lifecycle ============

    /**
     * @notice Rotate an existing key
     * @param oldKeyId Key to rotate
     * @param newKeyType Type for new key
     * @param newPurpose Purpose for new key
     */
    function rotateKey(
        bytes32 oldKeyId,
        KeyType newKeyType,
        KeyPurpose newPurpose
    ) external returns (bytes32 newKeyId) {
        KeyMetadata storage oldKey = keyMetadata[oldKeyId];
        require(oldKey.keyId != bytes32(0), "Key not found");
        require(oldKey.owner == msg.sender || hasRole(KEY_MANAGER, msg.sender), "Unauthorized");

        // Create new key
        address[] memory authorizedUsers = new address[](oldKey.authorizedUsers.length);
        for (uint256 i = 0; i < oldKey.authorizedUsers.length; i++) {
            authorizedUsers[i] = address(uint160(uint256(oldKey.authorizedUsers[i])));
        }
        newKeyId = this.createSecureKey(newKeyType, newPurpose, oldKey.exportable, authorizedUsers);

        // Copy policy with updates
        KeyMetadata storage newKey = keyMetadata[newKeyId];
        newKey.policy = oldKey.policy;
        newKey.policy.expiryTime = block.timestamp + MAX_KEY_LIFETIME;

        // Deactivate old key (but keep for decryption of old data)
        oldKey.isActive = false;

        emit KeyRotated(oldKeyId, newKeyId);
    }

    /**
     * @notice Destroy a key permanently
     * @param keyId Key to destroy
     * @param reason Reason for destruction
     */
    function destroyKey(
        bytes32 keyId,
        string calldata reason
    ) external {
        KeyMetadata storage key = keyMetadata[keyId];
        require(key.keyId != bytes32(0), "Key not found");
        require(key.owner == msg.sender || hasRole(KEY_MANAGER, msg.sender), "Unauthorized");

        // Destroy in HSM
        hsm.destroyKey(keyId, reason);

        key.isActive = false;
        expiredKeys.push(keyId);

        emit KeyDestroyed(keyId, reason);
    }

    // ============ Key Recovery System ============

    /**
     * @notice Recover a key using recovery shares
     * @param keyId Key to recover
     * @param recoveryShares Array of recovery shares
     */
    function recoverKey(
        bytes32 keyId,
        bytes32[] calldata recoveryShares
    ) external onlyRole(EMERGENCY_RECOVERY) returns (bool recovered) {
        KeyRecoveryShare[] storage shares = keyRecoveryShares[keyId];
        require(shares.length > 0, "No recovery shares");

        uint256 validShares = 0;
        for (uint256 i = 0; i < recoveryShares.length; i++) {
            for (uint256 j = 0; j < shares.length; j++) {
                if (shares[j].encryptedShare == recoveryShares[i] && !shares[j].revealed) {
                    shares[j].revealed = true;
                    validShares++;
                    break;
                }
            }
        }

        require(validShares >= recoveryThreshold, "Insufficient valid shares");

        // Reconstruct key (simplified - in practice would use Shamir's secret sharing)
        KeyMetadata storage key = keyMetadata[keyId];
        key.isActive = true;

        emit KeyRecovered(keyId, validShares);
        return true;
    }

    // ============ Policy Management ============

    /**
     * @notice Update key policy
     * @param keyId Key to update
     * @param newPolicy Updated policy
     */
    function updateKeyPolicy(
        bytes32 keyId,
        KeyPolicy calldata newPolicy
    ) external {
        KeyMetadata storage key = keyMetadata[keyId];
        require(key.keyId != bytes32(0), "Key not found");
        require(key.owner == msg.sender || hasRole(KEY_MANAGER, msg.sender), "Unauthorized");

        key.policy = newPolicy;
    }

    /**
     * @notice Add authorized user to key
     * @param keyId Key to modify
     * @param user User to authorize
     */
    function addAuthorizedUser(bytes32 keyId, address user) external {
        KeyMetadata storage key = keyMetadata[keyId];
        require(key.keyId != bytes32(0), "Key not found");
        require(key.owner == msg.sender || hasRole(KEY_MANAGER, msg.sender), "Unauthorized");

        key.authorizedUsers.push(bytes32(uint256(uint160(user))));
    }

    // ============ Internal Functions ============

    function _selectHSMDevice() internal view returns (bytes32) {
        // Select healthiest HSM device
        // In production, would query HSM contract for device status
        return bytes32("DEFAULT_HSM_DEVICE");
    }

    function _mapToHSMKeyType(KeyType keyType) internal pure returns (HardwareSecurityModule.KeyType) {
        if (keyType == KeyType.SYMMETRIC_AES) return HardwareSecurityModule.KeyType.SYMMETRIC;
        if (keyType == KeyType.ASYMMETRIC_RSA) return HardwareSecurityModule.KeyType.RSA;
        if (keyType == KeyType.ASYMMETRIC_ECC) return HardwareSecurityModule.KeyType.ECC;
        return HardwareSecurityModule.KeyType.QUANTUM_RESISTANT;
    }

    function _mapToHSMKeyUsage(KeyPurpose purpose) internal pure returns (HardwareSecurityModule.KeyUsage) {
        if (purpose == KeyPurpose.ENCRYPTION) return HardwareSecurityModule.KeyUsage.ENCRYPTION;
        if (purpose == KeyPurpose.SIGNATURE) return HardwareSecurityModule.KeyUsage.SIGNING;
        if (purpose == KeyPurpose.KEY_AGREEMENT) return HardwareSecurityModule.KeyUsage.KEY_AGREEMENT;
        return HardwareSecurityModule.KeyUsage.ATTESTATION;
    }

    function _mapToHSMOperation(KeyOperationType operation) internal pure returns (HardwareSecurityModule.CryptoOperation) {
        if (operation == KeyOperationType.ENCRYPT) return HardwareSecurityModule.CryptoOperation.ENCRYPT;
        if (operation == KeyOperationType.DECRYPT) return HardwareSecurityModule.CryptoOperation.DECRYPT;
        if (operation == KeyOperationType.SIGN) return HardwareSecurityModule.CryptoOperation.SIGN;
        return HardwareSecurityModule.CryptoOperation.VERIFY;
    }

    function _calculateSecurityLevel(KeyType keyType, bytes32 hsmDeviceId) internal view returns (uint256) {
        uint256 baseLevel = 3;

        // Adjust based on key type
        if (keyType == KeyType.QUANTUM_RESISTANT_KYBER || keyType == KeyType.SIGNATURE_DILITHIUM) {
            baseLevel += 2;
        } else if (keyType == KeyType.ASYMMETRIC_ECC || keyType == KeyType.SIGNATURE_ED25519) {
            baseLevel += 1;
        }

        // Check HSM security level
        if (hsm.isHSMHealthy(hsmDeviceId)) {
            (, uint256 hsmLevel, , , ) = hsm.getHSMStatus(hsmDeviceId);
            baseLevel = (baseLevel + hsmLevel) / 2;
        }

        return baseLevel > 5 ? 5 : baseLevel;
    }

    function _getDefaultAllowedOperations(KeyPurpose purpose) internal pure returns (bytes32[] memory) {
        bytes32[] memory operations = new bytes32[](3);

        if (purpose == KeyPurpose.ENCRYPTION) {
            operations[0] = keccak256("ENCRYPT");
            operations[1] = keccak256("DECRYPT");
            operations[2] = keccak256("WRAP");
        } else if (purpose == KeyPurpose.SIGNATURE) {
            operations[0] = keccak256("SIGN");
            operations[1] = keccak256("VERIFY");
        } else {
            operations[0] = keccak256("DERIVE");
        }

        return operations;
    }

    function _isAuthorizedUser(bytes32 keyId, address user) internal view returns (bool) {
        KeyMetadata storage key = keyMetadata[keyId];

        // Owner always authorized
        if (key.owner == user) return true;

        // Check authorized users list
        for (uint256 i = 0; i < key.authorizedUsers.length; i++) {
            if (address(uint160(uint256(key.authorizedUsers[i]))) == user) {
                return true;
            }
        }

        return false;
    }

    function _isAllowedOperation(bytes32 keyId, KeyOperationType operation) internal view returns (bool) {
        KeyMetadata storage key = keyMetadata[keyId];
        bytes32 opHash = keccak256(abi.encode(operation));

        for (uint256 i = 0; i < key.policy.allowedOperations.length; i++) {
            if (key.policy.allowedOperations[i] == opHash) {
                return true;
            }
        }

        return false;
    }

    function _checkPolicyCompliance(bytes32 keyId) internal {
        KeyMetadata storage key = keyMetadata[keyId];

        // Check usage limits
        if (key.usageCount >= key.policy.maxUsageCount) {
            emit SecurityPolicyViolation(keyId, "Usage limit exceeded");
        }

        // Check expiry
        if (block.timestamp > key.policy.expiryTime) {
            key.isActive = false;
            emit KeyExpired(keyId);
        }
    }

    function _generateRecoveryShares(bytes32 keyId) internal {
        // Generate 5 recovery shares (3-of-5 threshold)
        for (uint256 i = 0; i < totalRecoveryCustodians; i++) {
            address custodian = address(uint160(uint256(keccak256(abi.encode(
                "RECOVERY_CUSTODIAN",
                i,
                keyId,
                block.timestamp
            )))));

            bytes32 shareId = keccak256(abi.encode("RECOVERY_SHARE", keyId, custodian));
            bytes32 encryptedShare = keccak256(abi.encode(
                keyId,
                custodian,
                "ENCRYPTED_SHARE",
                block.timestamp
            ));

            KeyRecoveryShare memory share = KeyRecoveryShare({
                shareId: shareId,
                keyId: keyId,
                custodian: custodian,
                encryptedShare: encryptedShare,
                revealed: false,
                thresholdRequired: recoveryThreshold
            });

            keyRecoveryShares[keyId].push(share);
        }
    }

    function _initializeRecoveryCustodians() internal {
        // Initialize with trusted custodians (in production, these would be secure entities)
        for (uint256 i = 0; i < totalRecoveryCustodians; i++) {
            address custodian = address(uint160(uint256(keccak256(abi.encode("CUSTODIAN", i)))));
            recoveryCustodians[custodian] = true;
        }
    }

    // ============ View Functions ============

    function getKeyInfo(bytes32 keyId) external view returns (
        KeyType keyType,
        KeyPurpose purpose,
        address owner,
        bool isActive,
        uint256 securityLevel,
        uint256 usageCount
    ) {
        KeyMetadata storage key = keyMetadata[keyId];
        return (
            key.keyType,
            key.purpose,
            key.owner,
            key.isActive,
            key.securityLevel,
            key.usageCount
        );
    }

    function getKeyPolicy(bytes32 keyId) external view returns (
        uint256 maxUsageCount,
        uint256 expiryTime,
        bool requireMFA,
        uint256 minSecurityLevel
    ) {
        KeyMetadata storage key = keyMetadata[keyId];
        return (
            key.policy.maxUsageCount,
            key.policy.expiryTime,
            key.policy.requireMFA,
            key.policy.minSecurityLevel
        );
    }

    function getKeyOperations(bytes32 keyId, uint256 start, uint256 count) external view returns (
        bytes32[] memory operationIds,
        KeyOperationType[] memory opTypes,
        address[] memory requesters,
        uint256[] memory timestamps
    ) {
        KeyOperation[] storage operations = keyOperations[keyId];
        uint256 end = start + count > operations.length ? operations.length : start + count;

        operationIds = new bytes32[](end - start);
        opTypes = new KeyOperationType[](end - start);
        requesters = new address[](end - start);
        timestamps = new uint256[](end - start);

        for (uint256 i = start; i < end; i++) {
            operationIds[i - start] = operations[i].operationId;
            opTypes[i - start] = operations[i].opType;
            requesters[i - start] = operations[i].requester;
            timestamps[i - start] = operations[i].timestamp;
        }

        return (operationIds, opTypes, requesters, timestamps);
    }

    function getActiveKeys() external view returns (bytes32[] memory) {
        return activeKeys;
    }

    function getRecoveryShares(bytes32 keyId) external view returns (
        address[] memory custodians,
        bool[] memory revealed
    ) {
        KeyRecoveryShare[] storage shares = keyRecoveryShares[keyId];

        custodians = new address[](shares.length);
        revealed = new bool[](shares.length);

        for (uint256 i = 0; i < shares.length; i++) {
            custodians[i] = shares[i].custodian;
            revealed[i] = shares[i].revealed;
        }

        return (custodians, revealed);
    }

    function isKeyAuthorized(bytes32 keyId, address user) external view returns (bool) {
        return _isAuthorizedUser(keyId, user);
    }

    function getKeyHealth(bytes32 keyId) external view returns (
        bool isActive,
        bool isExpired,
        uint256 usagePercentage,
        uint256 daysUntilExpiry
    ) {
        KeyMetadata storage key = keyMetadata[keyId];

        uint256 usagePercentageCalc = key.policy.maxUsageCount > 0 ?
            (key.usageCount * 100) / key.policy.maxUsageCount : 0;

        uint256 daysUntilExpiryCalc = key.policy.expiryTime > block.timestamp ?
            (key.policy.expiryTime - block.timestamp) / 1 days : 0;

        return (
            key.isActive,
            block.timestamp > key.policy.expiryTime,
            usagePercentageCalc,
            daysUntilExpiryCalc
        );
    }
}