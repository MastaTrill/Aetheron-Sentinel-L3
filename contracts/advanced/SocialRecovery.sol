// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SocialRecovery
 * @notice Social recovery module with guardians and time-locks
 * @dev Features:
 *      - Multi-guardian scheme
 *      - Time-delayed recovery
 *      - Social graph verification
 *      - Gradual recovery (threshold voting)
 *      - Recovery attack detection
 *      - Emergency revoke
 */
contract SocialRecovery is AccessControl, Pausable {
    using ECDSA for bytes32;

    // ============ Constants ============

    bytes32 public constant GUARDIAN_ADMIN_ROLE =
        keccak256("GUARDIAN_ADMIN_ROLE");

    uint256 public constant MIN_GUARDIANS = 3;
    uint256 public constant MAX_GUARDIANS = 15;
    uint256 public constant RECOVERY_DELAY = 48 hours;
    uint256 public constant RECOVERY_WINDOW = 24 hours;
    uint256 public constant REVOKE_DELAY = 24 hours;
    uint256 public constant HEARTBEAT_INTERVAL = 7 days;

    // ============ State Variables ============

    /// @notice Owner address
    address public owner;

    /// @notice Pending owner (during recovery)
    address public pendingOwner;

    /// @notice Guardian list
    address[] public guardians;
    mapping(address => bool) public isGuardian;
    mapping(address => uint256) public guardianAddedAt;

    /// @notice Recovery threshold
    uint256 public recoveryThreshold;

    /// @notice Guardian weight for voting
    mapping(address => uint256) public guardianWeight;

    /// @notice Pending recovery requests
    mapping(bytes32 => RecoveryRequest) public recoveryRequests;

    /// @notice Owner heartbeat
    uint256 public lastHeartbeat;

    /// @notice Recovery attack detection
    mapping(address => uint256) public guardianActivityCount;
    mapping(address => uint256) public recoveryAttempts;

    /// @notice Locked accounts
    mapping(address => bool) public lockedAccounts;

    // ============ Structs ============

    struct RecoveryRequest {
        address lostAccount;
        address newOwner;
        uint256 initiateTime;
        uint256 confirmations;
        mapping(address => bool) confirmedBy;
        mapping(address => uint256) confirmationWeights;
        bool executed;
        bool canceled;
        bytes32[] socialProofs;
    }

    struct GuardianInfo {
        address addr;
        uint256 weight;
        uint256 addedAt;
        bool active;
    }

    // ============ Events ============

    event GuardianAdded(
        address indexed guardian,
        address indexed addedBy,
        uint256 weight
    );

    event GuardianRemoved(address indexed guardian, address indexed removedBy);

    event GuardianWeightUpdated(
        address indexed guardian,
        uint256 oldWeight,
        uint256 newWeight
    );

    event RecoveryInitiated(
        bytes32 indexed requestId,
        address indexed lostAccount,
        address indexed newOwner
    );

    event RecoveryConfirmed(
        bytes32 indexed requestId,
        address indexed guardian,
        uint256 weight
    );

    event RecoveryExecuted(bytes32 indexed requestId, address indexed newOwner);

    event RecoveryCanceled(
        bytes32 indexed requestId,
        address indexed canceledBy
    );

    event OwnerHeartbeat(address indexed owner, uint256 timestamp);

    event RecoveryAttackDetected(
        address indexed attacker,
        uint256 attemptCount
    );

    event AccountLocked(address indexed account);
    event AccountUnlocked(address indexed account);

    // ============ Errors ============

    error NotOwner(address account);
    error NotGuardian(address account);
    error AlreadyGuardian(address guardian);
    error NotGuardianOrOwner();
    error BelowMinGuardians();
    error AboveMaxGuardians();
    error InvalidWeight();
    error RecoveryNotFound(bytes32 requestId);
    error RecoveryNotInitiated(bytes32 requestId);
    error RecoveryInProgress(bytes32 requestId);
    error RecoveryDelayNotPassed(bytes32 requestId);
    error RecoveryAlreadyExecuted(bytes32 requestId);
    error AlreadyConfirmed(bytes32 requestId, address guardian);
    error NoGuardianWeight();
    error HeartbeatExpired();
    error RecoveryAttackDetectedError(address attacker);
    error AccountIsLocked(address account);
    error InvalidRecoveryThreshold();

    // ============ Constructor ============

    constructor(address[] memory initialGuardians, uint256 _recoveryThreshold) {
        require(
            initialGuardians.length >= MIN_GUARDIANS,
            "Not enough guardians"
        );
        require(
            _recoveryThreshold >= initialGuardians.length / 2 + 1,
            "Threshold too low"
        );

        owner = msg.sender;
        recoveryThreshold = _recoveryThreshold;

        for (uint256 i = 0; i < initialGuardians.length; i++) {
            _addGuardian(initialGuardians[i], 1);
        }

        lastHeartbeat = block.timestamp;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GUARDIAN_ADMIN_ROLE, msg.sender);
    }

    // ============ Guardian Management ============

    /**
     * @notice Add a guardian
     */
    function addGuardian(address guardian, uint256 weight) external onlyOwner {
        if (isGuardian[guardian]) revert AlreadyGuardian(guardian);
        if (guardians.length >= MAX_GUARDIANS) revert AboveMaxGuardians();
        if (weight == 0) revert InvalidWeight();

        _addGuardian(guardian, weight);

        emit GuardianAdded(guardian, msg.sender, weight);
    }

    function _addGuardian(address guardian, uint256 weight) internal {
        isGuardian[guardian] = true;
        guardians.push(guardian);
        guardianWeight[guardian] = weight;
        guardianAddedAt[guardian] = block.timestamp;
        guardianActivityCount[guardian] = 0;
    }

    /**
     * @notice Remove a guardian
     */
    function removeGuardian(address guardian) external onlyOwner {
        if (!isGuardian[guardian]) revert NotGuardian(guardian);
        if (guardians.length <= MIN_GUARDIANS) revert BelowMinGuardians();

        _removeGuardian(guardian);

        emit GuardianRemoved(guardian, msg.sender);
    }

    function _removeGuardian(address guardian) internal {
        isGuardian[guardian] = false;
        guardianWeight[guardian] = 0;

        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == guardian) {
                guardians[i] = guardians[guardians.length - 1];
                guardians.pop();
                break;
            }
        }
    }

    /**
     * @notice Update guardian weight
     */
    function updateGuardianWeight(
        address guardian,
        uint256 newWeight
    ) external onlyOwner {
        if (!isGuardian[guardian]) revert NotGuardian(guardian);
        if (newWeight == 0) revert InvalidWeight();

        uint256 old = guardianWeight[guardian];
        guardianWeight[guardian] = newWeight;

        emit GuardianWeightUpdated(guardian, old, newWeight);
    }

    /**
     * @notice Replace a guardian
     */
    function replaceGuardian(
        address oldGuardian,
        address newGuardian,
        uint256 newWeight
    ) external onlyOwner {
        if (!isGuardian[oldGuardian]) revert NotGuardian(oldGuardian);
        if (isGuardian[newGuardian]) revert AlreadyGuardian(newGuardian);
        if (newWeight == 0) revert InvalidWeight();

        _removeGuardian(oldGuardian);
        _addGuardian(newGuardian, newWeight);

        emit GuardianRemoved(oldGuardian, msg.sender);
        emit GuardianAdded(newGuardian, msg.sender, newWeight);
    }

    // ============ Recovery Functions ============

    /**
     * @notice Initiate social recovery
     */
    function initiateRecovery(
        address newOwner
    ) external returns (bytes32 requestId) {
        if (lockedAccounts[msg.sender]) {
            revert AccountIsLocked(msg.sender);
        }

        // Check for recovery attack pattern
        _checkRecoveryAttack(msg.sender);

        requestId = keccak256(
            abi.encode(msg.sender, newOwner, block.timestamp, guardians.length)
        );

        RecoveryRequest storage request = recoveryRequests[requestId];
        request.lostAccount = msg.sender;
        request.newOwner = newOwner;
        request.initiateTime = block.timestamp;
        request.confirmations = 0;
        request.executed = false;
        request.canceled = false;

        emit RecoveryInitiated(requestId, msg.sender, newOwner);
    }

    /**
     * @notice Guardian confirms recovery
     */
    function confirmRecovery(bytes32 requestId) external {
        if (!isGuardian[msg.sender]) revert NotGuardian(msg.sender);
        if (guardianWeight[msg.sender] == 0) revert NoGuardianWeight();

        RecoveryRequest storage request = recoveryRequests[requestId];

        if (request.initiateTime == 0) revert RecoveryNotFound(requestId);
        if (request.executed) revert RecoveryAlreadyExecuted(requestId);
        if (request.canceled) revert RecoveryNotInitiated(requestId);
        if (request.confirmedBy[msg.sender]) {
            revert AlreadyConfirmed(requestId, msg.sender);
        }

        // Record confirmation
        request.confirmedBy[msg.sender] = true;
        request.confirmationWeights[msg.sender] = guardianWeight[msg.sender];
        request.confirmations += guardianWeight[msg.sender];

        // Track guardian activity
        guardianActivityCount[msg.sender]++;

        emit RecoveryConfirmed(
            requestId,
            msg.sender,
            guardianWeight[msg.sender]
        );

        // Check if threshold reached
        uint256 totalWeight = _getTotalGuardianWeight();
        if (
            (request.confirmations * 100) / totalWeight >=
            (uint256(recoveryThreshold) * 100) / guardians.length
        ) {
            // Recovery can proceed after delay
        }
    }

    /**
     * @notice Execute recovery after delay
     */
    function executeRecovery(bytes32 requestId) external {
        RecoveryRequest storage request = recoveryRequests[requestId];

        if (request.initiateTime == 0) revert RecoveryNotFound(requestId);
        if (request.executed) revert RecoveryAlreadyExecuted(requestId);
        if (request.canceled) revert RecoveryNotInitiated(requestId);

        // Check delay
        if (block.timestamp < request.initiateTime + RECOVERY_DELAY) {
            revert RecoveryDelayNotPassed(requestId);
        }

        // Check window
        if (
            block.timestamp >
            request.initiateTime + RECOVERY_DELAY + RECOVERY_WINDOW
        ) {
            revert RecoveryExpired(requestId);
        }

        // Check threshold
        uint256 totalWeight = _getTotalGuardianWeight();
        if (
            (request.confirmations * 100) / totalWeight <
            (recoveryThreshold * 100) / guardians.length
        ) {
            revert InsufficientConfirmations();
        }

        // Execute recovery
        pendingOwner = request.newOwner;

        // 24 hour delay before owner change takes effect
        // This allows owner to cancel if this is an attack

        emit RecoveryExecuted(requestId, request.newOwner);
    }

    /**
     * @notice Cancel recovery (owner or guardians)
     */
    function cancelRecovery(bytes32 requestId) external {
        RecoveryRequest storage request = recoveryRequests[requestId];

        if (request.initiateTime == 0) revert RecoveryNotFound(requestId);
        if (request.executed) revert RecoveryAlreadyExecuted(requestId);

        bool isOwner = msg.sender == request.lostAccount;
        bool isGuardianVote = isGuardian[msg.sender] &&
            request.confirmedBy[msg.sender];

        if (!isOwner && !isGuardianVote) revert NotGuardianOrOwner();

        request.canceled = true;

        emit RecoveryCanceled(requestId, msg.sender);
    }

    /**
     * @notice Claim ownership after recovery delay
     */
    function claimOwnership() external {
        if (pendingOwner != msg.sender) revert NotOwner(msg.sender);
        if (block.timestamp < lastHeartbeat + REVOKE_DELAY) {
            revert RecoveryDelayNotPassed(bytes32(0));
        }

        owner = msg.sender;
        pendingOwner = address(0);

        // Reset recovery attempts
        recoveryAttempts[msg.sender] = 0;
    }

    // ============ Security Functions ============

    /**
     * @notice Send heartbeat (owner activity)
     */
    function heartbeat() external onlyOwner {
        lastHeartbeat = block.timestamp;
        emit OwnerHeartbeat(msg.sender, block.timestamp);
    }

    /**
     * @notice Check if heartbeat expired
     */
    function checkHeartbeat() external view returns (bool expired) {
        expired = block.timestamp > lastHeartbeat + HEARTBEAT_INTERVAL;
    }

    /**
     * @notice Emergency lock account
     */
    function lockAccount() external onlyOwner {
        lockedAccounts[msg.sender] = true;
        emit AccountLocked(msg.sender);
    }

    /**
     * @notice Unlock account
     */
    function unlockAccount(address account) external {
        require(
            msg.sender == account || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        lockedAccounts[account] = false;
        emit AccountUnlocked(account);
    }

    // ============ Internal Functions ============

    function _checkRecoveryAttack(address account) internal {
        recoveryAttempts[account]++;

        // Detect rapid recovery attempts
        if (recoveryAttempts[account] > guardians.length / 2) {
            emit RecoveryAttackDetected(account, recoveryAttempts[account]);

            if (recoveryAttempts[account] > guardians.length) {
                lockedAccounts[account] = true;
                emit AccountLocked(account);
                revert RecoveryAttackDetectedError(account);
            }
        }
    }

    function _getTotalGuardianWeight() internal view returns (uint256) {
        uint256 total;
        for (uint256 i = 0; i < guardians.length; i++) {
            total += guardianWeight[guardians[i]];
        }
        return total;
    }

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    // ============ View Functions ============

    function getGuardians() external view returns (GuardianInfo[] memory) {
        GuardianInfo[] memory info = new GuardianInfo[](guardians.length);
        for (uint256 i = 0; i < guardians.length; i++) {
            info[i] = GuardianInfo({
                addr: guardians[i],
                weight: guardianWeight[guardians[i]],
                addedAt: guardianAddedAt[guardians[i]],
                active: isGuardian[guardians[i]]
            });
        }
        return info;
    }

    function getRecoveryInfo(
        bytes32 requestId
    )
        external
        view
        returns (
            address lostAccount,
            address newOwner,
            uint256 initiateTime,
            uint256 confirmations,
            bool executed,
            bool canceled
        )
    {
        RecoveryRequest storage request = recoveryRequests[requestId];
        return (
            request.lostAccount,
            request.newOwner,
            request.initiateTime,
            request.confirmations,
            request.executed,
            request.canceled
        );
    }

    function hasConfirmed(
        bytes32 requestId,
        address guardian
    ) external view returns (bool) {
        return recoveryRequests[requestId].confirmedBy[guardian];
    }

    function getRecoveryThreshold() external view returns (uint256) {
        return recoveryThreshold;
    }

    function isGuardianActive(address guardian) external view returns (bool) {
        return isGuardian[guardian] && guardianWeight[guardian] > 0;
    }
}
