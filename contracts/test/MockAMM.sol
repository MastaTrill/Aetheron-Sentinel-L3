// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockAMM {
    IERC20 public token;
    uint256 public ethReserve = 100 ether;
    uint256 public tokenReserve = 100000 ether;
    constructor(address _token) { token = IERC20(_token); }
    function getETHPrice() external view returns (uint256) { return (tokenReserve * 1e6) / ethReserve; }
    function swap(uint256 amount, bool buyETH) external payable returns (uint256) {
        if (buyETH) {
            token.transferFrom(msg.sender, address(this), amount);
            uint256 out = (amount * ethReserve) / (tokenReserve + amount);
            tokenReserve += amount; ethReserve -= out;
            payable(msg.sender).transfer(out);
            return out;
        } else {
            uint256 out = (amount * tokenReserve) / (ethReserve + amount);
            ethReserve += amount; tokenReserve -= out;
            token.transfer(msg.sender, out);
            return out;
        }
    }
    receive() external payable {}
}