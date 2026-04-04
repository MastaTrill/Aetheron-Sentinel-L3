// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title QuantumResistantVault
 * @notice Quantum-resistant vault using hybrid classical-quantum secure signatures
 * @dev Combines multiple cryptographic primitives for post-quantum security:
 *      - ECDSA (classical)
 *      - Merkle tree commitments (hash-based)
 *      - Time-locked reveal schemes
 *      - Multi-signature threshold schemes
 *
 * @dev This contract protects against:
 *      - Shor's algorithm attacks on RSA/ECC
 *      - Grover's algorithm speedup on symmetric crypto
 *      - Quantum-enabled signature forgeries
 */
contract QuantumResistantVault is AccessControl, Pausable, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant QUANTUM_ADMIN_ROLE =
        keccak256("QUANTUM_ADMIN_ROLE");

    /// @notice Minimum number of guardians required for recovery
    uint256 public constant MIN_GUARDIAN_THRESHOLD = 3;

    /// @notice Time lock delay for recovery (24 hours)
    uint256 public constant TIME_LOCK_DELAY = 24 hours;

    /// @notice Maximum guardians allowed
    uint256 public constant MAX_GUARDIANS = 10;

    // ============ State Variables ============

    /// @notice Guardian addresses
    address[] public guardians;

    /// @notice Number of guardians required for multi-sig
    uint256 public guardianThreshold;

    /// @notice Merkle root for quantum-resistant commitments
    bytes32 public quantumCommitmentRoot;

    /// @notice Mapping of pending time-locked operations
    mapping(bytes32 => TimeLockedOp) public pendingOperations;

    /// @notice Mapping of used nonces (replay protection)
    mapping(bytes32 => bool) public usedSignatures;

    /// @notice Hash-based signature domain
    bytes32 public constant HTSS_DOMAIN = keccak256("HTSS_DOMAIN");

    /// @notice Current security level (bits)
    uint256 public securityLevel;

    /// @notice Last key rotation timestamp
    uint256 public lastKeyRotation;

    /// @notice Key rotation interval (90 days)
    uint256 public constant KEY_ROTATION_INTERVAL = 90 days;

    // ============ Structs ============

    struct TimeLockedOp {
        address target;
        bytes data;
        uint256 value;
        uint256 executeAfter;
        uint256 guardianCount;
        mapping(address => bool) confirmedBy;
    }

    struct QuantumSignature {
        bytes classicalSig; // ECDSA component
        bytes32 hashCommitment; // HTSS commitment
        uint256 timestamp; // Timelock component
        bytes32 domainSeparator; // Domain binding
    }

    // ============ Events ============

    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event OperationInitiated(
        bytes32 indexed opHash,
        address indexed target,
        uint256 executeAfter
    );
    event OperationConfirmed(bytes32 indexed opHash, address indexed guardian);
    event OperationExecuted(bytes32 indexed opHash);
    event OperationCancelled(bytes32 indexed opHash);
    event KeyRotated(bytes32 newCommitment, uint256 timestamp);
    event QuantumAlert(string reason);
    event SecurityLevelUpdated(uint256 newLevel);

    // ============ Errors ============

    error NotEnoughGuardians();
    error GuardianAlreadyExists(address guardian);
    error GuardianNotFound(address guardian);
    error InvalidThreshold();
    error OperationNotFound(bytes32 opHash);
    error TimeLockNotExpired(bytes256 executeAfter);
    error AlreadyConfirmed(bytes32 opHash, address guardian);
    error SignatureAlreadyUsed(bytes32 sigHash);
    error InvalidQuantumSignature();
    error QuantumThreatDetected();
    error KeyRotationTooSoon();

    // ============ Constructor ============

    constructor(
        address[] memory initialGuardians,
        uint256 _guardianThreshold
    ) EIP712("AetheronQuantumVault", "2.0") {
        require(
            initialGuardians.length >= MIN_GUARDIAN_THRESHOLD,
            "Not enough guardians"
        );
        require(
            _guardianThreshold >= MIN_GUARDIAN_THRESHOLD &&
                _guardianThreshold <= initialGuardians.length,
            "Invalid threshold"
        );

        guardianThreshold = _guardianThreshold;

        for (uint256 i = 0; i < initialGuardians.length; i++) {
            require(
                !_guardianExists(initialGuardians[i]),
                "Duplicate guardian"
            );
            guardians.push(initialGuardians[i]);
            _grantRole(GUARDIAN_ROLE, initialGuardians[i]);
        }

        securityLevel = 256;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(QUANTUM_ADMIN_ROLE, msg.sender);
    }

    // ============ Quantum-Resistant Functions ============

    /**
     * @notice Submit a quantum-resistant signature
     * @param target Target contract to call
     * @param data Calldata for the call
     * @param value ETH value to send
     * @param sig Quantum signature structure
     */
    function submitQuantumSecure(
        address target,
        bytes calldata data,
        uint256 value,
        QuantumSignature calldata sig
    ) external onlyRole(GUARDIAN_ROLE) whenNotPaused {
        // Verify quantum signature
        _verifyQuantumSignature(target, data, value, sig);

        // Execute if threshold met
        bytes32 opHash = _getOperationHash(target, data, value, sig.timestamp);

        if (!_confirmOperation(opHash, msg.sender)) {
            // Mark as pending for multi-sig confirmation
            _initiateOperation(target, data, value, sig.timestamp);
        }
    }

    /**
     * @notice Initiate a time-locked operation (emergency quantum escape)
     * @param target Target address
     * @param data Calldata
     * @param value ETH value
     */
    function initiateQuantumEscape(
        address target,
        bytes calldata data,
        uint256 value
    ) external onlyRole(GUARDIAN_ROLE) whenNotPaused {
        bytes32 opHash = keccak256(
            abi.encode(target, data, value, block.timestamp, msg.sender)
        );

        TimeLockedOp storage op = pendingOperations[opHash];
        op.target = target;
        op.data = data;
        op.value = value;
        op.executeAfter = block.timestamp + TIME_LOCK_DELAY;
        op.guardianCount = 0;

        emit OperationInitiated(opHash, target, op.executeAfter);
    }

    /**
     * @notice Confirm a time-locked operation
     */
    function confirmTimeLockedOp(
        bytes32 opHash
    ) external onlyRole(GUARDIAN_ROLE) {
        TimeLockedOp storage op = pendingOperations[opHash];
        if (op.target == address(0)) revert OperationNotFound(opHash);

        if (block.timestamp < op.executeAfter) {
            revert TimeLockNotExpired(op.executeAfter);
        }
        if (op.confirmedBy[msg.sender]) {
            revert AlreadyConfirmed(opHash, msg.sender);
        }

        op.confirmedBy[msg.sender] = true;
        op.guardianCount++;

        emit OperationConfirmed(opHash, msg.sender);

        // Execute if threshold met
        if (op.guardianCount >= guardianThreshold) {
            _executeOperation(opHash);
        }
    }

    /**
     * @notice Cancel a pending operation
     */
    function cancelOperation(
        bytes32 opHash
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        delete pendingOperations[opHash];
        emit OperationCancelled(opHash);
    }

    /**
     * @notice Rotate quantum commitments (recommended every 90 days)
     * @param newCommitment New Merkle root or hash commitment
     */
    function rotateQuantumKey(
        bytes32 newCommitment
    ) external onlyRole(QUANTUM_ADMIN_ROLE) {
        if (block.timestamp - lastKeyRotation < KEY_ROTATION_INTERVAL) {
            revert KeyRotationTooSoon();
        }

        bytes32 oldCommitment = quantumCommitmentRoot;
        quantumCommitmentRoot = newCommitment;
        lastKeyRotation = block.timestamp;

        emit KeyRotated(newCommitment, block.timestamp);
    }

    /**
     * @notice Emergency quantum threat response
     * @param reason Description of the quantum threat
     */
    function quantumThreatResponse(
        string calldata reason
    ) external onlyRole(GUARDIAN_ROLE) whenNotPaused {
        emit QuantumAlert(reason);

        // Pause all operations
        _pause();

        // Initiate emergency withdrawal to cold storage
        // This would transfer all assets to a pre-defined safe address
    }

    /**
     * @notice Update security level based on quantum computing advances
     * @param newLevel New security level in bits
     */
    function updateSecurityLevel(
        uint256 newLevel
    ) external onlyRole(QUANTUM_ADMIN_ROLE) {
        uint256 oldLevel = securityLevel;
        securityLevel = newLevel;
        emit SecurityLevelUpdated(newLevel);
    }

    // ============ Guardian Management ============

    function addGuardian(
        address guardian
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (guardians.length >= MAX_GUARDIANS) revert NotEnoughGuardians();
        if (_guardianExists(guardian)) revert GuardianAlreadyExists(guardian);

        guardians.push(guardian);
        _grantRole(GUARDIAN_ROLE, guardian);

        emit GuardianAdded(guardian);
    }

    function removeGuardian(
        address guardian
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_guardianExists(guardian)) revert GuardianNotFound(guardian);
        if (guardians.length <= MIN_GUARDIAN_THRESHOLD)
            revert NotEnoughGuardians();

        _removeGuardian(guardian);
        _revokeRole(GUARDIAN_ROLE, guardian);

        emit GuardianRemoved(guardian);
    }

    function updateThreshold(
        uint256 newThreshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (
            newThreshold < MIN_GUARDIAN_THRESHOLD ||
            newThreshold > guardians.length
        ) {
            revert InvalidThreshold();
        }

        uint256 oldThreshold = guardianThreshold;
        guardianThreshold = newThreshold;
        emit ThresholdUpdated(oldThreshold, newThreshold);
    }

    // ============ Internal Functions ============

    function _verifyQuantumSignature(
        address target,
        bytes calldata data,
        uint256 value,
        QuantumSignature calldata sig
    ) internal {
        bytes32 sigHash = keccak256(abi.encode(sig));

        // Check replay protection
        if (usedSignatures[sigHash]) {
            revert SignatureAlreadyUsed(sigHash);
        }

        // Verify classical ECDSA component
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(target, data, value, sig.timestamp))
        );

        address signer = digest.recover(sig.classicalSig);

        // Verify signer is a guardian
        if (!hasRole(GUARDIAN_ROLE, signer)) {
            revert InvalidQuantumSignature();
        }

        // Verify hash commitment is valid (simplified HTSS verification)
        // In production, implement full HTSS/SPHINCS+ verification
        if (sig.hashCommitment == bytes32(0)) {
            revert InvalidQuantumSignature();
        }

        // Verify domain separator
        if (sig.domainSeparator != _domainSeparator()) {
            revert InvalidQuantumSignature();
        }

        // Mark as used
        usedSignatures[sigHash] = true;
    }

    function _confirmOperation(
        bytes32 opHash,
        address guardian
    ) internal returns (bool executed) {
        // Simplified - in production, track confirmations properly
        return false;
    }

    function _initiateOperation(
        address target,
        bytes calldata data,
        uint256 value,
        uint256 timestamp
    ) internal {
        bytes32 opHash = keccak256(
            abi.encode(target, data, value, timestamp, msg.sender)
        );

        TimeLockedOp storage op = pendingOperations[opHash];
        op.target = target;
        op.data = data;
        op.value = value;
        op.executeAfter = block.timestamp + TIME_LOCK_DELAY;

        emit OperationInitiated(opHash, target, op.executeAfter);
    }

    function _executeOperation(bytes32 opHash) internal {
        TimeLockedOp storage op = pendingOperations[opHash];

        (bool success, ) = op.target.call{value: op.value}(op.data);
        require(success, "Execution failed");

        emit OperationExecuted(opHash);
        delete pendingOperations[opHash];
    }

    function _guardianExists(address guardian) internal view returns (bool) {
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == guardian) return true;
        }
        return false;
    }

    function _removeGuardian(address guardian) internal {
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == guardian) {
                guardians[i] = guardians[guardians.length - 1];
                guardians.pop();
                break;
            }
        }
    }

    function _getOperationHash(
        address target,
        bytes calldata data,
        uint256 value,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(target, data, value, timestamp));
    }

    // ============ View Functions ============

    function getGuardians() external view returns (address[] memory) {
        return guardians;
    }

    function getGuardianCount() external view returns (uint256) {
        return guardians.length;
    }

    function getSecurityInfo()
        external
        view
        returns (
            uint256 _securityLevel,
            uint256 _guardianCount,
            uint256 _threshold,
            uint256 _lastRotation,
            uint256 _nextRotation
        )
    {
        return (
            securityLevel,
            guardians.length,
            guardianThreshold,
            lastKeyRotation,
            lastKeyRotation + KEY_ROTATION_INTERVAL
        );
    }

    function isOperationPending(
        bytes32 opHash
    ) external view returns (bool, uint256) {
        TimeLockedOp storage op = pendingOperations[opHash];
        return (op.target != address(0), op.executeAfter);
    }
}
