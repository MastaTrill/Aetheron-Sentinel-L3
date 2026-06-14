// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract ProverGasStation is Ownable {
    IERC20 public echoToken;
    ISwapRouter public swapRouter;

    address public proverAddress;
    uint256 public constant MIN_PROVER_BALANCE = 0.5 ether; 
    uint256 public constant TARGET_PROVER_BALANCE = 2.0 ether; 

    event ProverFunded(address indexed prover, uint256 amountFunded);
    event EchoSwappedForGas(uint256 echoAmountIn, uint256 ethAmountOut);

    constructor(address _echoToken, address _swapRouter, address _proverAddress) {
        echoToken = IERC20(_echoToken);
        swapRouter = ISwapRouter(_swapRouter);
        proverAddress = _proverAddress;
    }

    function topUpProver() external {
        uint256 currentBalance = proverAddress.balance;
        require(currentBalance < MIN_PROVER_BALANCE, "Prover has sufficient gas");

        uint256 amountNeeded = TARGET_PROVER_BALANCE - currentBalance;

        if (address(this).balance < amountNeeded) {
            _swapEchoForEth(amountNeeded - address(this).balance);
        }

        (bool success, ) = proverAddress.call{value: amountNeeded}("");
        require(success, "ETH transfer to Prover failed");

        emit ProverFunded(proverAddress, amountNeeded);
    }

    function _swapEchoForEth(uint256 minimumEthRequired) internal {
        uint256 echoToSwap = 10000 * 10**18; 

        echoToken.approve(address(swapRouter), echoToSwap);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(echoToken),
            tokenOut: swapRouter.WETH9(),
            fee: 3000, 
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: echoToSwap,
            amountOutMinimum: minimumEthRequired,
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = swapRouter.exactInputSingle(params);
        emit EchoSwappedForGas(echoToSwap, amountOut);
    }

    receive() external payable {}
}
