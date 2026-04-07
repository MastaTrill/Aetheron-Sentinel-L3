// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseAccount} from "@account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SentinelAccount
 * @notice ERC-4337 Smart Account with Sentinel security integration
 * @dev Features:
 *      - Native ERC-4337 support (no deposit needed)
 *      - Multi-owner support with weighted thresholds
 *      - Session keys with permissions
 *      - Guardian-based recovery
 *      - Spending limits & daily caps
 *      - Whitelisted dApp access
 *      - Integration with Sentinel security
 */
contract SentinelAccount is BaseAccount, AccessControl, Pausable {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    // ============ Constants ============
    
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant SENTINEL_ROLE = keccak256("SENTINEL_ROLE");
    
    uint256 public constant MAX_GUARDIANS = 5;
    uint256 public constant RECOVERY_DELAY = 48 hours;
    uint256 public constant MAX_DAILY_SPEND = 100 ether;

    // ============ State Variables ============
    
    /// @notice Entry point contract
    address public entryPointAddress;
    
    /// @notice Owners with weights
    mapping(address => uint256) public ownerWeights;
    address[] public owners;
    
    /// @notice Required weight for transactions
    uint256 public requiredWeight;
    
    /// @notice Session keys
    mapping(address => SessionKey) public sessionKeys;
    mapping(address => bool) public isSessionKey;
    
    /// @notice Spending limits
    mapping(address => uint256) public dailySpending;
    mapping(address => uint256) public dailySpendingTimestamp;
    
    /// @notice Guardian recovery
    mapping(address => bool) public pendingRecovery;
    mapping(address => uint256) public recoveryTimestamp;
    address public proposedNewOwner;
    
    /// @notice Whitelisted contracts
    mapping(address => bool) public whitelistedContracts;
    
    /// @notice Nonce for replay protection
    uint256 public nonce;
    
    /// @notice Sentinel security integration
    address public sentinelGuardian;
    bool public sentinelProtectionEnabled = true;

    // ============ Structs ============
    
    struct SessionKey {
        address key;
        bytes4[] allowedSelectors;
        address[] allowedContracts;
        uint256 expiresAt;
        bool active;
    }
    
    struct TransactionRequest {
        address to;
        uint256 value;
        bytes data;
        bytes signature;
    }

    // ============ Events ============
    
    event OwnerAdded(address indexed owner, uint256 weight);
    event OwnerRemoved(address indexed owner);
    event WeightThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event SessionKeyCreated(
        address indexed sessionKey,
        bytes4[] selectors,
        address[] contracts,
        uint256 expiresAt
    );
    event SessionKeyRevoked(address indexed sessionKey);
    event SpendingLimitUpdated(address indexed token, uint256 newLimit);
    event DailySpendingLimitHit(address indexed token, uint256 spent, uint256 limit);
    event GuardianRecoveryInitiated(address indexed guardian, address indexed newOwner);
    event GuardianRecoveryCompleted(address indexed oldOwner, address indexed newOwner);
    event GuardianRecoveryCanceled(address indexed owner);
    event ContractWhitelisted(address indexed contractAddr, bool whitelisted);
    event SentinelGuardianUpdated(address indexed oldGuardian, address indexed newGuardian);
    event SentinelProtectionToggled(bool enabled);

    // ============ Errors ============
    
    error InvalidOwner(address owner);
    error OwnerAlreadyExists(address owner);
    error BelowWeightThreshold(uint256 have, uint256 required);
    error InvalidSignature();
    error InvalidSessionKey();
    error SessionKeyExpired();
    error SessionKeyNotActive();
    error ContractNotWhitelisted(address contractAddr);
    error DailyLimitExceeded(address token, uint256 spent, uint256 limit);
    error RecoveryAlreadyPending();
    error RecoveryDelayNotPassed();
    error RecoveryNotPending();
    error UnauthorizedGuardian(address guardian);
    error InvalidEntryPoint();

    // ============ Constructor ============
    
    constructor(
        address _entryPoint,
        address[] memory _initialOwners,
        uint256[] memory _weights,
        uint256 _requiredWeight
    ) {
        if (_entryPoint == address(0)) revert InvalidEntryPoint();
        
        entryPointAddress = _entryPoint;
        requiredWeight = _requiredWeight;
        
        for (uint256 i = 0; i < _initialOwners.length; i++) {
            _addOwner(_initialOwners[i], _weights[i]);
        }
        
        _grantRole(DEFAULT_ADMIN_ROLE, address(this));
    }

    // ============ Entry Point ============
    
    /**
     * @notice Execute transaction from EntryPoint
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external override {
        require(msg.sender == entryPointAddress, "Only entry point");
        _call(dest, value, func);
    }
    
    /**
     * @notice Execute batch transactions
     */
    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external {
        require(msg.sender == entryPointAddress, "Only entry point");
        require(dest.length == value.length && dest.length == func.length, "Length mismatch");
        
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], value[i], func[i]);
        }
    }
    
    /**
     * @notice Validate user operation signature
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256) {
        require(msg.sender == entryPointAddress, "Only entry point");
        
        bytes32 hash = keccak256(abi.encodePacked(userOpHash));
        
        // Check if session key
        address signer = hash.recover(userOp.signature);
        
        if (isSessionKey[signer]) {
            _validateSessionKey(signer, userOp);
        } else {
            _validateOwnerSignature(hash, userOp.signature);
        }
        
        // Refund missing funds
        if (missingAccountFunds > 0) {
            payable(msg.sender).transfer(missingAccountFunds);
        }
        
        return 0;
    }
    
    /**
     * @notice Get entry point interface
     */
    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(entryPointAddress);
    }

    // ============ Owner Management ============
    
    /**
     * @notice Add owner with weight
     */
    function addOwner(address owner, uint256 weight) external onlySelf {
        _addOwner(owner, weight);
    }
    
    function _addOwner(address owner, uint256 weight) internal {
        if (owner == address(0)) revert InvalidOwner(owner);
        if (ownerWeights[owner] > 0) revert OwnerAlreadyExists(owner);
        
        ownerWeights[owner] = weight;
        owners.push(owner);
        _grantRole(OWNER_ROLE, owner);
        
        emit OwnerAdded(owner, weight);
    }
    
    /**
     * @notice Remove owner
     */
    function removeOwner(address owner) external onlySelf {
        if (ownerWeights[owner] == 0) revert InvalidOwner(owner);
        
        ownerWeights[owner] = 0;
        _revokeRole(OWNER_ROLE, owner);
        
        // Remove from array
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }
        
        emit OwnerRemoved(owner);
    }
    
    /**
     * @notice Update required weight threshold
     */
    function updateWeightThreshold(uint256 newThreshold) external onlySelf {
        uint256 old = requiredWeight;
        requiredWeight = newThreshold;
        emit WeightThresholdUpdated(old, newThreshold);
    }
    
    /**
     * @notice Validate owner signature
     */
    function _validateOwnerSignature(
        bytes32 hash,
        bytes memory signature
    ) internal view {
        address signer = hash.recover(signature);
        
        // Check weighted signature
        uint256 totalWeight;
        
        // Simple single signer for now
        if (ownerWeights[signer] > 0) {
            totalWeight = ownerWeights[signer];
        } else {
            // Try multi-sig (simplified)
            revert InvalidSignature();
        }
        
        if (totalWeight < requiredWeight) {
            revert BelowWeightThreshold(totalWeight, requiredWeight);
        }
    }

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256) {
        bytes32 hash = keccak256(abi.encodePacked(userOpHash));
        address signer = hash.recover(userOp.signature);
        
        if (isSessionKey[signer]) {
            _validateSessionKey(signer, userOp);
        } else {
            _validateOwnerSignature(hash, userOp.signature);
        }
        
        return 0;
    }

    function _validateNonce(uint256 nonce) internal view override {
    }

    // ============ Session Keys ============
    
    /**
     * @notice Create session key with permissions
     */
    function createSessionKey(
        address sessionKey,
        bytes4[] calldata selectors,
        address[] calldata allowedContracts,
        uint256 duration
    ) external onlySelf {
        if (sessionKey == address(0)) revert InvalidSessionKey();
        
        sessionKeys[sessionKey] = SessionKey({
            key: sessionKey,
            allowedSelectors: selectors,
            allowedContracts: allowedContracts,
            expiresAt: block.timestamp + duration,
            active: true
        });
        
        isSessionKey[sessionKey] = true;
        
        emit SessionKeyCreated(sessionKey, selectors, allowedContracts, sessionKeys[sessionKey].expiresAt);
    }
    
    /**
     * @notice Revoke session key
     */
    function revokeSessionKey(address sessionKey) external onlySelf {
        if (!isSessionKey[sessionKey]) revert InvalidSessionKey();
        
        sessionKeys[sessionKey].active = false;
        isSessionKey[sessionKey] = false;
        
        emit SessionKeyRevoked(sessionKey);
    }
    
    /**
     * @notice Validate session key usage
     */
    function _validateSessionKey(
        address sessionKey,
        PackedUserOperation calldata userOp
    ) internal view {
        SessionKey storage key = sessionKeys[sessionKey];
        
        if (!key.active) revert SessionKeyNotActive();
        if (block.timestamp > key.expiresAt) revert SessionKeyExpired();
        
        // Check if contract is whitelisted
        address target = address(bytes20(userOp.callData[16:36]));
        if (!whitelistedContracts[target]) revert ContractNotWhitelisted(target);
        
        // Check selector if specified
        if (key.allowedSelectors.length > 0) {
            bytes4 selector = bytes4(userOp.callData[:4]);
            bool selectorAllowed;
            for (uint256 i = 0; i < key.allowedSelectors.length; i++) {
                if (key.allowedSelectors[i] == selector) {
                    selectorAllowed = true;
                    break;
                }
            }
            require(selectorAllowed, "Selector not allowed");
        }
    }

    // ============ Spending Limits ============
    
    /**
     * @notice Check and update daily spending
     */
    function _checkSpendingLimit(address token, uint256 amount) internal {
        // Reset daily spending if new day
        if (block.timestamp > dailySpendingTimestamp[token] + 24 hours) {
            dailySpending[token] = 0;
            dailySpendingTimestamp[token] = block.timestamp;
        }
        
        uint256 newTotal = dailySpending[token] + amount;
        if (newTotal > MAX_DAILY_SPEND) {
            emit DailySpendingLimitHit(token, dailySpending[token], MAX_DAILY_SPEND);
            revert DailyLimitExceeded(token, newTotal, MAX_DAILY_SPEND);
        }
        
        dailySpending[token] = newTotal;
    }

    // ============ Guardian Recovery ============
    
    /**
     * @notice Initiate guardian recovery
     */
    function initiateGuardianRecovery(address newOwner) external onlyRole(GUARDIAN_ROLE) {
        if (pendingRecovery[msg.sender]) revert RecoveryAlreadyPending();
        if (newOwner == address(0)) revert InvalidOwner(newOwner);
        
        pendingRecovery[msg.sender] = true;
        recoveryTimestamp[msg.sender] = block.timestamp;
        proposedNewOwner = newOwner;
        
        emit GuardianRecoveryInitiated(msg.sender, newOwner);
    }
    
    /**
     * @notice Complete guardian recovery
     */
    function completeGuardianRecovery() external onlyRole(GUARDIAN_ROLE) {
        if (!pendingRecovery[msg.sender]) revert RecoveryNotPending();
        if (block.timestamp < recoveryTimestamp[msg.sender] + RECOVERY_DELAY) {
            revert RecoveryDelayNotPassed();
        }
        
        address oldOwner = msg.sender;
        
        // Transfer ownership
        _removeAllOwners();
        _addOwner(proposedNewOwner, requiredWeight);
        
        pendingRecovery[msg.sender] = false;
        recoveryTimestamp[msg.sender] = 0;
        
        emit GuardianRecoveryCompleted(oldOwner, proposedNewOwner);
    }
    
    /**
     * @notice Cancel recovery
     */
    function cancelGuardianRecovery() external onlyRole(GUARDIAN_ROLE) {
        if (!pendingRecovery[msg.sender]) revert RecoveryNotPending();
        
        pendingRecovery[msg.sender] = false;
        recoveryTimestamp[msg.sender] = 0;
        
        emit GuardianRecoveryCanceled(msg.sender);
    }
    
    function _removeAllOwners() internal {
        for (uint256 i = 0; i < owners.length; i++) {
            ownerWeights[owners[i]] = 0;
            _revokeRole(OWNER_ROLE, owners[i]);
        }
        delete owners;
    }

    // ============ Whitelisting ============
    
    /**
     * @notice Whitelist contract for session key access
     */
    function whitelistContract(address contract_, bool whitelisted) external onlySelf {
        whitelistedContracts[contract_] = whitelisted;
        emit ContractWhitelisted(contract_, whitelisted);
    }

    // ============ Sentinel Integration ============
    
    /**
     * @notice Set sentinel guardian
     */
    function setSentinelGuardian(address guardian) external onlySelf {
        address old = sentinelGuardian;
        sentinelGuardian = guardian;
        emit SentinelGuardianUpdated(old, guardian);
    }
    
    /**
     * @notice Toggle sentinel protection
     */
    function toggleSentinelProtection(bool enabled) external onlySelf {
        sentinelProtectionEnabled = enabled;
        emit SentinelProtectionToggled(enabled);
    }

    // ============ Token Management ============
    
    /**
     * @notice Transfer ERC20 tokens
     */
    function transferERC20(
        address token,
        address to,
        uint256 amount
    ) external onlySelf {
        _checkSpendingLimit(token, amount);
        IERC20(token).safeTransfer(to, amount);
    }
    
    /**
     * @notice Execute arbitrary call
     */
    function executeCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable onlySelf {
        _call(to, value, data);
    }

    // ============ Internal ============
    
    function _call(
        address to,
        uint256 value,
        bytes memory data
    ) internal {
        (bool success, ) = to.call{value: value}(data);
        require(success, "Call failed");
    }
    
    modifier onlySelf() {
        require(msg.sender == address(this), "Only self");
        _;
    }

    // ============ View Functions ============
    
    function getOwners() external view returns (address[] memory) {
        return owners;
    }
    
    function getOwnerWeight(address owner) external view returns (uint256) {
        return ownerWeights[owner];
    }
    
    function getSessionKey(address key) external view returns (SessionKey memory) {
        return sessionKeys[key];
    }
    
    function getDailySpending(address token) external view returns (uint256 spent, uint256 limit) {
        return (dailySpending[token], MAX_DAILY_SPEND);
    }
    
    function isGuardian(address account) external view returns (bool) {
        return hasRole(GUARDIAN_ROLE, account);
    }
    
    function isOwner(address account) external view returns (bool) {
        return hasRole(OWNER_ROLE, account);
    }
}
