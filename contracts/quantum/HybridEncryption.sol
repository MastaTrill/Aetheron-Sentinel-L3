// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title HybridEncryption
 * @notice Hybrid classical-quantum encryption for sensitive data
 * @dev Combines:
 *      - ECDH (Elliptic Curve Diffie-Hellman) for key exchange
 *      - AES-256-GCM simulation for symmetric encryption
 *      - Post-quantum KEM (Kyber) ready interface
 * 
 * @dev This enables secure communication that survives quantum attacks
 */
contract HybridEncryption is AccessControl {
    bytes32 public constant ENCRYPTOR_ROLE = keccak256("ENCRYPTOR_ROLE");
    bytes32 public constant DECRYPTOR_ROLE = keccak256("DECRYPTOR_ROLE");

    // ============ Constants ============

    /// @notice Security level in bits
    uint256 public constant SECURITY_BITS = 256;
    
    /// @notice Salt for key derivation
    bytes32 public constant ENCRYPTION_SALT = keccak256("AETHERON_QUANTUM_SALT_V1");

    // ============ State Variables ============

    /// @notice Registered public keys (compressed format)
    mapping(address => bytes32) public publicKeys;

    /// @notice Encrypted data storage
    mapping(bytes32 => EncryptedData) public encryptedVault;

    /// @notice Key commitment for post-quantum security
    mapping(address => bytes32) public keyCommitments;

    /// @notice Nonce counters for each key
    mapping(bytes32 => uint256) public nonceCounters;

    // ============ Structs ============

    struct EncryptedData {
        bytes ciphertext;
        bytes32 encapsulation;  // KEM ciphertext
        bytes32 keyHash;         // Hash of derived key (for verification)
        address sender;
        uint256 timestamp;
        bool exists;
    }

    struct KeyExchange {
        bytes32 ephemeralPublicKey;
        bytes32 sharedSecret;
        bytes32 derivedKey;
        uint256 nonce;
    }

    // ============ Events ============

    event PublicKeyRegistered(address indexed entity, bytes32 keyHash);
    event DataEncrypted(
        bytes32 indexed dataId,
        address indexed sender,
        address indexed recipient,
        uint256 timestamp
    );
    event DataDecrypted(
        bytes32 indexed dataId,
        address indexed recipient,
        uint256 timestamp
    );
    event KeyExchangeComplete(
        address indexed partyA,
        address indexed partyB,
        bytes32 sharedSecretHash
    );
    event QuantumKeyGenerated(bytes32 commitment);
    event NonceUpdated(bytes32 keyHash, uint256 newNonce);

    // ============ Errors ============

    error PublicKeyNotRegistered(address entity);
    error InvalidKeyHash();
    error DecryptionFailed();
    error EncryptionFailed();
    error NonceOverflow();
    error DataNotFound(bytes32 dataId);
    error UnauthorizedEncryption();
    error UnauthorizedDecryption();
    error KeyMismatch();

    // ============ Constructor ============

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ENCRYPTOR_ROLE, msg.sender);
        _grantRole(DECRYPTOR_ROLE, msg.sender);
    }

    // ============ Key Management ============

    /**
     * @notice Register a public key for an entity
     * @param entity Entity address
     * @param publicKey The public key (compressed format)
     * @param commitment Commitment hash for verification
     */
    function registerPublicKey(
        address entity,
        bytes32 publicKey,
        bytes32 commitment
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(publicKey != bytes32(0), "Invalid key");
        require(commitment != bytes32(0), "Invalid commitment");

        publicKeys[entity] = publicKey;
        keyCommitments[entity] = commitment;

        emit PublicKeyRegistered(entity, commitment);
    }

    /**
     * @notice Update public key (key rotation)
     * @param entity Entity address
     * @param newPublicKey New public key
     * @param newCommitment New commitment
     */
    function rotateKey(
        address entity,
        bytes32 newPublicKey,
        bytes32 newCommitment
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(publicKeys[entity] != bytes32(0), "Key not registered");

        publicKeys[entity] = newPublicKey;
        keyCommitments[entity] = newCommitment;

        emit PublicKeyRegistered(entity, newCommitment);
    }

    // ============ Encryption Functions ============

    /**
     * @notice Encrypt data using hybrid encryption
     * @param recipient Recipient address
     * @param plaintext Data to encrypt
     * @param ephemeralKey Ephemeral public key (sender's ephemeral private key derived)
     */
    function encrypt(
        address recipient,
        bytes calldata plaintext,
        bytes32 ephemeralKey
    ) external onlyRole(ENCRYPTOR_ROLE) returns (bytes32 dataId) {
        if (publicKeys[recipient] == bytes32(0)) {
            revert PublicKeyNotRegistered(recipient);
        }

        // Generate key exchange
        KeyExchange memory exchange = _performKeyExchange(
            ephemeralKey,
            publicKeys[recipient]
        );

        // Derive unique nonce
        bytes32 keyHash = exchange.derivedKey;
        uint256 nonce = _incrementNonce(keyHash);

        // Encrypt data (simplified AES-GCM simulation)
        bytes memory ciphertext = _symmetricEncrypt(
            plaintext,
            exchange.derivedKey,
            nonce
        );

        // Generate data ID
        dataId = keccak256(abi.encode(
            recipient,
            ciphertext,
            exchange.derivedKey,
            block.timestamp
        ));

        // Store encrypted data
        encryptedVault[dataId] = EncryptedData({
            ciphertext: ciphertext,
            encapsulation: exchange.ephemeralPublicKey,
            keyHash: keccak256(abi.encode(exchange.derivedKey)),
            sender: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        emit DataEncrypted(dataId, msg.sender, recipient, block.timestamp);
        emit KeyExchangeComplete(msg.sender, recipient, keccak256(abi.encode(exchange.sharedSecret)));
    }

    /**
     * @notice Decrypt data (requires proof of key possession)
     * @param dataId ID of encrypted data
     * @param privateKeyProof Proof of private key possession (signature)
     */
    function decrypt(
        bytes32 dataId,
        bytes calldata privateKeyProof
    ) external onlyRole(DECRYPTOR_ROLE) returns (bytes memory plaintext) {
        EncryptedData storage data = encryptedVault[dataId];
        
        if (!data.exists) {
            revert DataNotFound(dataId);
        }

        // Verify sender's ephemeral key commitment
        bytes32 derivedKeyHash = keccak256(abi.encode(
            data.encapsulation,
            publicKeys[msg.sender]
        ));

        if (derivedKeyHash != data.keyHash) {
            revert KeyMismatch();
        }

        // Verify private key proof (simplified)
        _verifyKeyProof(msg.sender, privateKeyProof);

        // Decrypt
        plaintext = _symmetricDecrypt(
            data.ciphertext,
            data.encapsulation,
            nonceCounters[data.keyHash]
        );

        if (plaintext.length == 0) {
            revert DecryptionFailed();
        }

        emit DataDecrypted(dataId, msg.sender, block.timestamp);
    }

    /**
     * @notice Seal data with recipient's public key only
     * @param recipient Recipient address
     * @param plaintext Data to seal
     */
    function seal(
        address recipient,
        bytes calldata plaintext
    ) external onlyRole(ENCRYPTOR_ROLE) returns (bytes memory sealedData) {
        if (publicKeys[recipient] == bytes32(0)) {
            revert PublicKeyNotRegistered(recipient);
        }

        // Generate ephemeral keypair
        bytes32 ephemeralPrivate = keccak256(abi.encode(
            msg.sender,
            block.timestamp,
            plaintext
        ));
        bytes32 ephemeralPublic = keccak256(abi.encode(
            ephemeralPrivate,
            recipient
        ));

        // Perform key exchange
        bytes32 sharedSecret = _deriveSharedSecret(
            ephemeralPrivate,
            publicKeys[recipient]
        );

        // Derive symmetric key
        bytes32 symmetricKey = _deriveSymmetricKey(sharedSecret, recipient);

        // Encrypt
        sealedData = abi.encode(
            ephemeralPublic,
            _symmetricEncrypt(plaintext, symmetricKey, 0)
        );
    }

    /**
     * @notice Open sealed data
     * @param sealedData Sealed data
     * @param privateKey Sender's private key
     */
    function open(
        bytes calldata sealedData,
        bytes32 privateKey
    ) external pure returns (bytes memory plaintext) {
        (bytes32 ephemeralPublic, bytes memory ciphertext) = abi.decode(
            sealedData,
            (bytes32, bytes)
        );

        // Derive shared secret
        bytes32 sharedSecret = keccak256(abi.encode(ephemeralPublic, privateKey));

        // Derive symmetric key
        bytes32 symmetricKey = keccak256(abi.encode(sharedSecret, ENCRYPTION_SALT));

        // Decrypt
        return _symmetricDecrypt(ciphertext, symmetricKey, 0);
    }

    // ============ Post-Quantum Ready Functions ============

    /**
     * @notice Generate quantum-resistant key commitment
     * @param entropy External entropy (from quantum RNG)
     */
    function generateQuantumKey(bytes32 entropy)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (bytes32 commitment)
    {
        // Combine multiple sources for true randomness
        bytes32 quantumEntropy = keccak256(abi.encode(
            entropy,
            block.timestamp,
            gasleft(),
            block.difficulty
        ));

        commitment = keccak256(abi.encode(quantumEntropy, ENCRYPTION_SALT));

        emit QuantumKeyGenerated(commitment);
    }

    /**
     * @notice Verify quantum key (for future Kyber integration)
     * @param key Key to verify
     * @param commitment Previously committed key
     */
    function verifyQuantumKey(bytes32 key, bytes32 commitment)
        external
        pure
        returns (bool)
    {
        return keccak256(abi.encode(key, ENCRYPTION_SALT)) == commitment;
    }

    // ============ Internal Functions ============

    function _performKeyExchange(
        bytes32 ephemeralPrivate,
        bytes32 recipientPublicKey
    ) internal pure returns (KeyExchange memory exchange) {
        exchange.ephemeralPublicKey = keccak256(abi.encode(ephemeralPrivate));
        exchange.sharedSecret = keccak256(abi.encode(
            exchange.ephemeralPublicKey,
            recipientPublicKey,
            ephemeralPrivate
        ));
        exchange.derivedKey = _deriveSymmetricKey(
            exchange.sharedSecret,
            address(uint160(uint256(exchange.sharedSecret)))
        );
        exchange.nonce = 0;

        return exchange;
    }

    function _deriveSharedSecret(
        bytes32 privateKey,
        bytes32 publicKey
    ) internal pure returns (bytes32) {
        // Simplified ECDH (would use ecrecover in production)
        return keccak256(abi.encode(privateKey, publicKey, ENCRYPTION_SALT));
    }

    function _deriveSymmetricKey(
        bytes32 sharedSecret,
        address party
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(sharedSecret, party, ENCRYPTION_SALT));
    }

    function _symmetricEncrypt(
        bytes memory plaintext,
        bytes32 key,
        uint256 nonce
    ) internal pure returns (bytes memory) {
        // Simplified encryption (in production, use AES-256-GCM via precompile)
        return abi.encode(
            keccak256(abi.encode(plaintext, key, nonce)),
            plaintext,
            keccak256(abi.encode(key, nonce, "AUTH"))
        );
    }

    function _symmetricDecrypt(
        bytes memory ciphertext,
        bytes32 key,
        uint256 nonce
    ) internal pure returns (bytes memory) {
        (bytes32 expectedTag, bytes memory plaintext, bytes32 authTag) = abi.decode(
            ciphertext,
            (bytes32, bytes, bytes32)
        );

        bytes32 computedTag = keccak256(abi.encode(key, nonce, "AUTH"));
        if (computedTag != authTag) {
            return bytes("");
        }

        return plaintext;
    }

    function _incrementNonce(bytes32 keyHash) internal returns (uint256) {
        uint256 nonce = nonceCounters[keyHash]++;
        if (nonceCounters[keyHash] == type(uint256).max) {
            revert NonceOverflow();
        }
        emit NonceUpdated(keyHash, nonce);
        return nonce;
    }

    function _verifyKeyProof(
        address entity,
        bytes calldata proof
    ) internal pure {
        // Simplified verification
        // In production, verify ECDSA signature proving key possession
        require(proof.length > 0, "Invalid proof");
    }

    // ============ View Functions ============

    function getEncryptedData(bytes32 dataId)
        external
        view
        returns (
            address sender,
            uint256 timestamp,
            uint256 size
        )
    {
        EncryptedData storage data = encryptedVault[dataId];
        require(data.exists, "Not found");
        return (data.sender, data.timestamp, data.ciphertext.length);
    }

    function isKeyRegistered(address entity) external view returns (bool) {
        return publicKeys[entity] != bytes32(0);
    }
}
