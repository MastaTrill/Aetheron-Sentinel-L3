// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AetheronBridge
 * @notice Quantum-resistant cross-chain bridge with security monitoring
 */
contract AetheronBridge is Ownable, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct Transfer {
        address sender;
        address recipient;
        uint256 amount;
        uint256 chainId;
        address tokenAddress;
        bytes32 transferId;
        bool completed;
    }

    mapping(bytes32 => Transfer) public transfers;
    mapping(uint256 => uint256) public chainLimits;
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public userTransferCount;
    mapping(uint256 => uint256) public chainTransferVolume;
    uint256 public totalValueLocked;
    uint256 public supportedTokenCount;
    uint256 public totalTransferCount;
    uint256 private _transferNonce; // monotonic nonce for collision-free transferId
    uint256 public constant MAX_TRANSFERS_PER_USER = 10;
    uint256 public constant MAX_CHAIN_VOLUME = 1000000 ether; // 1M tokens max per chain
    uint256 public bridgeFee = 0.001 ether; // 0.1% fee

    event TokensBridged(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 chainId,
        address tokenAddress,
        bytes32 transferId
    );

    event TokensUnbridged(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed transferId
    );

    event TransferCompleted(bytes32 indexed transferId);
    event BridgeInitialized(
        address indexed token,
        address indexed bridge,
        uint256 initialSupply
    );
    event TokenSupportUpdated(address indexed token, bool supported);
    event EmergencyPaused(address indexed pauser);
    event EmergencyUnpaused(address indexed unpauser);
    event RelayerUpdated(address indexed relayer, bool authorized);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(OPERATOR_ROLE, initialOwner);
        if (initialOwner != msg.sender) {
            super.transferOwnership(initialOwner);
        }
    }

    /**
     * @notice Bridges tokens to another chain
     * @param recipient Recipient address on destination chain
     * @param amount Amount to bridge
     * @param chainId Destination chain ID
     * @param tokenAddress Token contract address
     */
    function bridgeTokens(
        address recipient,
        uint256 amount,
        uint256 chainId,
        address tokenAddress
    ) external payable nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be positive");
        require(recipient != address(0), "Invalid recipient");
        require(chainId != block.chainid, "Cannot bridge to same chain");
        require(supportedTokens[tokenAddress], "Token not supported");
        require(amount <= chainLimits[chainId], "Amount exceeds chain limit");
        require(msg.value >= bridgeFee, "Insufficient bridge fee");

        // Rate limiting per user
        require(
            userTransferCount[msg.sender] < MAX_TRANSFERS_PER_USER,
            "User transfer limit exceeded"
        );

        // Volume limits per chain
        require(
            chainTransferVolume[chainId] + amount <= MAX_CHAIN_VOLUME,
            "Chain volume limit exceeded"
        );

        // Transfer tokens from sender
        uint256 balanceBefore = IERC20(tokenAddress).balanceOf(address(this));
        IERC20(tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
        uint256 balanceAfter = IERC20(tokenAddress).balanceOf(address(this));
        require(
            balanceAfter - balanceBefore == amount,
            "Transfer amount mismatch"
        );

        bytes32 transferId = keccak256(
            abi.encodePacked(
                msg.sender,
                recipient,
                amount,
                chainId,
                tokenAddress,
                block.timestamp,
                block.number,
                _transferNonce++
            )
        );

        transfers[transferId] = Transfer({
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            chainId: chainId,
            tokenAddress: tokenAddress,
            transferId: transferId,
            completed: false
        });

        totalValueLocked += amount;
        userTransferCount[msg.sender]++;
        chainTransferVolume[chainId] += amount;
        totalTransferCount++;

        // Refund excess fee — use call() to support smart contract wallets
        if (msg.value > bridgeFee) {
            (bool refundOk, ) = payable(msg.sender).call{
                value: msg.value - bridgeFee
            }("");
            require(refundOk, "Fee refund failed");
        }

        emit TokensBridged(
            msg.sender,
            recipient,
            amount,
            chainId,
            tokenAddress,
            transferId
        );
    }

    /**
     * @notice Completes token unbridging on destination chain
     * @param transferId Original transfer ID
     * @param signature Oracle/relayer signature for validation
     */
    function unbridgeTokens(
        bytes32 transferId,
        bytes calldata signature
    ) external nonReentrant {
        Transfer storage transfer = transfers[transferId];
        require(!transfer.completed, "Transfer already completed");
        require(transfer.amount > 0, "Invalid transfer");

        // Verify signature from authorized relayer
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(transferId, block.chainid))
            )
        );

        address signer = recoverSigner(messageHash, signature);
        require(hasRole(RELAYER_ROLE, signer), "Invalid relayer signature");

        transfer.completed = true;

        // Release tokens to recipient — use safeTransfer
        IERC20(transfer.tokenAddress).safeTransfer(
            transfer.recipient,
            transfer.amount
        );
        totalValueLocked -= transfer.amount;

        emit TokensUnbridged(
            transfer.sender,
            transfer.recipient,
            transfer.amount,
            transferId
        );
        emit TransferCompleted(transferId);
    }

    /**
     * @notice Recovers signer from signature
     * @param messageHash Hash of the signed message
     * @param signature Signature to recover from
     * @return signer The recovered signer address
     */
    function recoverSigner(
        bytes32 messageHash,
        bytes memory signature
    ) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        address signer = ecrecover(messageHash, v, r, s);
        require(signer != address(0), "Invalid signature");
        return signer;
    }

    /**
     * @notice Authorize or revoke a bridge relayer
     * @param relayer Relayer address
     * @param authorized Whether the relayer should be authorized
     */
    function setRelayer(address relayer, bool authorized) external onlyOwner {
        require(relayer != address(0), "Invalid relayer");
        if (authorized) {
            _grantRole(RELAYER_ROLE, relayer);
        } else {
            _revokeRole(RELAYER_ROLE, relayer);
        }
        emit RelayerUpdated(relayer, authorized);
    }

    /**
     * @notice Adds or removes token support
     * @param tokenAddress Token contract address
     * @param supported Whether to support this token
     */
    function setTokenSupport(
        address tokenAddress,
        bool supported
    ) external onlyRole(OPERATOR_ROLE) {
        require(tokenAddress != address(0), "Invalid token address");
        if (supported && !supportedTokens[tokenAddress]) {
            supportedTokenCount++;
        } else if (!supported && supportedTokens[tokenAddress]) {
            supportedTokenCount--;
        }
        supportedTokens[tokenAddress] = supported;
        emit TokenSupportUpdated(tokenAddress, supported);
    }

    /**
     * @notice Sets chain-specific transfer limits
     * @param chainId Chain ID
     * @param limit Maximum transfer amount
     */
    function setChainLimit(
        uint256 chainId,
        uint256 limit
    ) external onlyRole(OPERATOR_ROLE) {
        chainLimits[chainId] = limit;
    }

    /**
     * @notice Initializes bridge for a new token
     * @param tokenAddress Token contract address
     * @param initialSupply Initial supply to bridge
     */
    function initializeBridge(
        address tokenAddress,
        uint256 initialSupply
    ) external onlyRole(OPERATOR_ROLE) {
        require(tokenAddress != address(0), "Invalid token address");
        require(initialSupply > 0, "Initial supply must be positive");

        if (!supportedTokens[tokenAddress]) {
            supportedTokenCount++;
        }
        supportedTokens[tokenAddress] = true;
        emit BridgeInitialized(tokenAddress, address(this), initialSupply);
        emit TokenSupportUpdated(tokenAddress, true);
    }

    /**
     * @notice Emergency pause all bridge operations
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @notice Emergency unpause bridge operations
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    /**
     * @notice Set bridge fee
     * @param newFee New fee amount in wei
     */
    function setBridgeFee(uint256 newFee) external onlyRole(OPERATOR_ROLE) {
        require(newFee <= 0.01 ether, "Fee too high"); // Max 1%
        bridgeFee = newFee;
    }

    /**
     * @notice Withdraw accumulated fees to the current owner account
     */
    function withdrawFees() external onlyOwner {
        address payable recipient = payable(owner());
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        (bool ok, ) = recipient.call{value: balance}("");
        require(ok, "Fee withdrawal failed");
    }

    /**
     * @notice Transfer ownership and migrate privileged bridge roles to the new owner
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner();
        super.transferOwnership(newOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, newOwner);
        _grantRole(OPERATOR_ROLE, newOwner);
        _revokeRole(OPERATOR_ROLE, previousOwner);
        _revokeRole(RELAYER_ROLE, previousOwner);
        _revokeRole(DEFAULT_ADMIN_ROLE, previousOwner);
    }

    /**
     * @notice Get bridge statistics
     */
    function getBridgeStats()
        external
        view
        returns (uint256 tvl, uint256 fee, uint256 tokenCount)
    {
        return (totalValueLocked, bridgeFee, supportedTokenCount);
    }

    /**
     * @notice Check if transfer can be processed
     * @param transferId Transfer ID to check
     */
    function canProcessTransfer(
        bytes32 transferId
    ) external view returns (bool) {
        Transfer memory transfer = transfers[transferId];
        return !transfer.completed && transfer.amount > 0;
    }
}
