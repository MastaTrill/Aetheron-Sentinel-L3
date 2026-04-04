// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title L2zkSyncBridge
 * @notice zkSync native bridge with EIP-721 and proof-based withdrawals
 * @dev Features:
 *      - zkSync Era native bridging
 *      - Merkle proof verification for withdrawals
 *      - Priority queue for L1 → L2 deposits
 *      - Proof aggregation support
 *      - Cross-chain Sentinel integration
 */
contract L2zkSyncBridge is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant SENTINEL_ROLE = keccak256("SENTINEL_ROLE");
    bytes32 public constant PROVER_ROLE = keccak256("PROVER_ROLE");

    uint256 public constant L2_TO_L1_PRECISION = 1e10;
    uint256 public constant MIN_DEPOSIT_AMOUNT = 0.001 ether;
    uint256 public constant PROOF_GAS_LIMIT = 500000;

    // ============ State Variables ============

    /// @notice L1 bridge address
    address public l1Bridge;

    /// @notice zkSync rollup contract (for L1 → L2)
    address public zkSyncRollup;

    /// @notice zkSync bridge implementation
    address public zkSyncBridge;

    /// @notice L2 token (ETH or ERC20)
    address public l2Token;

    /// @notice Merkle tree root (tracks deposits)
    bytes32 public merkleRoot;

    /// @notice Total deposits tracked
    uint256 public totalDeposits;

    /// @notice Deposit records
    mapping(bytes32 => DepositRecord) public deposits;
    uint256 public depositCount;

    /// @notice Withdrawal records
    mapping(bytes32 => WithdrawalRecord) public withdrawals;
    mapping(bytes32 => bool) public provenWithdrawals;
    mapping(bytes32 => bool) public finalizedWithdrawals;

    /// @notice Priority queue for L1 → L2
    bytes32[] public priorityQueue;
    uint256 public priorityQueueIndex;

    // ============ Structs ============

    struct DepositRecord {
        address sender;
        address recipient;
        address l1Token;
        uint256 amount;
        uint256 timestamp;
        uint256 depositId;
        bytes32 leafHash;
        bool included;
    }

    struct WithdrawalRecord {
        address sender;
        address recipient;
        address l1Token;
        uint256 amount;
        uint256 timestamp;
        bytes32[] proof;
        bytes32 rootAfterWithdrawal;
        bool proven;
        bool finalized;
    }

    struct ProofInput {
        bytes32[] proof;
        uint256 publicInputs;
        uint256[] verifyProof;
    }

    // ============ Events ============

    event Deposit(
        address indexed sender,
        address indexed recipient,
        address indexed l1Token,
        uint256 amount,
        uint256 depositId
    );

    event DepositReceived(
        bytes32 indexed priorityOperation,
        address indexed sender,
        address indexed recipient,
        address l1Token,
        uint256 amount
    );

    event WithdrawalInitiated(
        address indexed sender,
        address indexed recipient,
        address indexed l1Token,
        uint256 amount,
        bytes32 withdrawalHash
    );

    event WithdrawalProofSubmitted(
        bytes32 indexed withdrawalHash,
        uint256 proofIndex
    );

    event WithdrawalFinalized(
        bytes32 indexed withdrawalHash,
        address indexed recipient,
        uint256 amount
    );

    event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);
    event PriorityQueueProcessed(uint256 processedCount);

    // ============ Errors ============

    error BelowMinDeposit(uint256 amount, uint256 min);
    error InvalidProof();
    error WithdrawalAlreadyProven(bytes32 withdrawalHash);
    error WithdrawalAlreadyFinalized(bytes32 withdrawalHash);
    error WithdrawalNotProven(bytes32 withdrawalHash);
    error MerkleProofInvalid();
    error BridgePaused();

    // ============ Constructor ============

    constructor(
        address _l1Bridge,
        address _zkSyncRollup,
        address _zkSyncBridge,
        address _l2Token
    ) {
        require(_l1Bridge != address(0), "Invalid L1 bridge");
        require(_zkSyncRollup != address(0), "Invalid rollup");

        l1Bridge = _l1Bridge;
        zkSyncRollup = _zkSyncRollup;
        zkSyncBridge = _zkSyncBridge;
        l2Token = _l2Token;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_ROLE, msg.sender);
        _grantRole(SENTINEL_ROLE, msg.sender);
    }

    // ============ L1 → L2 Deposits (via Priority Queue) ============

    /**
     * @notice Process priority operation from L1
     * @dev Called by zkSync rollup when processing L1 → L2 transactions
     */
    function priorityOperation(
        address sender,
        address recipient,
        address l1Token,
        uint256 amount,
        bytes calldata data
    ) external onlyRole(BRIDGE_ROLE) {
        // Create deposit record
        bytes32 depositHash = keccak256(
            abi.encode(
                sender,
                recipient,
                l1Token,
                amount,
                depositCount,
                block.timestamp
            )
        );

        deposits[depositHash] = DepositRecord({
            sender: sender,
            recipient: recipient,
            l1Token: l1Token,
            amount: amount,
            timestamp: block.timestamp,
            depositId: depositCount,
            leafHash: depositHash,
            included: false
        });

        // Mint tokens to recipient
        // In production, use zkSync token handling

        depositCount++;
        totalDeposits += amount;

        emit DepositReceived(
            keccak256(abi.encode("PRIORITY", depositCount)),
            sender,
            recipient,
            l1Token,
            amount
        );
    }

    /**
     * @notice Add deposit to merkle tree
     */
    function addDepositToMerkle(bytes32 leaf) external onlyRole(PROVER_ROLE) {
        // Add leaf to merkle tree
        // (Simplified - in production, use proper merkle tree implementation)

        bytes32 oldRoot = merkleRoot;
        merkleRoot = keccak256(abi.encode(oldRoot, leaf));

        emit MerkleRootUpdated(oldRoot, merkleRoot);
    }

    // ============ L2 → L1 Withdrawals ============

    /**
     * @notice Initiate withdrawal to L1
     */
    function withdrawToL1(
        address l1Token,
        uint256 amount,
        uint256 l2GasLimit
    ) external nonReentrant whenNotPaused {
        if (amount < MIN_DEPOSIT_AMOUNT) {
            revert BelowMinDeposit(amount, MIN_DEPOSIT_AMOUNT);
        }

        // Burn L2 tokens
        if (l1Token == address(0)) {
            // ETH withdrawal
        } else {
            IERC20(l1Token).safeTransferFrom(msg.sender, address(this), amount);
        }

        // Create withdrawal record
        bytes32 withdrawalHash = keccak256(
            abi.encode(
                msg.sender,
                msg.sender,
                l1Token,
                amount,
                block.timestamp,
                block.number
            )
        );

        withdrawals[withdrawalHash] = WithdrawalRecord({
            sender: msg.sender,
            recipient: msg.sender,
            l1Token: l1Token,
            amount: amount,
            timestamp: block.timestamp,
            proof: new bytes32[](0),
            rootAfterWithdrawal: bytes32(0),
            proven: false,
            finalized: false
        });

        emit WithdrawalInitiated(
            msg.sender,
            msg.sender,
            l1Token,
            amount,
            withdrawalHash
        );
    }

    /**
     * @notice Submit withdrawal proof
     * @dev Called after the withdrawal is finalized on L1
     */
    function proveWithdrawal(
        bytes32 withdrawalHash,
        bytes32[] calldata proof,
        bytes32 rootAfterWithdrawal,
        uint256[] calldata verifyProof
    ) external onlyRole(PROVER_ROLE) {
        WithdrawalRecord storage withdrawal = withdrawals[withdrawalHash];

        if (withdrawal.proven) {
            revert WithdrawalAlreadyProven(withdrawalHash);
        }

        // Verify merkle proof
        bool validProof = _verifyMerkleProof(
            withdrawalHash,
            proof,
            rootAfterWithdrawal
        );

        if (!validProof) {
            revert MerkleProofInvalid();
        }

        withdrawal.proof = proof;
        withdrawal.rootAfterWithdrawal = rootAfterWithdrawal;
        withdrawal.proven = true;
        provenWithdrawals[withdrawalHash] = true;

        emit WithdrawalProofSubmitted(withdrawalHash, block.number);
    }

    /**
     * @notice Finalize withdrawal on L2 (after L1 proof verification)
     */
    function finalizeWithdrawal(
        bytes32 withdrawalHash,
        bytes calldata l1ProofData
    ) external nonReentrant whenNotPaused {
        WithdrawalRecord storage withdrawal = withdrawals[withdrawalHash];

        if (!withdrawal.proven) {
            revert WithdrawalNotProven(withdrawalHash);
        }

        if (withdrawal.finalized) {
            revert WithdrawalAlreadyFinalized(withdrawalHash);
        }

        // In production, verify L1 proof on L2
        // This is simplified for the demo

        withdrawal.finalized = true;
        finalizedWithdrawals[withdrawalHash] = true;

        emit WithdrawalFinalized(
            withdrawalHash,
            withdrawal.recipient,
            withdrawal.amount
        );
    }

    // ============ Batch Operations ============

    /**
     * @notice Process batch of priority operations
     */
    function processPriorityQueue(
        uint256 batchSize
    ) external onlyRole(BRIDGE_ROLE) {
        uint256 processed = 0;

        while (
            processed < batchSize && priorityQueueIndex < priorityQueue.length
        ) {
            bytes32 operation = priorityQueue[priorityQueueIndex];
            priorityQueueIndex++;
            processed++;
        }

        emit PriorityQueueProcessed(processed);
    }

    // ============ Admin Functions ============

    function pause() external onlyRole(SENTINEL_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setL1Bridge(address bridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        l1Bridge = bridge;
    }

    function setMerkleRoot(bytes32 root) external onlyRole(PROVER_ROLE) {
        bytes32 old = merkleRoot;
        merkleRoot = root;
        emit MerkleRootUpdated(old, root);
    }

    // ============ Internal Functions ============

    function _verifyMerkleProof(
        bytes32 leaf,
        bytes32[] memory proof,
        bytes32 root
    ) internal pure returns (bool) {
        bytes32 current = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (current < proofElement) {
                current = keccak256(abi.encodePacked(current, proofElement));
            } else {
                current = keccak256(abi.encodePacked(proofElement, current));
            }
        }

        return current == root;
    }

    // ============ View Functions ============

    function getDepositRecord(
        bytes32 depositHash
    ) external view returns (DepositRecord memory) {
        return deposits[depositHash];
    }

    function getWithdrawalRecord(
        bytes32 withdrawalHash
    ) external view returns (WithdrawalRecord memory) {
        return withdrawals[withdrawalHash];
    }

    function isWithdrawalProven(
        bytes32 withdrawalHash
    ) external view returns (bool) {
        return provenWithdrawals[withdrawalHash];
    }

    function isWithdrawalFinalized(
        bytes32 withdrawalHash
    ) external view returns (bool) {
        return finalizedWithdrawals[withdrawalHash];
    }

    function getMerkleRoot() external view returns (bytes32) {
        return merkleRoot;
    }

    function getTotalDeposits() external view returns (uint256) {
        return totalDeposits;
    }

    function getDepositCount() external view returns (uint256) {
        return depositCount;
    }
}
