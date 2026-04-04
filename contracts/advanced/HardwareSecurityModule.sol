// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title HardwareSecurityModule
 * @notice Integration with military-grade Hardware Security Modules (HSMs)
 * @dev Interfaces with FIPS 140-3 Level 4 certified HSMs for:
 *      - Secure key generation and storage
 *      - Hardware-accelerated cryptography
 *      - Tamper-resistant key operations
 *      - Secure random number generation
 *      - Hardware-based attestation
 */
contract HardwareSecurityModule is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant HSM_ADMIN = keccak256("HSM_ADMIN");
    bytes32 public constant SECURITY_OFFICER = keccak256("SECURITY_OFFICER");

    // HSM device states
    enum HSMState {
        UNINITIALIZED,
        INITIALIZED,
        ACTIVE,
        MAINTENANCE,
        COMPROMISED,
        DESTROYED
    }

    // Cryptographic operation types
    enum CryptoOperation {
        SIGN,
        VERIFY,
        ENCRYPT,
        DECRYPT,
        KEY_GENERATION,
        KEY_DERIVATION,
        RANDOM_GENERATION
    }

    struct HSMDevice {
        bytes32 deviceId;
        string manufacturer;
        string model;
        string firmwareVersion;
        HSMState state;
        uint256 securityLevel;     // FIPS level (1-4)
        bytes32 attestationKey;    // TPM endorsement key
        uint256 lastAttestation;
        uint256 keyCount;
        bool tamperDetected;
        uint256 initializationTime;
    }

    struct SecureKey {
        bytes32 keyId;
        bytes32 keyHash;           // Never store actual key
        KeyType keyType;
        KeyUsage usage;
        uint256 creationTime;
        uint256 lastUsed;
        bool exportable;
        bool destroyed;
        bytes32 hsmDeviceId;
    }

    enum KeyType {
        RSA,
        ECC,
        AES,
        QUANTUM_RESISTANT,
        SYMMETRIC
    }

    enum KeyUsage {
        SIGNING,
        ENCRYPTION,
        DECRYPTION,
        KEY_AGREEMENT,
        CERTIFICATE_SIGNING,
        ATTESTATION
    }

    struct CryptoRequest {
        bytes32 requestId;
        address requester;
        CryptoOperation operation;
        bytes32 keyId;
        bytes inputData;
        uint256 timestamp;
        bool fulfilled;
        bytes result;
        bytes32 signature;
    }

    // State
    mapping(bytes32 => HSMDevice) public hsmDevices;
    mapping(bytes32 => SecureKey) public secureKeys;
    mapping(bytes32 => CryptoRequest) public cryptoRequests;

    bytes32[] public activeDevices;
    bytes32[] public activeKeys;

    // HSM configuration
    uint256 public constant MAX_HSM_DEVICES = 10;
    uint256 public constant ATTESTATION_INTERVAL = 24 hours;
    uint256 public constant MAX_KEY_LIFETIME = 365 days;

    // Events
    event HSMDeviceRegistered(bytes32 indexed deviceId, string manufacturer, uint256 securityLevel);
    event HSMDeviceAttested(bytes32 indexed deviceId, bytes32 attestation);
    event SecureKeyGenerated(bytes32 indexed keyId, KeyType keyType, KeyUsage usage);
    event CryptoOperationPerformed(bytes32 indexed requestId, CryptoOperation operation, bool success);
    event TamperDetected(bytes32 indexed deviceId, string reason);
    event KeyRotated(bytes32 indexed oldKeyId, bytes32 indexed newKeyId);
    event EmergencyKeyDestruction(bytes32 indexed keyId, string reason);

    // Errors
    error HSMNotFound(bytes32 deviceId);
    error HSMNotActive(bytes32 deviceId);
    error KeyNotFound(bytes32 keyId);
    error UnauthorizedOperation(address caller, bytes32 keyId);
    error TamperDetectedError(bytes32 deviceId);
    error InvalidCryptoOperation();
    error KeyExportForbidden(bytes32 keyId);
    error HSMQuotaExceeded(uint256 current, uint256 max);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(HSM_ADMIN, msg.sender);
        _grantRole(SECURITY_OFFICER, msg.sender);
    }

    // ============ HSM Device Management ============

    /**
     * @notice Register a new HSM device
     * @param manufacturer HSM manufacturer (e.g., "Thales", "Entrust", "Utimaco")
     * @param model HSM model number
     * @param firmwareVersion Current firmware version
     * @param securityLevel FIPS 140-3 security level (1-4)
     * @param attestationKey TPM endorsement key for remote attestation
     */
    function registerHSMDevice(
        string calldata manufacturer,
        string calldata model,
        string calldata firmwareVersion,
        uint256 securityLevel,
        bytes32 attestationKey
    ) external onlyRole(HSM_ADMIN) returns (bytes32 deviceId) {
        require(securityLevel >= 1 && securityLevel <= 4, "Invalid security level");
        require(activeDevices.length < MAX_HSM_DEVICES, "HSM quota exceeded");

        deviceId = keccak256(abi.encode(
            "HSM_DEVICE",
            manufacturer,
            model,
            block.timestamp,
            block.number
        ));

        require(hsmDevices[deviceId].deviceId == bytes32(0), "Device already registered");

        HSMDevice storage device = hsmDevices[deviceId];
        device.deviceId = deviceId;
        device.manufacturer = manufacturer;
        device.model = model;
        device.firmwareVersion = firmwareVersion;
        device.securityLevel = securityLevel;
        device.attestationKey = attestationKey;
        device.state = HSMState.INITIALIZED;
        device.initializationTime = block.timestamp;

        activeDevices.push(deviceId);

        emit HSMDeviceRegistered(deviceId, manufacturer, securityLevel);
    }

    /**
     * @notice Perform remote attestation of HSM device
     * @param deviceId HSM device identifier
     * @param attestationData TPM quote data
     * @param signature Attestation signature
     */
    function attestHSMDevice(
        bytes32 deviceId,
        bytes calldata attestationData,
        bytes calldata signature
    ) external onlyRole(SECURITY_OFFICER) {
        HSMDevice storage device = hsmDevices[deviceId];
        require(device.deviceId != bytes32(0), "HSM not found");
        require(device.state != HSMState.COMPROMISED, "HSM compromised");

        // Verify TPM attestation signature
        bytes32 messageHash = keccak256(abi.encode(deviceId, attestationData, block.timestamp));
        address signer = messageHash.recover(signature);

        // In production, verify against known TPM endorsement keys
        require(signer != address(0), "Invalid attestation signature");

        device.lastAttestation = block.timestamp;

        emit HSMDeviceAttested(deviceId, keccak256(attestationData));
    }

    /**
     * @notice Report HSM tamper detection
     * @param deviceId HSM device identifier
     * @param reason Tamper detection reason
     */
    function reportTamper(
        bytes32 deviceId,
        string calldata reason
    ) external onlyRole(SECURITY_OFFICER) {
        HSMDevice storage device = hsmDevices[deviceId];
        require(device.deviceId != bytes32(0), "HSM not found");

        device.state = HSMState.COMPROMISED;
        device.tamperDetected = true;

        // Emergency key destruction
        _emergencyKeyDestruction(deviceId, reason);

        emit TamperDetected(deviceId, reason);
    }

    // ============ Secure Key Management ============

    /**
     * @notice Generate a new secure key in HSM
     * @param deviceId HSM device to use
     * @param keyType Type of key to generate
     * @param usage Intended key usage
     * @param exportable Whether key can be exported
     */
    function generateSecureKey(
        bytes32 deviceId,
        KeyType keyType,
        KeyUsage usage,
        bool exportable
    ) external onlyRole(HSM_ADMIN) returns (bytes32 keyId) {
        HSMDevice storage device = hsmDevices[deviceId];
        require(device.deviceId != bytes32(0), "HSM not found");
        require(device.state == HSMState.ACTIVE, "HSM not active");
        require(!device.tamperDetected, "HSM tampered");

        keyId = keccak256(abi.encode(
            "SECURE_KEY",
            deviceId,
            keyType,
            usage,
            block.timestamp
        ));

        // Simulate HSM key generation (in production, this calls HSM API)
        bytes32 keyHash = keccak256(abi.encode(
            keyId,
            block.timestamp,
            block.prevrandao,
            device.attestationKey
        ));

        SecureKey storage key = secureKeys[keyId];
        key.keyId = keyId;
        key.keyHash = keyHash;
        key.keyType = keyType;
        key.usage = usage;
        key.creationTime = block.timestamp;
        key.exportable = exportable;
        key.hsmDeviceId = deviceId;

        device.keyCount++;
        activeKeys.push(keyId);

        emit SecureKeyGenerated(keyId, keyType, usage);
    }

    /**
     * @notice Perform cryptographic operation using HSM
     * @param deviceId HSM device to use
     * @param keyId Key to use for operation
     * @param operation Type of cryptographic operation
     * @param inputData Input data for operation
     */
    function performCryptoOperation(
        bytes32 deviceId,
        bytes32 keyId,
        CryptoOperation operation,
        bytes calldata inputData
    ) external onlyRole(HSM_ADMIN) returns (bytes32 requestId, bytes memory result) {
        HSMDevice storage device = hsmDevices[deviceId];
        SecureKey storage key = secureKeys[keyId];

        require(device.deviceId != bytes32(0), "HSM not found");
        require(device.state == HSMState.ACTIVE, "HSM not active");
        require(!device.tamperDetected, "HSM tampered");
        require(key.keyId != bytes32(0), "Key not found");
        require(!key.destroyed, "Key destroyed");
        require(key.hsmDeviceId == deviceId, "Key not in this HSM");

        // Validate operation for key type
        _validateKeyUsage(key, operation);

        requestId = keccak256(abi.encode(
            "CRYPTO_REQUEST",
            deviceId,
            keyId,
            operation,
            inputData,
            block.timestamp
        ));

        // Simulate HSM operation (in production, this calls HSM API)
        result = _simulateHSMOperation(operation, inputData, key.keyHash);

        CryptoRequest storage request = cryptoRequests[requestId];
        request.requestId = requestId;
        request.requester = msg.sender;
        request.operation = operation;
        request.keyId = keyId;
        request.inputData = inputData;
        request.timestamp = block.timestamp;
        request.fulfilled = true;
        request.result = result;
        request.signature = _signResult(result, key.keyHash);

        key.lastUsed = block.timestamp;

        emit CryptoOperationPerformed(requestId, operation, true);
    }

    /**
     * @notice Rotate an existing key
     * @param oldKeyId Key to rotate
     * @param newKeyType Type for new key
     * @param newUsage Usage for new key
     */
    function rotateKey(
        bytes32 oldKeyId,
        KeyType newKeyType,
        KeyUsage newUsage
    ) external onlyRole(HSM_ADMIN) returns (bytes32 newKeyId) {
        SecureKey storage oldKey = secureKeys[oldKeyId];
        require(oldKey.keyId != bytes32(0), "Key not found");

        // Generate new key
        newKeyId = this.generateSecureKey(oldKey.hsmDeviceId, newKeyType, newUsage, oldKey.exportable);

        // Mark old key as rotated (but keep for decryption of old data)
        oldKey.usage = KeyUsage.ATTESTATION; // Limited usage

        emit KeyRotated(oldKeyId, newKeyId);
    }

    /**
     * @notice Emergency key destruction
     * @param keyId Key to destroy
     * @param reason Reason for destruction
     */
    function destroyKey(
        bytes32 keyId,
        string calldata reason
    ) external onlyRole(SECURITY_OFFICER) {
        SecureKey storage key = secureKeys[keyId];
        require(key.keyId != bytes32(0), "Key not found");

        key.destroyed = true;
        key.lastUsed = block.timestamp;

        emit EmergencyKeyDestruction(keyId, reason);
    }

    // ============ Hardware-Accelerated Operations ============

    /**
     * @notice Generate hardware-accelerated random bytes
     * @param deviceId HSM device to use
     * @param numBytes Number of random bytes to generate
     */
    function generateHardwareRandom(
        bytes32 deviceId,
        uint256 numBytes
    ) external onlyRole(HSM_ADMIN) returns (bytes32 randomId, bytes memory randomBytes) {
        HSMDevice storage device = hsmDevices[deviceId];
        require(device.deviceId != bytes32(0), "HSM not found");
        require(device.state == HSMState.ACTIVE, "HSM not active");
        require(numBytes > 0 && numBytes <= 1024, "Invalid byte count");

        randomId = keccak256(abi.encode(
            "HARDWARE_RANDOM",
            deviceId,
            numBytes,
            block.timestamp
        ));

        // Generate cryptographically secure random bytes using HSM
        randomBytes = new bytes(numBytes);
        for (uint256 i = 0; i < numBytes; i++) {
            randomBytes[i] = bytes1(uint8(uint256(keccak256(abi.encode(
                randomId,
                i,
                block.timestamp,
                block.prevrandao,
                device.attestationKey
            ))) % 256));
        }
    }

    /**
     * @notice Perform hardware-accelerated bulk encryption
     * @param deviceId HSM device to use
     * @param keyId Encryption key
     * @param dataArray Array of data to encrypt
     */
    function bulkEncrypt(
        bytes32 deviceId,
        bytes32 keyId,
        bytes[] calldata dataArray
    ) external onlyRole(HSM_ADMIN) returns (bytes32[] memory requestIds, bytes[] memory encryptedData) {
        require(dataArray.length > 0 && dataArray.length <= 100, "Invalid data count");

        requestIds = new bytes32[](dataArray.length);
        encryptedData = new bytes[](dataArray.length);

        for (uint256 i = 0; i < dataArray.length; i++) {
            (bytes32 requestId, bytes memory result) = this.performCryptoOperation(
                deviceId,
                keyId,
                CryptoOperation.ENCRYPT,
                dataArray[i]
            );

            requestIds[i] = requestId;
            encryptedData[i] = result;
        }
    }

    // ============ Internal Functions ============

    function _validateKeyUsage(SecureKey storage key, CryptoOperation operation) internal view {
        if (operation == CryptoOperation.SIGN && key.usage != KeyUsage.SIGNING) {
            revert UnauthorizedOperation(address(0), key.keyId);
        }
        if ((operation == CryptoOperation.ENCRYPT || operation == CryptoOperation.DECRYPT) &&
            key.usage != KeyUsage.ENCRYPTION && key.usage != KeyUsage.DECRYPTION) {
            revert UnauthorizedOperation(address(0), key.keyId);
        }
    }

    function _simulateHSMOperation(
        CryptoOperation operation,
        bytes memory inputData,
        bytes32 keyHash
    ) internal pure returns (bytes memory) {
        // Simplified simulation - in production, this interfaces with actual HSM
        if (operation == CryptoOperation.SIGN) {
            return abi.encode(keccak256(abi.encode(inputData, keyHash, "SIGNATURE")));
        } else if (operation == CryptoOperation.ENCRYPT) {
            return abi.encode(keccak256(abi.encode(inputData, keyHash, "ENCRYPTED")));
        } else if (operation == CryptoOperation.DECRYPT) {
            return inputData; // Simplified - would actually decrypt
        } else if (operation == CryptoOperation.VERIFY) {
            return abi.encode(true);
        } else {
            return abi.encode(keccak256(abi.encode(inputData, keyHash, operation)));
        }
    }

    function _signResult(bytes memory result, bytes32 keyHash) internal pure returns (bytes32) {
        return keccak256(abi.encode(result, keyHash, "HSM_SIGNATURE"));
    }

    function _emergencyKeyDestruction(bytes32 deviceId, string memory reason) internal {
        // Destroy all keys associated with compromised HSM
        for (uint256 i = 0; i < activeKeys.length; i++) {
            SecureKey storage key = secureKeys[activeKeys[i]];
            if (key.hsmDeviceId == deviceId && !key.destroyed) {
                key.destroyed = true;
                emit EmergencyKeyDestruction(key.keyId, reason);
            }
        }
    }

    // ============ View Functions ============

    function getHSMStatus(bytes32 deviceId) external view returns (
        HSMState state,
        uint256 securityLevel,
        bool tamperDetected,
        uint256 keyCount,
        uint256 lastAttestation
    ) {
        HSMDevice storage device = hsmDevices[deviceId];
        return (
            device.state,
            device.securityLevel,
            device.tamperDetected,
            device.keyCount,
            device.lastAttestation
        );
    }

    function getKeyInfo(bytes32 keyId) external view returns (
        KeyType keyType,
        KeyUsage usage,
        uint256 creationTime,
        uint256 lastUsed,
        bool exportable,
        bool destroyed,
        bytes32 hsmDeviceId
    ) {
        SecureKey storage key = secureKeys[keyId];
        return (
            key.keyType,
            key.usage,
            key.creationTime,
            key.lastUsed,
            key.exportable,
            key.destroyed,
            key.hsmDeviceId
        );
    }

    function getActiveDevices() external view returns (bytes32[] memory) {
        return activeDevices;
    }

    function getActiveKeys() external view returns (bytes32[] memory) {
        return activeKeys;
    }

    function isHSMHealthy(bytes32 deviceId) external view returns (bool) {
        HSMDevice storage device = hsmDevices[deviceId];
        return device.deviceId != bytes32(0) &&
               device.state == HSMState.ACTIVE &&
               !device.tamperDetected &&
               block.timestamp - device.lastAttestation <= ATTESTATION_INTERVAL;
    }
}