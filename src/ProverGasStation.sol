// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract ProverGasStation is Ownable {
    IERC20 public immutable echoToken;
    ISwapRouter public immutable swapRouter;
    address public immutable wrappedNativeToken;

    address public proverAddress;
    uint256 public constant MIN_PROVER_BALANCE = 0.5 ether;
    uint256 public constant TARGET_PROVER_BALANCE = 2 ether;

    event ProverFunded(address indexed prover, uint256 amountFunded);
    event EchoSwappedForGas(uint256 echoAmountIn, uint256 ethAmountOut);

    constructor(
        address _echoToken,
        address _swapRouter,
        address _wrappedNativeToken,
        address _proverAddress
    ) Ownable(msg.sender) {
        require(_echoToken != address(0), "Invalid ECHO token");
        require(_swapRouter != address(0), "Invalid swap router");
        require(_wrappedNativeToken != address(0), "Invalid wrapped native token");
        require(_proverAddress != address(0), "Invalid prover");

        echoToken = IERC20(_echoToken);
        swapRouter = ISwapRouter(_swapRouter);
        wrappedNativeToken = _wrappedNativeToken;
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
        uint256 echoToSwap = 10_000 * 10 ** 18;

        require(echoToken.approve(address(swapRouter), echoToSwap), "ECHO approval failed");

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(echoToken),
            tokenOut: wrappedNativeToken,
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
