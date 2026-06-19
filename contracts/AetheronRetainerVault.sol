// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AetheronRetainerVault
 * @dev Handles specialized retention taxes and protocol fees for Sentinel L3.
 * This version contains the "logic knot" regarding flat minimum fees and percentage taxes.
 */

interface ISentinelCoreLoop {
    function s_anomalyWindow() external view returns (uint64);
    function s_maxAnomalyWindow() external view returns (uint64);
    function s_quantumGuard() external view returns (address);
}

interface ISentinelQuantumGuard {
    function isFrozen() external view returns (bool);
}

contract AetheronRetainerVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable s_sentinelToken;
    ISentinelCoreLoop public s_coreLoop;

    bool public s_emergencyExitActive;
    uint256 public s_taxRate = 500; // 5% (bps)
    uint256 public s_retentionRate = 1000; // 10% (bps)
    uint256 public s_minProtocolFee = 1e18; // 1 Token flat minimum
    uint256 public s_retentionPeriod = 7 days;

    mapping(address => uint256) public s_balances;
    mapping(address => uint256) public s_depositTimestamps;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 fee);
    event EmergencyExitToggled(bool active);
    event CoreLoopUpdated(address indexed newCoreLoop);

    error SentinelVault__WithdrawAmountTooSmall();
    error SentinelVault__SecurityLayerFrozen();

    constructor(address initialOwner, address token) Ownable(initialOwner) {
        s_sentinelToken = IERC20(token);
    }

    /**
     * @notice Deposit tokens into the vault.
     * @param amount The amount of Sentinel tokens to deposit.
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount zero");
        s_balances[msg.sender] += amount;
        s_depositTimestamps[msg.sender] = block.timestamp;
        s_sentinelToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw tokens with tax and retention logic.
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(s_balances[msg.sender] >= amount, "Insufficient balance");

        // Security Link: Check if the CoreLoop's guard is frozen
        if (address(s_coreLoop) != address(0)) {
            address guard = s_coreLoop.s_quantumGuard();
            if (guard != address(0)) {
                try ISentinelQuantumGuard(guard).isFrozen() returns (bool frozen) {
                    if (frozen) revert SentinelVault__SecurityLayerFrozen();
                } catch { revert SentinelVault__SecurityLayerFrozen(); }
            }
        }

        uint256 tax = (amount * s_taxRate) / 10000;
        uint256 retentionFee = 0;

        // Apply retention fee if withdrawn before the period ends
        if (block.timestamp < s_depositTimestamps[msg.sender] + s_retentionPeriod) {
            retentionFee = (amount * s_retentionRate) / 10000;
        }

        // Apply flat minimum fee logic
        uint256 totalFees = tax + retentionFee;
        if (totalFees < s_minProtocolFee) {
            totalFees = s_minProtocolFee;
        }

        // Fix: Explicitly check for fee coverage to prevent Panic/Underflow
        if (amount <= totalFees) revert SentinelVault__WithdrawAmountTooSmall();

        uint256 netAmount = amount - totalFees;

        s_balances[msg.sender] -= amount;
        s_sentinelToken.safeTransfer(msg.sender, netAmount);
        s_sentinelToken.safeTransfer(owner(), totalFees);

        emit Withdrawn(msg.sender, amount, totalFees);
    }

    // Administrative functions
    function setTaxRate(uint256 newRate) external onlyOwner {
        require(newRate <= 2000, "Tax too high");
        s_taxRate = newRate;
    }

    function setCoreLoop(address coreLoop) external onlyOwner {
        s_coreLoop = ISentinelCoreLoop(coreLoop);
        emit CoreLoopUpdated(coreLoop);
    }

    function setMinProtocolFee(uint256 newMin) external onlyOwner {
        s_minProtocolFee = newMin;
    }

    function toggleEmergencyExit(bool active) external onlyOwner {
        s_emergencyExitActive = active;
        emit EmergencyExitToggled(active);
    }

    /**
     * @dev Rescue function for the "Logic Knot" if users are stuck.
     */
    function emergencyExit() external {
        require(s_emergencyExitActive, "Emergency exit not active");
        uint256 amount = s_balances[msg.sender];
        s_balances[msg.sender] = 0;
        s_sentinelToken.safeTransfer(msg.sender, amount);
    }
}