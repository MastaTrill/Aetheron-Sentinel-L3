// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SentinelLiquidityPool
 * @notice Automated liquidity pool for SENTINEL/ETH pairs with fee collection
 * and protocol-owned liquidity management for the Sentinel L3 ecosystem.
 */
contract SentinelLiquidityPool is Ownable, ReentrancyGuard {
    IERC20 public immutable sentinelToken;

    uint256 public totalSentinelReserve;
    uint256 public totalEthReserve;
    uint256 public totalLPShares;
    uint256 public constant SWAP_FEE_BPS = 30; // 0.30% fee
    uint256 public constant BPS = 10000;

    mapping(address => uint256) public lpShares;
    uint256 public protocolFeesCollected;

    event LiquidityAdded(address indexed provider, uint256 sentinelAmount, uint256 ethAmount, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 sentinelAmount, uint256 ethAmount, uint256 shares);
    event Swap(address indexed trader, bool sentinelIn, uint256 amountIn, uint256 amountOut, uint256 fee);

    constructor(address _sentinelToken, address initialOwner) Ownable(initialOwner) {
        require(_sentinelToken != address(0), "Zero token address");
        sentinelToken = IERC20(_sentinelToken);
    }

    /**
     * @notice Add SENTINEL + ETH liquidity and receive LP shares
     */
    function addLiquidity(uint256 sentinelAmount) external payable nonReentrant {
        require(sentinelAmount > 0 && msg.value > 0, "Zero amounts");

        uint256 shares;
        if (totalLPShares == 0) {
            shares = sentinelAmount;
        } else {
            shares = (sentinelAmount * totalLPShares) / totalSentinelReserve;
        }

        sentinelToken.transferFrom(msg.sender, address(this), sentinelAmount);
        totalSentinelReserve += sentinelAmount;
        totalEthReserve += msg.value;
        totalLPShares += shares;
        lpShares[msg.sender] += shares;

        emit LiquidityAdded(msg.sender, sentinelAmount, msg.value, shares);
    }

    /**
     * @notice Remove liquidity by burning LP shares
     */
    function removeLiquidity(uint256 shares) external nonReentrant {
        require(shares > 0 && lpShares[msg.sender] >= shares, "Insufficient shares");

        uint256 sentinelOut = (shares * totalSentinelReserve) / totalLPShares;
        uint256 ethOut = (shares * totalEthReserve) / totalLPShares;

        lpShares[msg.sender] -= shares;
        totalLPShares -= shares;
        totalSentinelReserve -= sentinelOut;
        totalEthReserve -= ethOut;

        sentinelToken.transfer(msg.sender, sentinelOut);
        (bool ok, ) = msg.sender.call{value: ethOut}("");
        require(ok, "ETH transfer failed");

        emit LiquidityRemoved(msg.sender, sentinelOut, ethOut, shares);
    }

    /**
     * @notice Swap ETH → SENTINEL using constant product formula with fee
     */
    function swapEthForSentinel() external payable nonReentrant {
        require(msg.value > 0, "Zero ETH");
        require(totalEthReserve > 0 && totalSentinelReserve > 0, "No liquidity");

        uint256 fee = (msg.value * SWAP_FEE_BPS) / BPS;
        uint256 ethIn = msg.value - fee;
        protocolFeesCollected += fee;

        uint256 sentinelOut = (ethIn * totalSentinelReserve) / (totalEthReserve + ethIn);
        totalEthReserve += msg.value;
        totalSentinelReserve -= sentinelOut;

        sentinelToken.transfer(msg.sender, sentinelOut);
        emit Swap(msg.sender, false, msg.value, sentinelOut, fee);
    }

    function getReserves() external view returns (uint256 sentinel, uint256 eth) {
        return (totalSentinelReserve, totalEthReserve);
    }

    receive() external payable {}
}
