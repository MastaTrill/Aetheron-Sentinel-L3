// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../../SentinelCoreLoop.sol";
import "./MockAMM.sol";

contract MockYieldMaximizerWithAMM is ISentinelYieldMaximizer {
    MockAMM public amm;
    IERC20 public token;
    uint256 public lastSlippage;
    uint256 public s_slippageToleranceBps = 100; // Default 1%

    error MockYieldMaximizer__SlippageExceeded(uint256 expected, uint256 received);

    constructor(address _amm, address _token) { amm = MockAMM(payable(_amm)); token = IERC20(_token); }

    /**
     * @notice Updates the allowed slippage for rebalancing.
     * @param bps Slippage in basis points (100 = 1%).
     */
    function setSlippageTolerance(uint256 bps) external {
        s_slippageToleranceBps = bps;
    }

    function executeOptimization() external {
        uint256 amount = 500 * 1e18;

        // Calculate expected output based on current AMM price to protect against sandwich attacks
        uint256 price = amm.getETHPrice();
        uint256 expectedOut = (amount * 1e6) / price;
        uint256 minOut = (expectedOut * (10000 - s_slippageToleranceBps)) / 10000;

        token.approve(address(amm), amount);
        uint256 received = amm.swap(amount, true);

        if (received < minOut) {
            revert MockYieldMaximizer__SlippageExceeded(minOut, received);
        }

        lastSlippage = ((expectedOut - received) * 100) / expectedOut;
    }
}