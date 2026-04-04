// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrossChainEnabled} from "../interfaces/ICrossChainEnabled.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title L2OptimismBridge
 * @notice Optimism (Op Stack) native bridge with Sentinel protection
 * @dev Features:
 *      - Native L2 → L1 bridging
 *      - Optimism Bedrock compatibility
 *      - Fast withdrawal with Sequencer integration
 *      - Automatic pause on L1 on security events
 *      - Cross-chain security messaging
 */
contract L2OptimismBridge is
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant SENTINEL_ROLE = keccak256("SENTINEL_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");

    uint256 public constant L2_TO_L1_PRECISION = 1e10;
    uint256 public constant MIN_WITHDRAWAL_AMOUNT = 0.01 ether;
    uint256 public constant WITHDRAWAL_DELAY = 7 days;

    // ============ State Variables ============

    /// @notice L1 bridge address
    address public l1Bridge;

    /// @notice L2 Cross Domain Messenger
    address public messenger;

    /// @notice Sentinel on L1 (for cross-chain messaging)
    address public l1Sentinel;

    /// @notice Chain ID
    uint256 public chainId;

    /// @notice Nonce for message uniqueness
    uint256 public nonce;

    /// @notice Total bridged amount
    uint256 public totalBridged;

    /// @notice Withdrawal records
    mapping(bytes32 => WithdrawalRecord) public withdrawals;
    mapping(bytes32 => bool) public finalizedWithdrawals;

    /// @notice L2 token address (canonical token)
    address public l2Token;

    // ============ Structs ============

    struct WithdrawalRecord {
        address sender;
        address recipient;
        address l1Token;
        uint256 amount;
        uint256 timestamp;
        bool claimed;
        bytes32[] proof;
    }

    // ============ Events ============

    event WithdrawalInitiated(
        address indexed sender,
        address indexed recipient,
        address indexed l1Token,
        uint256 amount,
        bytes32 withdrawalHash
    );

    event WithdrawalInitiatedToL1(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 crossDomainMessage
    );

    event WithdrawalFinalized(
        bytes32 indexed withdrawalHash,
        address indexed recipient,
        uint256 amount
    );

    event L1SentinelAlerted(
        bytes32 indexed alertId,
        uint256 l1TVL,
        uint256 threshold
    );

    event FastWithdrawalRequested(
        address indexed recipient,
        uint256 amount,
        address relayer
    );

    event BridgePaused();

    event CrossChainMessageReceived(
        bytes32 indexed messageId,
        uint256 indexed sourceChain,
        bytes data
    );

    // ============ Errors ============

    error BelowMinWithdrawal(uint256 amount, uint256 min);
    error WithdrawalNotFound(bytes32 withdrawalHash);
    error AlreadyFinalized(bytes32 withdrawalHash);
    error InvalidProof();
    error BridgePaused();
    error InvalidCrossChainSender();

    modifier onlyCrossChainSource(address messengerAddress) {
        if (msg.sender != messengerAddress) revert InvalidCrossChainSender();
        _;
    }

    // ============ Constructor ============

    constructor(
        address _l1Bridge,
        address _messenger,
        address _l2Token,
        uint256 _chainId
    ) {
        require(_l1Bridge != address(0), "Invalid L1 bridge");
        require(_messenger != address(0), "Invalid messenger");

        l1Bridge = _l1Bridge;
        messenger = _messenger;
        l2Token = _l2Token;
        chainId = _chainId;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_ROLE, msg.sender);
        _grantRole(SENTINEL_ROLE, msg.sender);
    }

    // ============ L2 → L1 Withdrawal ============

    /**
     * @notice Initiate withdrawal to L1
     */
    function withdrawToL1(
        address l1Token,
        uint256 amount,
        uint32 gasLimit
    ) external nonReentrant whenNotPaused {
        if (amount < MIN_WITHDRAWAL_AMOUNT) {
            revert BelowMinWithdrawal(amount, MIN_WITHDRAWAL_AMOUNT);
        }

        // Burn L2 tokens
        if (l1Token == address(0)) {
            // ETH withdrawal
            // For L2 ETH, burn directly
        } else {
            IERC20(l1Token).safeTransferFrom(msg.sender, address(this), amount);
        }

        // Generate withdrawal hash
        bytes32 withdrawalHash = _getWithdrawHash(
            msg.sender,
            msg.sender,
            l1Token,
            amount
        );

        // Record withdrawal
        withdrawals[withdrawalHash] = WithdrawalRecord({
            sender: msg.sender,
            recipient: msg.sender,
            l1Token: l1Token,
            amount: amount,
            timestamp: block.timestamp,
            claimed: false,
            proof: new bytes32[](0)
        });

        // Send cross-chain message
        bytes memory message = abi.encodeWithSignature(
            "finalizeDeposit(address,address,address,uint256,bytes)",
            msg.sender,
            msg.sender,
            l1Token,
            amount,
            "0x"
        );

        bytes32 messageHash = _sendCrossChainMessage(
            l1Bridge,
            message,
            gasLimit
        );

        emit WithdrawalInitiated(
            msg.sender,
            msg.sender,
            l1Token,
            amount,
            withdrawalHash
        );

        emit WithdrawalInitiatedToL1(
            msg.sender,
            msg.sender,
            amount,
            messageHash
        );
    }

    /**
     * @notice Initiate withdrawal to specific L1 recipient
     */
    function withdrawToL1Recipient(
        address l1Token,
        address recipient,
        uint256 amount,
        uint32 gasLimit
    ) external nonReentrant whenNotPaused {
        if (amount < MIN_WITHDRAWAL_AMOUNT) {
            revert BelowMinWithdrawal(amount, MIN_WITHDRAWAL_AMOUNT);
        }

        // Burn tokens
        if (l1Token == address(0)) {
            // ETH withdrawal
        } else {
            IERC20(l1Token).safeTransferFrom(msg.sender, address(this), amount);
        }

        bytes32 withdrawalHash = _getWithdrawHash(
            msg.sender,
            recipient,
            l1Token,
            amount
        );

        withdrawals[withdrawalHash] = WithdrawalRecord({
            sender: msg.sender,
            recipient: recipient,
            l1Token: l1Token,
            amount: amount,
            timestamp: block.timestamp,
            claimed: false,
            proof: new bytes32[](0)
        });

        // Cross-chain message
        bytes memory message = abi.encodeWithSignature(
            "finalizeDeposit(address,address,address,uint256,bytes)",
            msg.sender,
            recipient,
            l1Token,
            amount,
            "0x"
        );

        _sendCrossChainMessage(l1Bridge, message, gasLimit);

        emit WithdrawalInitiated(
            msg.sender,
            recipient,
            l1Token,
            amount,
            withdrawalHash
        );
    }

    // ============ Fast Withdrawal ============

    /**
     * @notice Request fast withdrawal via relayer
     */
    function requestFastWithdrawal(
        uint256 amount,
        address relayer,
        uint256 relayerFee
    ) external nonReentrant whenNotPaused returns (bytes32) {
        // Generate withdrawal hash
        bytes32 withdrawalHash = _getWithdrawHash(
            msg.sender,
            msg.sender,
            address(0),
            amount
        );

        // User gets instant L1 from relayer
        // Relayer claims from L1 bridge after challenge period

        // Lock user's L2 funds
        // (Simplified - in production, integrate with liquidity pool)

        emit FastWithdrawalRequested(msg.sender, amount, relayer);

        return withdrawalHash;
    }

    // ============ Cross-Chain Security ============

    /**
     * @notice Receive cross-chain message from L1
     */
    function receiveFromL1(
        bytes32 messageId,
        bytes memory message
    ) external onlyCrossChainSource(messenger) {
        emit CrossChainMessageReceived(messageId, chainId, message);

        // Parse message
        (bytes4 selector, bytes memory data) = _parseMessage(message);

        if (selector == bytes4(keccak256("emergencyPause()"))) {
            _pause();
            emit BridgePaused();
        } else if (
            selector ==
            bytes4(keccak256("alertSentinel(bytes32,uint256,uint256)"))
        ) {
            (bytes32 alertId, uint256 l1TVL, uint256 threshold) = abi.decode(
                data,
                (bytes32, uint256, uint256)
            );
            emit L1SentinelAlerted(alertId, l1TVL, threshold);
        }
    }

    /**
     * @notice Send alert to L1 Sentinel
     */
    function alertL1Sentinel(
        bytes32 alertId,
        uint256 tvl,
        uint256 tvlSpikePercent
    ) external onlyRole(SENTINEL_ROLE) {
        bytes memory message = abi.encodeWithSignature(
            "receiveAlert(bytes32,uint256,uint256)",
            alertId,
            tvl,
            tvlSpikePercent
        );

        _sendCrossChainMessage(l1Sentinel, message, 100000);

        emit L1SentinelAlerted(alertId, tvl, tvlSpikePercent);
    }

    // ============ Admin Functions ============

    function pause() external onlyRole(SENTINEL_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setL1Sentinel(
        address sentinel
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        l1Sentinel = sentinel;
    }

    function setL1Bridge(address bridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        l1Bridge = bridge;
    }

    // ============ Internal Functions ============

    function _getWithdrawHash(
        address sender,
        address recipient,
        address l1Token,
        uint256 amount
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    sender,
                    recipient,
                    l1Token,
                    amount,
                    nonce++,
                    block.timestamp
                )
            );
    }

    function _sendCrossChainMessage(
        address to,
        bytes memory message,
        uint32 gasLimit
    ) internal returns (bytes32) {
        // In production, use CrossDomainEnabled functionality
        // ICrossDomainMessenger(messenger).sendMessage(to, message, gasLimit);
        return keccak256(abi.encode(message, block.number));
    }

    function _parseMessage(
        bytes memory message
    ) internal pure returns (bytes4 selector, bytes memory data) {
        require(message.length >= 4, "Message too short");
        assembly {
            selector := mload(add(message, 32))
        }
        if (message.length > 4) {
            data = new bytes(message.length - 4);
            assembly {
                mstore(add(data, 32), mload(add(message, 36)))
            }
        }
    }
    }

    // ============ View Functions ============

    function getWithdrawalRecord(
        bytes32 withdrawalHash
    )
        external
        view
        returns (
            address sender,
            address recipient,
            address l1Token,
            uint256 amount,
            uint256 timestamp,
            bool claimed
        )
    {
        WithdrawalRecord storage record = withdrawals[withdrawalHash];
        return (
            record.sender,
            record.recipient,
            record.l1Token,
            record.amount,
            record.timestamp,
            record.claimed
        );
    }

    function getTotalBridged() external view returns (uint256) {
        return totalBridged;
    }
}
