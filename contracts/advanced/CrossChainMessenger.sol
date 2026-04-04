// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {CrossChainEnabled} from "../interfaces/ICrossChainEnabled.sol";

/**
 * @title CrossChainMessenger
 * @notice Generalized cross-chain messaging with optimistic verification
 * @dev Features:
 *      - Generic message passing between chains
 *      - Optimistic verification (fraud proofs)
 *      - Message batching
 *      - Retry mechanisms
 *      - Cross-chain call execution
 */
contract CrossChainMessenger is AccessControl, Pausable {
    // ============ Constants ============

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    uint256 public constant CONFIRMATION_BLOCKS = 5;
    uint256 public constant MESSAGE_EXPIRY = 7 days;
    uint256 public constant MAX_BATCH_SIZE = 50;

    // ============ State Variables ============

    /// @notice Current chain ID
    uint256 public currentChainId;

    /// @notice Trusted remote domains
    mapping(uint256 => bool) public trustedRemotes;
    mapping(uint256 => address) public remoteMessengers;

    /// @notice Message tracking
    mapping(bytes32 => Message) public messages;
    mapping(uint256 => bytes32[]) public chainMessages;

    /// @notice Failed message retry tracking
    mapping(bytes32 => uint256) public failedMessageRetries;
    mapping(bytes32 => bytes) public failedMessageData;

    /// @notice Cross-chain call results
    mapping(bytes32 => CrossChainResult) public results;

    /// @notice Aggregate root for optimistic rollup messages
    bytes32 public aggregateRoot;

    // ============ Structs ============

    struct Message {
        uint256 sourceChain;
        uint256 destinationChain;
        address sender;
        address recipient;
        bytes data;
        uint256 nonce;
        uint256 timestamp;
        uint256 confirmations;
        MessageStatus status;
        bytes32[] proof;
    }

    struct CrossChainResult {
        bool success;
        bytes returnData;
        uint256 gasUsed;
    }

    enum MessageStatus {
        Pending,
        Sent,
        Received,
        Verified,
        Failed,
        Expired,
        Executed
    }

    // ============ Events ============

    event MessageSent(
        bytes32 indexed messageId,
        uint256 indexed destinationChain,
        address indexed recipient,
        bytes data
    );

    event MessageReceived(
        bytes32 indexed messageId,
        uint256 indexed sourceChain,
        address indexed sender
    );

    event MessageExecuted(
        bytes32 indexed messageId,
        bool success,
        bytes returnData
    );

    event MessageFailed(
        bytes32 indexed messageId,
        string reason,
        uint256 retryCount
    );

    event MessageVerified(bytes32 indexed messageId, uint256 verifierCount);

    event RemoteConfigured(
        uint256 indexed chainId,
        address indexed messenger,
        bool trusted
    );

    event AggregateRootUpdated(bytes32 indexed oldRoot, bytes32 newRoot);
    event CrossChainCallCompleted(bytes32 indexed callId, bool success);

    // ============ Errors ============

    error InvalidChain(uint256 chainId);
    error UntrustedRemote(uint256 chainId);
    error MessageNotFound(bytes32 messageId);
    error MessageExpired(bytes32 messageId);
    error InsufficientConfirmations(
        bytes32 messageId,
        uint256 required,
        uint256 current
    );
    error InvalidProof();
    error MaxRetriesExceeded(bytes32 messageId);
    error ExecutionFailed(string reason);
    error InvalidRecipient();
    error EmptyMessage();

    // ============ Constructor ============

    constructor(uint256 _chainId) {
        currentChainId = _chainId;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // ============ Message Passing ============

    /**
     * @notice Send a message to another chain
     */
    function sendMessage(
        uint256 destinationChain,
        address recipient,
        bytes calldata data
    ) external whenNotPaused returns (bytes32 messageId) {
        if (!trustedRemotes[destinationChain]) {
            revert UntrustedRemote(destinationChain);
        }
        if (recipient == address(0)) revert InvalidRecipient();
        if (data.length == 0) revert EmptyMessage();

        messageId = _generateMessageId(
            currentChainId,
            destinationChain,
            msg.sender,
            recipient,
            data
        );

        Message storage message = messages[messageId];
        message.sourceChain = currentChainId;
        message.destinationChain = destinationChain;
        message.sender = msg.sender;
        message.recipient = recipient;
        message.data = data;
        message.nonce = uint256(messageId);
        message.timestamp = block.timestamp;
        message.status = MessageStatus.Sent;

        chainMessages[destinationChain].push(messageId);

        emit MessageSent(messageId, destinationChain, recipient, data);

        // Forward to remote messenger
        _forwardToRemote(messageId, destinationChain);
    }

    /**
     * @notice Send message with value
     */
    function sendMessageWithValue(
        uint256 destinationChain,
        address recipient,
        bytes calldata data
    ) external payable whenNotPaused returns (bytes32 messageId) {
        messageId = this.sendMessage(destinationChain, recipient, data);

        // Store value for cross-chain transfer
        messages[messageId].data = abi.encodePacked(
            messages[messageId].data,
            msg.value
        );
    }

    /**
     * @notice Send batch messages
     */
    function sendBatchMessage(
        uint256 destinationChain,
        address[] calldata recipients,
        bytes[] calldata dataArray
    ) external whenNotPaused returns (bytes32[] memory messageIds) {
        if (recipients.length > MAX_BATCH_SIZE) revert InvalidProof();
        if (recipients.length != dataArray.length) revert InvalidProof();

        messageIds = new bytes32[](recipients.length);

        for (uint256 i = 0; i < recipients.length; i++) {
            messageIds[i] = this.sendMessage(
                destinationChain,
                recipients[i],
                dataArray[i]
            );
        }
    }

    // ============ Message Reception ============

    /**
     * @notice Receive message from another chain (called by relayer)
     */
    function receiveMessage(
        bytes32 messageId,
        uint256 sourceChain,
        address sender,
        bytes calldata data,
        bytes32[] calldata proof
    ) external onlyRole(RELAYER_ROLE) whenNotPaused {
        if (!trustedRemotes[sourceChain]) {
            revert UntrustedRemote(sourceChain);
        }

        // Verify proof (simplified)
        _verifyMessageProof(messageId, sourceChain, proof);

        Message storage message = messages[messageId];
        message.sourceChain = sourceChain;
        message.sender = sender;
        message.data = data;
        message.status = MessageStatus.Received;
        message.confirmations = CONFIRMATION_BLOCKS;

        chainMessages[currentChainId].push(messageId);

        emit MessageReceived(messageId, sourceChain, sender);
    }

    // ============ Message Execution ============

    /**
     * @notice Execute received message
     */
    function executeMessage(
        bytes32 messageId,
        bytes32[] calldata proof
    ) external whenNotPaused returns (bool success, bytes memory returnData) {
        Message storage message = messages[messageId];

        if (message.status == MessageStatus.Executed) {
            revert ExecutionFailed("Already executed");
        }

        if (block.timestamp > message.timestamp + MESSAGE_EXPIRY) {
            message.status = MessageStatus.Expired;
            revert MessageExpired(messageId);
        }

        // Verify proof
        _verifyMessageProof(messageId, message.sourceChain, proof);

        // Execute the call
        address recipient = message.recipient;
        bytes memory callData = message.data;

        // Ensure call is to this contract or allowed destination
        require(
            recipient == address(this) ||
                hasRole(DEFAULT_ADMIN_ROLE, recipient),
            "Invalid destination"
        );

        (success, returnData) = recipient.call(callData);

        if (success) {
            message.status = MessageStatus.Executed;
        } else {
            message.status = MessageStatus.Failed;
            failedMessageData[messageId] = returnData;
            failedMessageRetries[messageId]++;
            emit MessageFailed(
                messageId,
                "Execution reverted",
                failedMessageRetries[messageId]
            );
        }

        emit MessageExecuted(messageId, success, returnData);

        // Store result
        results[messageId] = CrossChainResult({
            success: success,
            returnData: returnData,
            gasUsed: gasleft()
        });

        emit CrossChainCallCompleted(messageId, success);
    }

    /**
     * @notice Retry failed message
     */
    function retryMessage(
        bytes32 messageId,
        bytes32[] calldata proof
    ) external whenNotPaused returns (bool) {
        Message storage message = messages[messageId];

        if (message.status != MessageStatus.Failed) {
            revert ExecutionFailed("Message not failed");
        }

        if (failedMessageRetries[messageId] >= 5) {
            revert MaxRetriesExceeded(messageId);
        }

        // Retry execution
        (bool success, bytes memory returnData) = this.executeMessage(
            messageId,
            proof
        );

        if (success) {
            emit CrossChainCallCompleted(messageId, true);
            return true;
        } else {
            failedMessageRetries[messageId]++;
            emit MessageFailed(
                messageId,
                "Retry failed",
                failedMessageRetries[messageId]
            );
            return false;
        }
    }

    // ============ Cross-Chain Calls ============

    /**
     * @notice Execute cross-chain call
     */
    function crossChainCall(
        uint256 destinationChain,
        address target,
        bytes calldata data
    ) external payable whenNotPaused returns (bytes32 callId) {
        if (!trustedRemotes[destinationChain]) {
            revert UntrustedRemote(destinationChain);
        }

        callId = keccak256(
            abi.encode(msg.sender, target, data, block.timestamp, msg.value)
        );

        // Send message with call data
        bytes32 messageId = this.sendMessage(
            destinationChain,
            address(this),
            abi.encode(callId, target, data)
        );

        emit CrossChainCallCompleted(callId, true);
    }

    // ============ Admin Functions ============

    function setTrustedRemote(
        uint256 chainId,
        address messenger,
        bool trusted
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        trustedRemotes[chainId] = trusted;
        remoteMessengers[chainId] = messenger;

        emit RemoteConfigured(chainId, messenger, trusted);
    }

    function setConfirmationBlocks(
        uint256 blocks
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        CONFIRMATION_BLOCKS = blocks;
    }

    function updateAggregateRoot(
        bytes32 newRoot
    ) external onlyRole(VERIFIER_ROLE) {
        bytes32 old = aggregateRoot;
        aggregateRoot = newRoot;
        emit AggregateRootUpdated(old, newRoot);
    }

    // ============ Internal Functions ============

    function _generateMessageId(
        uint256 sourceChain,
        uint256 destChain,
        address sender,
        address recipient,
        bytes calldata data
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    sourceChain,
                    destChain,
                    sender,
                    recipient,
                    data,
                    block.timestamp,
                    gasleft()
                )
            );
    }

    function _forwardToRemote(bytes32 messageId, uint256 destChain) internal {
        address remote = remoteMessengers[destChain];
        if (remote != address(0)) {
            // In production, this would call the remote messenger
            // RemoteCrossChainMessenger(remote).receiveMessage(messageId, messages[messageId]);
        }
    }

    function _verifyMessageProof(
        bytes32 messageId,
        uint256 sourceChain,
        bytes32[] calldata proof
    ) internal pure {
        // Simplified proof verification
        // In production, implement full fraud proof verification
        if (proof.length == 0 && sourceChain != 0) {
            revert InvalidProof();
        }
    }

    // ============ View Functions ============

    function getMessage(
        bytes32 messageId
    )
        external
        view
        returns (
            uint256 sourceChain,
            uint256 destChain,
            address sender,
            address recipient,
            MessageStatus status,
            uint256 timestamp
        )
    {
        Message storage message = messages[messageId];
        return (
            message.sourceChain,
            message.destinationChain,
            message.sender,
            message.recipient,
            message.status,
            message.timestamp
        );
    }

    function getChainMessages(
        uint256 chainId
    ) external view returns (bytes32[] memory) {
        return chainMessages[chainId];
    }

    function getFailedMessageRetry(
        bytes32 messageId
    ) external view returns (uint256 retries, bytes memory returnData) {
        return (failedMessageRetries[messageId], failedMessageData[messageId]);
    }
}
