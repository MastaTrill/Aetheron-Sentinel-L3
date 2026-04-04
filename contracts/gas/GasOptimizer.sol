// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title GasOptimizer
 * @notice Batched transactions & meta-transactions to reduce gas costs
 * @dev Supports ERC20 relayers, batched swaps, and gasless transactions
 */
contract GasOptimizer is AccessControl, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant BATCHER_ROLE = keccak256("BATCHER_ROLE");

    // Structs
    struct MetaTransaction {
        address from;
        address to;
        uint256 value;
        bytes data;
        uint256 gas;
        uint256 nonce;
        uint256 deadline;
    }

    struct BatchTransaction {
        address[] targets;
        bytes[] datas;
        uint256[] values;
        bool atomic;
    }

    struct UserNonce {
        uint256 nonce;
        uint256 lastProcessedAt;
    }

    struct GasSettings {
        uint256 maxGasPrice;
        uint256 priorityFee;
        uint256 baseFeeLimit;
        bool enabled;
    }

    // State
    mapping(address => UserNonce) public userNonces;
    mapping(bytes32 => bool) public executedTxs;

    // Gas optimization
    GasSettings public gasSettings =
        GasSettings({
            maxGasPrice: 100 gwei,
            priorityFee: 2 gwei,
            baseFeeLimit: 50 gwei,
            enabled: true
        });

    // Fee management
    uint256 public protocolFee = 0; // 0 for gasless
    uint256 public collectedFees;
    address public feeRecipient;

    // Batching
    mapping(address => BatchTransaction) public pendingBatches;
    mapping(bytes32 => bool) public batchExecuted;
    uint256 public batchTimeout = 5 minutes;
    uint256 public minBatchSize = 2;

    // Gasless whitelist
    mapping(address => bool) public gaslessEnabled;
    mapping(address => uint256) public gaslessDeposits;

    // Events
    event MetaTransactionExecuted(
        address indexed user,
        address indexed to,
        bytes32 txHash,
        uint256 gasUsed
    );
    event BatchCreated(
        bytes32 indexed batchId,
        address indexed creator,
        uint256 txCount
    );
    event BatchExecuted(
        bytes32 indexed batchId,
        uint256 successCount,
        uint256 failCount
    );
    event BatchCancelled(bytes32 indexed batchId);
    event GaslessDeposit(address indexed user, uint256 amount);
    event GaslessWithdrawal(address indexed user, uint256 amount);
    event RelayerRewardsDistributed(address indexed relayer, uint256 amount);
    event GasSettingsUpdated(uint256 maxGasPrice, uint256 priorityFee);
    event ProtocolFeeUpdated(uint256 newFee);

    constructor(address _feeRecipient) EIP712("GasOptimizer", "1") {
        require(_feeRecipient != address(0), "Invalid recipient");
        feeRecipient = _feeRecipient;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);
        _grantRole(BATCHER_ROLE, msg.sender);
    }

    // ============ Meta-Transactions (Gasless) ============

    function executeMetaTransaction(
        MetaTransaction calldata _tx,
        bytes calldata _signature
    ) external nonReentrant onlyRole(RELAYER_ROLE) returns (bytes memory) {
        require(_tx.deadline >= block.timestamp, "Transaction expired");
        require(gasSettings.enabled, "Gasless disabled");
        require(
            gaslessEnabled[_tx.from] || gaslessDeposits[_tx.from] > 0,
            "Gasless not enabled"
        );

        bytes32 domainSeparator = _domainSeparator();
        bytes32 structHash = keccak256(
            abi.encode(
                _tx.from,
                _tx.to,
                _tx.value,
                _tx.data,
                _tx.gas,
                _tx.nonce,
                _tx.deadline
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );

        // Verify signature
        address signer = digest.recover(_signature);
        require(signer == _tx.from, "Invalid signature");

        // Verify nonce
        require(_tx.nonce == userNonces[_tx.from].nonce, "Invalid nonce");

        bytes32 txHash = keccak256(abi.encode(_tx, _signature));
        require(!executedTxs[txHash], "Transaction already executed");

        // Mark as executed
        executedTxs[txHash] = true;
        userNonces[_tx.from].nonce++;
        userNonces[_tx.from].lastProcessedAt = block.timestamp;

        // Execute transaction
        (bool success, bytes memory result) = _tx.to.call{value: _tx.value}(
            _tx.data
        );

        require(success, "Meta-transaction failed");

        emit MetaTransactionExecuted(_tx.from, _tx.to, txHash, _tx.gas);
        return result;
    }

    function getNonce(address _user) external view returns (uint256) {
        return userNonces[_user].nonce;
    }

    function _domainSeparator() internal view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ============ Batched Transactions ============

    function createBatch(
        address[] calldata _targets,
        bytes[] calldata _datas,
        uint256[] calldata _values,
        bool _atomic
    ) external onlyRole(BATCHER_ROLE) returns (bytes32 batchId) {
        require(_targets.length >= minBatchSize, "Batch too small");
        require(_targets.length == _datas.length, "Array mismatch");
        require(_targets.length == _values.length, "Array mismatch");

        batchId = keccak256(
            abi.encode(
                msg.sender,
                block.timestamp,
                _targets,
                keccak256(abi.encode(_datas))
            )
        );

        pendingBatches[msg.sender] = BatchTransaction({
            targets: _targets,
            datas: _datas,
            values: _values,
            atomic: _atomic
        });

        emit BatchCreated(batchId, msg.sender, _targets.length);
        return batchId;
    }

    function executeBatch(
        address _creator
    ) external nonReentrant onlyRole(BATCHER_ROLE) {
        BatchTransaction storage batch = pendingBatches[_creator];
        require(batch.targets.length > 0, "No pending batch");

        bytes32 batchId = keccak256(
            abi.encode(
                _creator,
                block.timestamp - 1 minutes, // Approximate
                batch.targets
            )
        );

        uint256 successCount;
        uint256 failCount;

        if (batch.atomic) {
            // Atomic: all or nothing
            for (uint256 i = 0; i < batch.targets.length; i++) {
                (bool success, ) = batch.targets[i].call{
                    value: batch.values[i]
                }(batch.datas[i]);
                require(success, "Atomic batch failed");
                successCount++;
            }
        } else {
            // Non-atomic: best effort
            for (uint256 i = 0; i < batch.targets.length; i++) {
                try
                    this.executeSingleCall(
                        batch.targets[i],
                        batch.values[i],
                        batch.datas[i]
                    )
                returns (bool success) {
                    if (success) successCount++;
                    else failCount++;
                } catch {
                    failCount++;
                }
            }
        }

        // Clear batch
        delete pendingBatches[_creator];
        batchExecuted[batchId] = true;

        emit BatchExecuted(batchId, successCount, failCount);
    }

    function executeSingleCall(
        address _target,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool success) {
        (success, ) = _target.call{value: _value}(_data);
    }

    function cancelBatch(address _creator) external {
        require(
            msg.sender == _creator || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        delete pendingBatches[_creator];
        emit BatchCancelled(keccak256(abi.encode(_creator, block.timestamp)));
    }

    // ============ ERC20 Batching (Swap Optimization) ============

    struct ERC20Swap {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address recipient;
    }

    function executeERC20Batch(
        ERC20Swap[] calldata _swaps,
        address _router
    )
        external
        nonReentrant
        onlyRole(BATCHER_ROLE)
        returns (uint256[] memory amounts)
    {
        require(_swaps.length >= minBatchSize, "Batch too small");

        amounts = new uint256[](_swaps.length);
        uint256 totalAmountIn;

        // Aggregate inputs
        for (uint256 i = 0; i < _swaps.length; i++) {
            IERC20(_swaps[i].tokenIn).safeTransferFrom(
                msg.sender,
                address(this),
                _swaps[i].amountIn
            );
            totalAmountIn += _swaps[i].amountIn;
        }

        // Single approval for aggregated amount - use direct safe approve
        IERC20 token = IERC20(_swaps[0].tokenIn);
        token.forceApprove(_router, totalAmountIn);

        // Execute swaps
        for (uint256 i = 0; i < _swaps.length; i++) {
            bytes memory swapData = abi.encodeWithSelector(
                bytes4(keccak256("swap(address,uint256,address)")),
                _swaps[i].tokenIn,
                _swaps[i].amountIn,
                _swaps[i].recipient
            );

            (bool success, bytes memory result) = _router.call(swapData);

            if (success) {
                amounts[i] = abi.decode(result, (uint256));
                require(
                    amounts[i] >= _swaps[i].minAmountOut,
                    "Slippage exceeded"
                );
            }
        }

        return amounts;
    }

    // ============ Gasless Deposits ============

    function depositForGasless(
        address _user,
        uint256 _amount
    ) external nonReentrant {
        require(_amount > 0, "Invalid amount");
        gaslessDeposits[_user] += _amount;
        gaslessEnabled[_user] = true;

        emit GaslessDeposit(_user, _amount);
    }

    function withdrawGaslessDeposit(uint256 _amount) external nonReentrant {
        require(gaslessDeposits[msg.sender] >= _amount, "Insufficient balance");
        gaslessDeposits[msg.sender] -= _amount;

        if (gaslessDeposits[msg.sender] == 0) {
            gaslessEnabled[msg.sender] = false;
        }

        emit GaslessWithdrawal(msg.sender, _amount);
    }

    // ============ Relayer Management ============

    function distributeRelayerRewards(
        address _relayer,
        uint256 _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(collectedFees >= _amount, "Insufficient fees");
        collectedFees -= _amount;

        (bool success, ) = _relayer.call{value: _amount}("");
        require(success, "Transfer failed");

        emit RelayerRewardsDistributed(_relayer, _amount);
    }

    // ============ Admin Functions ============

    function updateGasSettings(
        uint256 _maxGasPrice,
        uint256 _priorityFee,
        uint256 _baseFeeLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_maxGasPrice >= _priorityFee, "Invalid priority fee");
        require(_baseFeeLimit >= _maxGasPrice, "Invalid base fee limit");

        gasSettings.maxGasPrice = _maxGasPrice;
        gasSettings.priorityFee = _priorityFee;
        gasSettings.baseFeeLimit = _baseFeeLimit;

        emit GasSettingsUpdated(_maxGasPrice, _priorityFee);
    }

    function toggleGasless() external onlyRole(DEFAULT_ADMIN_ROLE) {
        gasSettings.enabled = !gasSettings.enabled;
    }

    function updateProtocolFee(
        uint256 _fee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_fee <= 1000, "Fee too high"); // Max 10%
        protocolFee = _fee;
        emit ProtocolFeeUpdated(_fee);
    }

    function updateFeeRecipient(
        address _recipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_recipient != address(0), "Invalid recipient");
        feeRecipient = _recipient;
    }

    function updateMinBatchSize(
        uint256 _size
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_size > 0, "Invalid size");
        minBatchSize = _size;
    }

    // ============ View Functions ============

    function getPendingBatch(
        address _creator
    )
        external
        view
        returns (
            address[] memory targets,
            bytes[] memory datas,
            uint256[] memory values,
            bool atomic
        )
    {
        BatchTransaction storage batch = pendingBatches[_creator];
        return (batch.targets, batch.datas, batch.values, batch.atomic);
    }

    function getGaslessBalance(address _user) external view returns (uint256) {
        return gaslessDeposits[_user];
    }

    function getCollectedFees() external view returns (uint256) {
        return collectedFees;
    }
}
