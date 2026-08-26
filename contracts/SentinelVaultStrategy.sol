// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SentinelVaultStrategy
 * @notice Cross-chain yield optimization vault strategy contract.
 */
contract SentinelVaultStrategy is Ownable {
    IERC20 public immutable stakingToken;
    uint256 public totalVaultSupply;
    mapping(address => uint256) public userShares;

    struct StrategyAllocation {
        address strategyAddress;
        uint256 allocationBps; // Basis points (100 = 1%)
        bool isActive;
    }

    mapping(uint256 => StrategyAllocation) public strategies;
    uint256 public strategyCount;

    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted);
    event Withdrawn(address indexed user, uint256 amount, uint256 sharesBurned);
    event StrategyRebalanced(uint256 indexed strategyId, address strategyAddress, uint256 allocationBps);

    constructor(address _stakingToken, address initialOwner) Ownable(initialOwner) {
        require(_stakingToken != address(0), "Zero token address");
        stakingToken = IERC20(_stakingToken);
    }

    /**
     * @notice Deposit tokens into the yield strategy vault
     */
    function deposit(uint256 amount) external returns (uint256 shares) {
        require(amount > 0, "Zero deposit amount");

        uint256 totalPool = stakingToken.balanceOf(address(this));
        if (totalVaultSupply == 0 || totalPool == 0) {
            shares = amount;
        } else {
            shares = (amount * totalVaultSupply) / totalPool;
        }

        require(stakingToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        userShares[msg.sender] += shares;
        totalVaultSupply += shares;

        emit Deposited(msg.sender, amount, shares);
        return shares;
    }

    /**
     * @notice Withdraw tokens from the vault
     */
    function withdraw(uint256 shares) external returns (uint256 amount) {
        require(shares > 0, "Zero withdraw shares");
        require(userShares[msg.sender] >= shares, "Insufficient share balance");

        uint256 totalPool = stakingToken.balanceOf(address(this));
        amount = (shares * totalPool) / totalVaultSupply;

        userShares[msg.sender] -= shares;
        totalVaultSupply -= shares;

        require(stakingToken.transfer(msg.sender, amount), "Transfer failed");

        emit Withdrawn(msg.sender, amount, shares);
        return amount;
    }

    /**
     * @notice Rebalance strategy allocations
     */
    function rebalanceStrategy(uint256 strategyId, address strategyAddress, uint256 allocationBps) external onlyOwner {
        require(strategyAddress != address(0), "Zero strategy address");
        require(allocationBps <= 10000, "Allocation exceeds 100%");

        strategies[strategyId] = StrategyAllocation({
            strategyAddress: strategyAddress,
            allocationBps: allocationBps,
            isActive: true
        });

        if (strategyId >= strategyCount) {
            strategyCount = strategyId + 1;
        }

        emit StrategyRebalanced(strategyId, strategyAddress, allocationBps);
    }
}
