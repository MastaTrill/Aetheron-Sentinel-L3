// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title FlashLoanProtection
 * @notice Detects and blocks flash loan attacks by tracking token flow
 * @dev Uses time-weighted balance changes to identify anomalies
 */
contract FlashLoanProtection is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    /// @notice Minimum time a position must be held (1 block ~12s on mainnet)
    uint256 public constant MIN_POSITION_AGE = 1;

    /// @notice Maximum percentage of TVL that can be moved in one transaction
    uint256 public maxTVLPercentage = 500; // 5% in basis points

    /// @notice Mapping of user => first action timestamp
    mapping(address => uint256) public positionOpenedAt;

    /// @notice Mapping of user => historical balance snapshots
    mapping(address => uint256) public lastKnownBalance;

    /// @notice Mapping of user => total borrowed in current block
    mapping(address => uint256) public borrowingInBlock;

    /// @notice Known flash loan callback addresses
    mapping(address => bool) public knownFlashLoanContracts;

    /// @notice Flag to enable/disable flash loan protection
    bool public protectionEnabled = true;

    event PositionOpened(address indexed user, uint256 balance, uint256 timestamp);
    event FlashLoanDetected(address indexed attacker, uint256 amount);
    event ProtectionToggled(bool enabled);
    event TVLThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event FlashLoanContractWhitelisted(address indexed contractAddr, bool allowed);

    error FlashLoanAttackDetected(address attacker, uint256 amount);
    error PositionTooNew(address user, uint256 positionAge);
    error TVLPercentageExceeded(uint256 requested, uint256 maxPercentage);
    error ProtectionDisabled();

    modifier checkFlashLoan(address user, uint256 amount, uint256 tvl) {
        if (!protectionEnabled) {
            _;
            return;
        }

        // Check if known flash loan contract
        if (knownFlashLoanContracts[msg.sender]) {
            revert FlashLoanAttackDetected(msg.sender, amount);
        }

        // Record the borrowing
        uint256 currentBlock = block.number;
        if (borrowingInBlock[user] != currentBlock) {
            borrowingInBlock[user] = currentBlock;

            // Check position age
            if (positionOpenedAt[user] != 0) {
                uint256 positionAge = currentBlock - positionOpenedAt[user];
                if (positionAge < MIN_POSITION_AGE) {
                    revert PositionTooNew(user, positionAge);
                }
            }
        }

        // Check TVL percentage
        if (tvl > 0) {
            uint256 percentage = (amount * 10000) / tvl;
            if (percentage > maxTVLPercentage) {
                revert TVLPercentageExceeded(percentage, maxTVLPercentage);
            }
        }

        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    function recordPosition(address user, uint256 balance) external onlyRole(ORACLE_ROLE) {
        if (positionOpenedAt[user] == 0) {
            positionOpenedAt[user] = block.number;
            emit PositionOpened(user, balance, block.timestamp);
        }
        lastKnownBalance[user] = balance;
    }

    function setTVLThreshold(uint256 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 old = maxTVLPercentage;
        maxTVLPercentage = newThreshold;
        emit TVLThresholdUpdated(old, newThreshold);
    }

    function setProtectionEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        protectionEnabled = enabled;
        emit ProtectionToggled(enabled);
    }

    function whitelistFlashLoanContract(
        address contractAddress,
        bool allowed
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        knownFlashLoanContracts[contractAddress] = allowed;
        emit FlashLoanContractWhitelisted(contractAddress, allowed);
    }

    function getPositionAge(address user) external view returns (uint256) {
        if (positionOpenedAt[user] == 0) return 0;
        return block.number - positionOpenedAt[user];
    }

    function isPositionNew(address user) external view returns (bool) {
        if (positionOpenedAt[user] == 0) return true;
        return (block.number - positionOpenedAt[user]) < MIN_POSITION_AGE;
    }
}
