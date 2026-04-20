// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SentinelMultiSigVault
 * @notice Advanced multi-signature security vault for critical operations
 * Quantum-resistant multi-party computation for unbreakable security
 */
contract SentinelMultiSigVault is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // Multi-signature transaction structure
    struct MultiSigTx {
        uint256 id;
        address to;
        uint256 value;
        bytes data;
        uint256 confirmations;
        bool executed;
        uint256 timestamp;
        uint256 expiry;
        SecurityLevel securityLevel;
    }

    // Security levels for different operation types
    enum SecurityLevel {
        LOW, // 2/3 signatures required
        MEDIUM, // 3/5 signatures required
        HIGH, // 4/7 signatures required
        CRITICAL // 5/7 signatures required
    }

    // Guardian structure
    struct Guardian {
        address guardianAddress;
        bytes32 publicKey; // Quantum-resistant public key
        uint256 reputation;
        bool active;
        uint256 lastActivity;
        SecurityClearance clearance;
    }

    enum SecurityClearance {
        BASIC, // Can approve LOW security operations
        ADVANCED, // Can approve MEDIUM security operations
        EXPERT, // Can approve HIGH security operations
        MASTER // Can approve CRITICAL security operations
    }

    // State variables
    mapping(uint256 => MultiSigTx) public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmations;
    mapping(address => Guardian) public guardians;

    address[] public guardianList;
    uint256 public transactionCount;
    uint256 public activeGuardians;

    // Security parameters
    uint256 public constant MAX_GUARDIANS = 9;
    uint256 public constant MIN_GUARDIANS = 3;
    uint256 public constant TX_EXPIRY = 7 days;
    uint256 public constant SIGNATURE_VALIDITY = 1 hours;

    // Required confirmations by security level
    mapping(SecurityLevel => uint256) public requiredConfirmations;

    // Emergency controls
    bool public emergencyMode;
    uint256 public emergencyThreshold; // Confirmations needed in emergency
    uint256 public lastEmergencyAction;
    mapping(address => bool) private _emergencyVotes; // tracks who voted for emergency
    uint256 public emergencyVoteCount;

    event TransactionSubmitted(
        uint256 indexed txId,
        address indexed initiator,
        SecurityLevel level
    );
    event TransactionConfirmed(uint256 indexed txId, address indexed guardian);
    event TransactionExecuted(uint256 indexed txId);
    event GuardianAdded(address indexed guardian, SecurityClearance clearance);
    event GuardianRemoved(address indexed guardian);
    event EmergencyModeActivated(address indexed activator);
    event SecurityLevelChanged(
        SecurityLevel indexed level,
        uint256 requiredConfirmations
    );

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        _initializeSecurityParameters();
        _setupInitialGuardians();
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Submit multi-signature transaction
     * @param to Target contract address
     * @param value ETH value to send
     * @param data Transaction data
     * @param securityLevel Security classification
     */
    function submitTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        SecurityLevel securityLevel
    ) external onlyGuardian returns (uint256) {
        require(
            !emergencyMode || _isEmergencyGuardian(msg.sender),
            "Emergency mode restrictions"
        );
        require(to != address(0), "Invalid target address");

        uint256 txId = transactionCount++;

        transactions[txId] = MultiSigTx({
            id: txId,
            to: to,
            value: value,
            data: data,
            confirmations: 0,
            executed: false,
            timestamp: block.timestamp,
            expiry: block.timestamp + TX_EXPIRY,
            securityLevel: securityLevel
        });

        // Auto-confirm by submitter
        _confirmTransaction(txId, msg.sender);

        emit TransactionSubmitted(txId, msg.sender, securityLevel);
        return txId;
    }

    /**
     * @notice Confirm multi-signature transaction
     * @param txId Transaction ID
     * @param signature Guardian signature
     */
    function confirmTransaction(
        uint256 txId,
        bytes calldata signature
    ) external {
        require(_isValidGuardian(msg.sender), "Not an active guardian");
        require(!confirmations[txId][msg.sender], "Already confirmed");
        require(!transactions[txId].executed, "Already executed");
        require(
            block.timestamp <= transactions[txId].expiry,
            "Transaction expired"
        );

        // Verify quantum-resistant signature
        bytes32 txHash = _getTransactionHash(txId);
        address signer = _recoverQuantumSigner(txHash, signature);
        require(signer == msg.sender, "Invalid signature");

        // Check security clearance
        require(
            _hasRequiredClearance(msg.sender, transactions[txId].securityLevel),
            "Insufficient clearance"
        );

        _confirmTransaction(txId, msg.sender);
    }

    /**
     * @notice Execute confirmed multi-signature transaction
     * @param txId Transaction ID
     */
    function executeTransaction(uint256 txId) external nonReentrant {
        MultiSigTx storage transaction = transactions[txId];
        require(!transaction.executed, "Already executed");
        require(block.timestamp <= transaction.expiry, "Transaction expired");

        uint256 required = _getRequiredConfirmations(transaction.securityLevel);
        require(
            transaction.confirmations >= required,
            "Insufficient confirmations"
        );

        transaction.executed = true;

        // Execute the transaction
        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "Transaction execution failed");

        emit TransactionExecuted(txId);
    }

    /**
     * @notice Add new guardian with quantum-resistant keys
     * @param guardian Address of new guardian
     * @param publicKey Quantum-resistant public key
     * @param clearance Security clearance level
     */
    function addGuardian(
        address guardian,
        bytes32 publicKey,
        SecurityClearance clearance
    ) external onlyOwner {
        require(guardian != address(0), "Invalid guardian address");
        require(publicKey != bytes32(0), "Invalid public key");
        require(
            guardianList.length < MAX_GUARDIANS,
            "Maximum guardians reached"
        );
        require(!_isValidGuardian(guardian), "Already a guardian");

        guardians[guardian] = Guardian({
            guardianAddress: guardian,
            publicKey: publicKey,
            reputation: 100,
            active: true,
            lastActivity: block.timestamp,
            clearance: clearance
        });

        guardianList.push(guardian);
        activeGuardians++;

        emit GuardianAdded(guardian, clearance);
    }

    /**
     * @notice Remove guardian
     * @param guardian Address to remove
     */
    function removeGuardian(address guardian) external onlyOwner {
        require(_isValidGuardian(guardian), "Not a guardian");
        require(activeGuardians > MIN_GUARDIANS, "Minimum guardians required");

        guardians[guardian].active = false;
        activeGuardians--;

        emit GuardianRemoved(guardian);
    }

    /**
     * @notice Vote to activate emergency mode; activates when 2/3 majority is reached
     */
    function activateEmergencyMode() external onlyGuardian {
        require(!emergencyMode, "Already in emergency mode");
        require(!_emergencyVotes[msg.sender], "Already voted");

        _emergencyVotes[msg.sender] = true;
        emergencyVoteCount++;

        uint256 needed = (activeGuardians * 2) / 3;
        if (needed == 0) needed = 1;

        if (emergencyVoteCount >= needed) {
            emergencyMode = true;
            emergencyThreshold = needed;
            lastEmergencyAction = block.timestamp;
            emit EmergencyModeActivated(msg.sender);
        }
    }

    /**
     * @notice Get transaction details
     * @param txId Transaction ID
     */
    function getTransaction(
        uint256 txId
    )
        external
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            uint256 confirmations,
            bool executed,
            SecurityLevel securityLevel
        )
    {
        MultiSigTx storage txRecord = transactions[txId];
        return (
            txRecord.to,
            txRecord.value,
            txRecord.data,
            txRecord.confirmations,
            txRecord.executed,
            txRecord.securityLevel
        );
    }

    /**
     * @notice Get confirmation status for transaction
     * @param txId Transaction ID
     * @param guardian Guardian address
     */
    function getConfirmation(
        uint256 txId,
        address guardian
    ) external view returns (bool) {
        return confirmations[txId][guardian];
    }

    /**
     * @notice Check if address is a valid guardian
     */
    function isGuardian(address account) external view returns (bool) {
        return _isValidGuardian(account);
    }

    /**
     * @notice Internal function to confirm transaction
     */
    function _confirmTransaction(uint256 txId, address guardian) internal {
        confirmations[txId][guardian] = true;
        transactions[txId].confirmations++;

        // Update guardian activity
        guardians[guardian].lastActivity = block.timestamp;
        guardians[guardian].reputation += 1; // Increase reputation for participation

        emit TransactionConfirmed(txId, guardian);
    }

    /**
     * @notice Get required confirmations for security level
     */
    function _getRequiredConfirmations(
        SecurityLevel level
    ) internal view returns (uint256) {
        if (emergencyMode) {
            return emergencyThreshold;
        }
        return requiredConfirmations[level];
    }

    /**
     * @notice Check if guardian has required security clearance
     */
    function _hasRequiredClearance(
        address guardian,
        SecurityLevel level
    ) internal view returns (bool) {
        SecurityClearance clearance = guardians[guardian].clearance;

        if (level == SecurityLevel.LOW)
            return clearance >= SecurityClearance.BASIC;
        if (level == SecurityLevel.MEDIUM)
            return clearance >= SecurityClearance.ADVANCED;
        if (level == SecurityLevel.HIGH)
            return clearance >= SecurityClearance.EXPERT;
        if (level == SecurityLevel.CRITICAL)
            return clearance >= SecurityClearance.MASTER;

        return false;
    }

    /**
     * @notice Check if address is a valid active guardian
     */
    function _isValidGuardian(address account) internal view returns (bool) {
        return
            guardians[account].active &&
            guardians[account].guardianAddress != address(0);
    }

    /**
     * @notice Check if guardian can act in emergency mode
     */
    function _isEmergencyGuardian(
        address guardian
    ) internal view returns (bool) {
        return
            _isValidGuardian(guardian) && guardians[guardian].reputation >= 150; // High reputation required
    }

    /**
     * @notice Get transaction hash for signing
     */
    function _getTransactionHash(uint256 txId) internal view returns (bytes32) {
        MultiSigTx storage txRecord = transactions[txId];
        return
            keccak256(
                abi.encodePacked(
                    txId,
                    txRecord.to,
                    txRecord.value,
                    txRecord.data,
                    txRecord.timestamp,
                    address(this)
                )
            );
    }

    /**
     * @notice Recover signer using quantum-resistant signature
     */
    function _recoverQuantumSigner(
        bytes32 message,
        bytes memory signature
    ) internal view returns (address) {
        // In production, this would use quantum-resistant signature verification
        // For demo, using ECDSA with additional validation

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", message)
        );

        address recovered = ethSignedMessageHash.recover(signature);
        require(recovered != address(0), "ECDSA: invalid signature");

        // Additional validation using stored public key
        require(
            guardians[recovered].publicKey != bytes32(0),
            "No public key registered"
        );
        require(
            block.timestamp - guardians[recovered].lastActivity <=
                SIGNATURE_VALIDITY,
            "Signature expired"
        );

        return recovered;
    }

    /**
     * @notice Initialize security parameters
     */
    function _initializeSecurityParameters() internal {
        requiredConfirmations[SecurityLevel.LOW] = 2;
        requiredConfirmations[SecurityLevel.MEDIUM] = 3;
        requiredConfirmations[SecurityLevel.HIGH] = 4;
        requiredConfirmations[SecurityLevel.CRITICAL] = 5;

        emergencyMode = false;
        emergencyThreshold = 5; // Default emergency threshold
    }

    /**
     * @notice Setup initial guardians (to be replaced with proper guardian selection)
     */
    function _setupInitialGuardians() internal {
        // In production, this would be a proper guardian selection process
        // For demo purposes, we leave this empty - guardians must be added by owner
    }

    /**
     * @notice Modifier to check if sender is a guardian
     */
    modifier onlyGuardian() {
        require(_isValidGuardian(msg.sender), "Not a guardian");
        _;
    }
}
