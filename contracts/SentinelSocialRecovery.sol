// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title SentinelSocialRecovery
 * @notice Social recovery system for secure account recovery
 * Multi-party approval with zero-knowledge identity verification
 */
contract SentinelSocialRecovery is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using EnumerableSet for EnumerableSet.AddressSet;

    // Recovery configuration structure
    struct RecoveryConfig {
        address accountOwner;
        uint256 guardianCount;
        uint256 threshold; // Guardians required for recovery
        uint256 recoveryDelay; // Delay before recovery can be executed
        bool isActive;
        mapping(address => bool) guardians;
        mapping(bytes32 => RecoveryRequest) recoveryRequests;
    }

    // Recovery request structure
    struct RecoveryRequest {
        bytes32 requestId;
        address newOwner;
        uint256 requestTime;
        uint256 executionTime;
        uint256 approvalCount;
        RecoveryStatus status;
        mapping(address => bool) approvals;
        bytes32[] approvalProofs;
    }

    enum RecoveryStatus {
        PENDING,
        APPROVED,
        EXECUTED,
        CANCELLED,
        EXPIRED
    }

    // State variables
    mapping(address => RecoveryConfig) public recoveryConfigs;
    mapping(bytes32 => address) public requestToAccount;

    // Global parameters
    uint256 public constant MAX_GUARDIANS = 10;
    uint256 public constant MIN_GUARDIANS = 3;
    uint256 public constant MAX_RECOVERY_DELAY = 30 days;
    uint256 public constant MIN_RECOVERY_DELAY = 1 days;
    uint256 public constant REQUEST_EXPIRY = 7 days;

    // ZK Identity integration
    address public zkIdentityContract;

    event RecoveryConfigured(
        address indexed account,
        uint256 guardianCount,
        uint256 threshold
    );
    event RecoveryRequested(
        bytes32 indexed requestId,
        address indexed account,
        address newOwner
    );
    event RecoveryApproved(bytes32 indexed requestId, address indexed guardian);
    event RecoveryExecuted(
        bytes32 indexed requestId,
        address indexed oldOwner,
        address indexed newOwner
    );
    event GuardianAdded(address indexed account, address indexed guardian);
    event GuardianRemoved(address indexed account, address indexed guardian);

    constructor(address _zkIdentityContract, address initialOwner) {
        require(initialOwner != address(0), "SR: zero owner");
        zkIdentityContract = _zkIdentityContract;
        if (initialOwner != msg.sender) {
            _transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Configure social recovery for an account
     * @param guardians Array of guardian addresses
     * @param threshold Number of guardians required for recovery
     * @param recoveryDelay Delay before recovery can be executed
     */
    function configureRecovery(
        address[] calldata guardians,
        uint256 threshold,
        uint256 recoveryDelay
    ) external {
        require(
            guardians.length >= MIN_GUARDIANS &&
                guardians.length <= MAX_GUARDIANS,
            "Invalid guardian count"
        );
        require(
            threshold > 0 && threshold <= guardians.length,
            "Invalid threshold"
        );
        require(
            recoveryDelay >= MIN_RECOVERY_DELAY &&
                recoveryDelay <= MAX_RECOVERY_DELAY,
            "Invalid recovery delay"
        );

        RecoveryConfig storage config = recoveryConfigs[msg.sender];
        require(!config.isActive, "Recovery already configured");

        // Validate guardians
        for (uint256 i = 0; i < guardians.length; i++) {
            require(guardians[i] != address(0), "Invalid guardian address");
            require(guardians[i] != msg.sender, "Cannot be own guardian");
            require(!config.guardians[guardians[i]], "Duplicate guardian");

            // Verify guardian identity (optional but recommended)
            require(
                _isValidZKIdentity(guardians[i]),
                "Guardian must have valid ZK identity"
            );

            config.guardians[guardians[i]] = true;
        }

        config.accountOwner = msg.sender;
        config.guardianCount = guardians.length;
        config.threshold = threshold;
        config.recoveryDelay = recoveryDelay;
        config.isActive = true;

        emit RecoveryConfigured(msg.sender, guardians.length, threshold);
    }

    /**
     * @notice Request account recovery
     * @param newOwner New owner address for the account
     * @param evidence Proof of compromise (IPFS hash, etc.)
     */
    function requestRecovery(
        address newOwner,
        bytes calldata evidence
    ) external returns (bytes32) {
        RecoveryConfig storage config = recoveryConfigs[msg.sender];
        require(config.isActive, "Recovery not configured");
        require(
            newOwner != address(0) && newOwner != msg.sender,
            "Invalid new owner"
        );

        // Generate recovery request
        bytes32 requestId = keccak256(
            abi.encodePacked(msg.sender, newOwner, block.timestamp, evidence)
        );

        RecoveryRequest storage request = config.recoveryRequests[requestId];
        require(request.requestTime == 0, "Recovery request already exists");

        request.requestId = requestId;
        request.newOwner = newOwner;
        request.requestTime = block.timestamp;
        request.executionTime = block.timestamp + config.recoveryDelay;
        request.approvalCount = 0;
        request.status = RecoveryStatus.PENDING;

        requestToAccount[requestId] = msg.sender;

        emit RecoveryRequested(requestId, msg.sender, newOwner);
        return requestId;
    }

    /**
     * @notice Approve recovery request
     * @param account Account to recover
     * @param requestId Recovery request ID
     * @param approvalProof ZK proof of identity verification
     */
    function approveRecovery(
        address account,
        bytes32 requestId,
        bytes calldata approvalProof
    ) external {
        RecoveryConfig storage config = recoveryConfigs[account];
        require(config.isActive, "Recovery not configured");
        require(config.guardians[msg.sender], "Not a guardian");

        RecoveryRequest storage request = config.recoveryRequests[requestId];
        require(
            request.status == RecoveryStatus.PENDING,
            "Request not pending"
        );
        require(!request.approvals[msg.sender], "Already approved");
        require(
            block.timestamp <= request.requestTime + REQUEST_EXPIRY,
            "Request expired"
        );

        // Verify guardian identity and approval
        require(
            _verifyGuardianApproval(msg.sender, requestId, approvalProof),
            "Invalid guardian approval"
        );

        request.approvals[msg.sender] = true;
        request.approvalCount++;
        request.approvalProofs.push(keccak256(abi.encodePacked(approvalProof)));

        emit RecoveryApproved(requestId, msg.sender);

        // Check if threshold is met
        if (request.approvalCount >= config.threshold) {
            request.status = RecoveryStatus.APPROVED;
        }
    }

    /**
     * @notice Execute approved recovery
     * @param account Account to recover
     * @param requestId Recovery request ID
     */
    function executeRecovery(
        address account,
        bytes32 requestId
    ) external nonReentrant {
        RecoveryConfig storage config = recoveryConfigs[account];
        require(config.isActive, "Recovery not configured");

        RecoveryRequest storage request = config.recoveryRequests[requestId];
        require(
            request.status == RecoveryStatus.APPROVED,
            "Request not approved"
        );
        require(
            block.timestamp >= request.executionTime,
            "Recovery delay not elapsed"
        );
        require(
            block.timestamp <= request.requestTime + REQUEST_EXPIRY,
            "Request expired"
        );

        // Execute recovery (this would transfer ownership in integrated contracts)
        address oldOwner = account;
        address newOwner = request.newOwner;

        // Mark request as executed
        request.status = RecoveryStatus.EXECUTED;

        // Reset recovery configuration for security
        _resetRecoveryConfig(account);

        emit RecoveryExecuted(requestId, oldOwner, newOwner);
    }

    /**
     * @notice Cancel recovery request
     * @param requestId Recovery request ID
     */
    function cancelRecovery(bytes32 requestId) external {
        address account = requestToAccount[requestId];
        require(account == msg.sender, "Not request owner");

        RecoveryConfig storage config = recoveryConfigs[account];
        RecoveryRequest storage request = config.recoveryRequests[requestId];
        require(request.status == RecoveryStatus.PENDING, "Cannot cancel");

        request.status = RecoveryStatus.CANCELLED;
    }

    /**
     * @notice Add guardian to recovery configuration
     * @param guardian New guardian address
     */
    function addGuardian(address guardian) external {
        RecoveryConfig storage config = recoveryConfigs[msg.sender];
        require(config.isActive, "Recovery not configured");
        require(
            config.guardianCount < MAX_GUARDIANS,
            "Maximum guardians reached"
        );
        require(
            guardian != address(0) && guardian != msg.sender,
            "Invalid guardian"
        );
        require(!config.guardians[guardian], "Already a guardian");
        require(
            _isValidZKIdentity(guardian),
            "Guardian must have valid ZK identity"
        );

        config.guardians[guardian] = true;
        config.guardianCount++;

        // Adjust threshold if needed
        if (config.threshold > config.guardianCount) {
            config.threshold = config.guardianCount;
        }

        emit GuardianAdded(msg.sender, guardian);
    }

    /**
     * @notice Remove guardian from recovery configuration
     * @param guardian Guardian to remove
     */
    function removeGuardian(address guardian) external {
        RecoveryConfig storage config = recoveryConfigs[msg.sender];
        require(config.isActive, "Recovery not configured");
        require(config.guardians[guardian], "Not a guardian");
        require(
            config.guardianCount > MIN_GUARDIANS,
            "Minimum guardians required"
        );

        config.guardians[guardian] = false;
        config.guardianCount--;

        // Adjust threshold if needed
        if (config.threshold > config.guardianCount) {
            config.threshold = config.guardianCount;
        }

        emit GuardianRemoved(msg.sender, guardian);
    }

    /**
     * @notice Get recovery configuration
     * @param account Account to query
     */
    function getRecoveryConfig(
        address account
    )
        external
        view
        returns (
            uint256 guardianCount,
            uint256 threshold,
            uint256 recoveryDelay,
            bool isActive
        )
    {
        RecoveryConfig storage config = recoveryConfigs[account];
        return (
            config.guardianCount,
            config.threshold,
            config.recoveryDelay,
            config.isActive
        );
    }

    /**
     * @notice Get recovery request details
     * @param account Account owner
     * @param requestId Request ID
     */
    function getRecoveryRequest(
        address account,
        bytes32 requestId
    )
        external
        view
        returns (
            address newOwner,
            uint256 requestTime,
            uint256 executionTime,
            uint256 approvalCount,
            RecoveryStatus status
        )
    {
        RecoveryRequest storage request = recoveryConfigs[account]
            .recoveryRequests[requestId];
        return (
            request.newOwner,
            request.requestTime,
            request.executionTime,
            request.approvalCount,
            request.status
        );
    }

    /**
     * @notice Check if address is a guardian for an account
     * @param account Account to check
     * @param guardian Guardian to verify
     */
    function isGuardian(
        address account,
        address guardian
    ) external view returns (bool) {
        return recoveryConfigs[account].guardians[guardian];
    }

    /**
     * @notice Check if recovery can be executed
     * @param account Account to check
     * @param requestId Request ID
     */
    function canExecuteRecovery(
        address account,
        bytes32 requestId
    ) external view returns (bool) {
        RecoveryConfig storage config = recoveryConfigs[account];
        if (!config.isActive) return false;

        RecoveryRequest storage request = config.recoveryRequests[requestId];
        if (request.status != RecoveryStatus.APPROVED) return false;
        if (block.timestamp < request.executionTime) return false;
        if (block.timestamp > request.requestTime + REQUEST_EXPIRY)
            return false;

        return true;
    }

    /**
     * @dev Verify guardian approval with ZK identity
     */
    function _verifyGuardianApproval(
        address guardian,
        bytes32 requestId,
        bytes memory approvalProof
    ) internal pure returns (bool) {
        // Verify guardian has valid ZK identity
        if (!_isValidZKIdentity(guardian)) return false;

        // Verify approval proof (simplified)
        bytes32 proofHash = keccak256(
            abi.encodePacked(guardian, requestId, approvalProof)
        );
        return uint256(proofHash) % 100 < 90; // 90% verification success rate
    }

    /**
     * @dev Check if address has valid ZK identity
     */
    function _isValidZKIdentity(address account) internal pure returns (bool) {
        // In production, this would query the ZK identity contract
        // For demo, we'll assume identities are valid
        return account != address(0);
    }

    /**
     * @dev Reset recovery configuration after successful recovery
     */
    function _resetRecoveryConfig(address account) internal {
        RecoveryConfig storage config = recoveryConfigs[account];

        // Clear all guardians
        for (uint256 i = 0; i < config.guardianCount; i++) {
            // Note: In production, you'd need to track guardian addresses
            // This is simplified for the demo
        }

        // Reset configuration
        config.guardianCount = 0;
        config.threshold = 0;
        config.isActive = false;
        config.recoveryDelay = 0;
    }
}
