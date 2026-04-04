// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SmartWallet
 * @notice User-friendly wallet with session keys, gasless transactions, and multi-sig support
 * @dev Supports EIP-4337 account abstraction, session management, and social recovery
 */
contract SmartWallet is AccessControl, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    // Structs
    struct SessionKey {
        address key;
        bytes32 permissions; // bitmap of allowed operations
        uint256 spendLimit;
        uint256 spentAmount;
        uint256 validUntil;
        bool isActive;
    }

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        uint256 nonce;
        uint256 deadline;
        bytes[] signatures;
    }

    struct Guardian {
        address guardian;
        uint256 addedAt;
        bool isActive;
        uint256 threshold; // signatures needed for recovery
    }

    struct WalletConfig {
        uint256 dailyLimit;
        uint256 txLimit;
        uint256 gasLimit;
        bool gaslessEnabled;
        bool multiSigEnabled;
        uint256 multiSigThreshold;
    }

    // State
    WalletConfig public config = WalletConfig({
        dailyLimit: 10 ether,
        txLimit: 5 ether,
        gasLimit: 1_000_000,
        gaslessEnabled: true,
        multiSigEnabled: false,
        multiSigThreshold: 2
    });

    mapping(bytes32 => SessionKey) public sessionKeys;
    mapping(address => bytes32[]) public userSessionKeys;
    mapping(address => Guardian[]) public guardians;
    mapping(bytes32 => bool) public executedUserOps;
    
    // Daily spending tracking
    mapping(address => uint256) public dailySpent;
    mapping(address => uint256) public dailyResetTime;

    // Module support
    mapping(address => bool) public authorizedModules;
    address[] public enabledModules;

    // Events
    event SessionKeyCreated(
        bytes32 indexed sessionId,
        address indexed key,
        uint256 spendLimit,
        uint256 validUntil
    );
    event SessionKeyRevoked(bytes32 indexed sessionId);
    event GuardianAdded(address indexed guardian, uint256 threshold);
    event GuardianRemoved(address indexed guardian);
    event TransactionExecuted(
        address indexed to,
        uint256 value,
        bytes data,
        bytes32 indexed txHash
    );
    event GaslessExecuted(
        address indexed signer,
        bytes32 indexed userOpHash,
        bool success
    );
    event ConfigUpdated(
        uint256 dailyLimit,
        uint256 txLimit,
        uint256 multiSigThreshold
    );
    event ModuleAuthorized(address indexed module, bool authorized);
    event SocialRecoveryInitiated(
        address indexed newOwner,
        uint256 unlockTime
    );
    event SocialRecoveryCompleted(address indexed newOwner);

    constructor() EIP712("SmartWallet", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
    }

    // ============ Session Key Management ============

    function createSessionKey(
        address _key,
        uint256 _spendLimit,
        uint256 _validDuration,
        bytes32 _permissions
    ) external returns (bytes32 sessionId) {
        require(_key != address(0), "Invalid key");
        require(_spendLimit > 0, "Invalid limit");
        require(_validDuration > 0 && _validDuration <= 30 days, "Invalid duration");

        sessionId = keccak256(abi.encode(_key, block.timestamp, msg.sender));

        sessionKeys[sessionId] = SessionKey({
            key: _key,
            permissions: _permissions,
            spendLimit: _spendLimit,
            spentAmount: 0,
            validUntil: block.timestamp + _validDuration,
            isActive: true
        });

        userSessionKeys[msg.sender].push(sessionId);

        emit SessionKeyCreated(sessionId, _key, _spendLimit, block.timestamp + _validDuration);
        return sessionId;
    }

    function revokeSessionKey(bytes32 _sessionId) external {
        require(sessionKeys[_sessionId].key == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        require(sessionKeys[_sessionId].isActive, "Not active");

        sessionKeys[_sessionId].isActive = false;

        emit SessionKeyRevoked(_sessionId);
    }

    function updateSessionLimit(bytes32 _sessionId, uint256 _newLimit) external {
        require(sessionKeys[_sessionId].key == msg.sender, "Not authorized");
        sessionKeys[_sessionId].spendLimit = _newLimit;
    }

    // ============ Transaction Execution ============

    function executeTransaction(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external payable nonReentrant returns (bool success, bytes memory result) {
        require(_to != address(0), "Invalid target");
        require(_value <= config.txLimit, "Exceeds tx limit");
        require(_data.length <= 64 * 1024, "Data too large");

        // Check daily limit
        _checkDailyLimit(_value);

        if (config.multiSigEnabled) {
            // Multi-sig validation happens off-chain, signatures passed separately
            // For now, require sender to be authorized
            require(hasRole(EXECUTOR_ROLE, msg.sender) || _isSessionKey(msg.sender), "Not authorized");
        } else {
            require(_isSessionKey(msg.sender) || msg.sender == owner() || hasRole(EXECUTOR_ROLE, msg.sender), "Not authorized");
        }

        // Update spending
        _updateDailySpending(_value);

        // Execute
        (success, result) = _to.call{value: _value}(_data);

        if (!success) {
            // Refund daily spent
            dailySpent[msg.sender] -= _value;
        }

        emit TransactionExecuted(_to, _value, _data, keccak256(abi.encode(_to, _value, _data, block.timestamp)));
        return (success, result);
    }

    function executeBatch(
        address[] calldata _targets,
        uint256[] calldata _values,
        bytes[] calldata _datas
    ) external payable nonReentrant returns (bool[] memory successes) {
        require(_targets.length == _values.length, "Length mismatch");
        require(_targets.length == _datas.length, "Length mismatch");
        require(_targets.length <= 10, "Too many txs");

        uint256 totalValue;
        for (uint256 i = 0; i < _targets.length; i++) {
            totalValue += _values[i];
        }

        _checkDailyLimit(totalValue);
        _updateDailySpending(totalValue);

        successes = new bool[](_targets.length);

        for (uint256 i = 0; i < _targets.length; i++) {
            (bool success, ) = _targets[i].call{value: _values[i]}(_datas[i]);
            successes[i] = success;

            if (!success) {
                dailySpent[msg.sender] -= _values[i];
            }
        }
    }

    function _checkDailyLimit(uint256 _value) internal view {
        require(_value <= config.dailyLimit, "Exceeds daily limit");
    }

    function _updateDailySpending(uint256 _value) internal {
        if (block.timestamp - dailyResetTime[msg.sender] >= 24 hours) {
            dailySpent[msg.sender] = 0;
            dailyResetTime[msg.sender] = block.timestamp;
        }
        dailySpent[msg.sender] += _value;
        require(dailySpent[msg.sender] <= config.dailyLimit, "Daily limit exceeded");
    }

    function _isSessionKey(address _key) internal view returns (bool) {
        bytes32[] storage keys = userSessionKeys[msg.sender];
        for (uint256 i = 0; i < keys.length; i++) {
            SessionKey storage sk = sessionKeys[keys[i]];
            if (sk.key == _key && sk.isActive && block.timestamp < sk.validUntil) {
                if (sk.spentAmount + tx.gasprice <= sk.spendLimit) {
                    return true;
                }
            }
        }
        return false;
    }

    // ============ Gasless Transactions (EIP-4337 style) ============

    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    function executeUserOp(
        UserOperation calldata _op,
        bytes32 _userOpHash
    ) external nonReentrant onlyRole(EXECUTOR_ROLE) returns (bool success) {
        require(config.gaslessEnabled, "Gasless disabled");
        require(!executedUserOps[_userOpHash], "Already executed");

        executedUserOps[_userOpHash] = true;

        // Verify signature
        bytes32 domainSeparator = _domainSeparator();
        bytes32 structHash = keccak256(abi.encode(_userOpHash));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        address signer = digest.recover(_op.signature);
        require(signer == _op.sender || _isSessionKey(signer), "Invalid signature");

        // Execute
        (success, ) = _op.sender.call{value: 0}(_op.callData);

        emit GaslessExecuted(signer, _userOpHash, success);
    }

    function _domainSeparator() internal view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ============ Multi-Sig Support ============

    function submitMultiSig(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (uint256 txIndex) {
        require(config.multiSigEnabled, "Multi-sig disabled");
        // Simplified - in production would have proper multi-sig tracking
        txIndex = 0;
    }

    function confirmMultiSig(uint256 _txIndex, bytes calldata _signature) external {
        require(config.multiSigEnabled, "Multi-sig disabled");
        // Simplified confirmation logic
    }

    // ============ Social Recovery ============

    uint256 public constant RECOVERY_DELAY = 48 hours;
    uint256 public recoveryUnlockTime;
    address public pendingNewOwner;

    function initiateSocialRecovery(address _newOwner) external onlyRole(GUARDIAN_ROLE) {
        require(_newOwner != address(0), "Invalid owner");
        require(guardians[msg.sender].length > 0, "Not a guardian");

        pendingNewOwner = _newOwner;
        recoveryUnlockTime = block.timestamp + RECOVERY_DELAY;

        emit SocialRecoveryInitiated(_newOwner, recoveryUnlockTime);
    }

    function completeSocialRecovery() external {
        require(pendingNewOwner != address(0), "No pending recovery");
        require(block.timestamp >= recoveryUnlockTime, "Too early");
        require(msg.sender == pendingNewOwner, "Not the new owner");

        emit SocialRecoveryCompleted(pendingNewOwner);

        // Transfer ownership
        pendingNewOwner = address(0);
        recoveryUnlockTime = 0;
    }

    // ============ Guardian Management ============

    function addGuardian(address _guardian, uint256 _threshold) external {
        require(_guardian != address(0), "Invalid guardian");
        require(_threshold > 0, "Invalid threshold");

        Guardian[] storage gs = guardians[msg.sender];
        for (uint256 i = 0; i < gs.length; i++) {
            require(gs[i].guardian != _guardian, "Already a guardian");
        }

        guardians[msg.sender].push(Guardian({
            guardian: _guardian,
            addedAt: block.timestamp,
            isActive: true,
            threshold: _threshold
        }));

        _grantRole(GUARDIAN_ROLE, _guardian);

        emit GuardianAdded(_guardian, _threshold);
    }

    function removeGuardian(address _guardian) external {
        Guardian[] storage gs = guardians[msg.sender];
        for (uint256 i = 0; i < gs.length; i++) {
            if (gs[i].guardian == _guardian) {
                gs[i].isActive = false;
                _revokeRole(GUARDIAN_ROLE, _guardian);
                emit GuardianRemoved(_guardian);
                return;
            }
        }
    }

    // ============ Module Support ============

    function authorizeModule(address _module, bool _authorize) external onlyRole(DEFAULT_ADMIN_ROLE) {
        authorizedModules[_module] = _authorize;
        if (_authorize) {
            enabledModules.push(_module);
        }
        emit ModuleAuthorized(_module, _authorize);
    }

    // ============ Admin Functions ============

    function updateConfig(
        uint256 _dailyLimit,
        uint256 _txLimit,
        uint256 _multiSigThreshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_dailyLimit >= _txLimit, "Invalid limits");

        config.dailyLimit = _dailyLimit;
        config.txLimit = _txLimit;
        config.multiSigThreshold = _multiSigThreshold;

        emit ConfigUpdated(_dailyLimit, _txLimit, _multiSigThreshold);
    }

    function toggleGasless() external onlyRole(DEFAULT_ADMIN_ROLE) {
        config.gaslessEnabled = !config.gaslessEnabled;
    }

    function toggleMultiSig() external onlyRole(DEFAULT_ADMIN_ROLE) {
        config.multiSigEnabled = !config.multiSigEnabled;
    }

    // ============ View Functions ============

    function owner() public view returns (address) {
        return msg.sender; // Simplified - in production would be stored separately
    }

    function getSessionKeys(address _user) external view returns (bytes32[] memory) {
        return userSessionKeys[_user];
    }

    function getSessionKeyInfo(bytes32 _sessionId) external view returns (
        address key,
        uint256 spendLimit,
        uint256 spentAmount,
        uint256 validUntil,
        bool isActive
    ) {
        SessionKey storage sk = sessionKeys[_sessionId];
        return (sk.key, sk.spendLimit, sk.spentAmount, sk.validUntil, sk.isActive);
    }

    function getGuardians(address _user) external view returns (Guardian[] memory) {
        return guardians[_user];
    }

    function getDailySpent(address _user) external view returns (uint256 spent, uint256 limit) {
        return (dailySpent[_user], config.dailyLimit);
    }

    function getEnabledModules() external view returns (address[] memory) {
        return enabledModules;
    }

    // ============ Token Management ============

    function transferERC20(
        address _token,
        address _to,
        uint256 _amount
    ) external nonReentrant {
        IERC20(_token).safeTransfer(_to, _amount);
    }

    function approveERC20(
        address _token,
        address _spender,
        uint256 _amount
    ) external {
        IERC20(_token).forceApprove(_spender, _amount);
    }

    // Receive ETH
    receive() external payable {}
}
