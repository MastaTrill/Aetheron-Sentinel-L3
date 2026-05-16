// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AetheronRetainerVault is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable aetxToken;

    event Deposit(address indexed user, uint256 amountReceived, uint256 sharesMinted);
    event Withdraw(address indexed user, uint256 sharesBurned, uint256 amountReturned);

    constructor(address _aetxToken) ERC20("Aetheron Retainer Shares", "vAETX") {
        require(_aetxToken != address(0), "Vault: Invalid token address");
        aetxToken = IERC20(_aetxToken);
    }

    function deposit(uint256 _amount) external nonReentrant returns (uint256 shares) {
        require(_amount > 0, "Vault: Amount must be greater than 0");

        uint256 balanceBefore = aetxToken.balanceOf(address(this));
        aetxToken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 balanceAfter = aetxToken.balanceOf(address(this));

        uint256 actualReceived = balanceAfter - balanceBefore;
        require(actualReceived > 0, "Vault: Tax consumed entire deposit");

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            shares = actualReceived;
        } else {
            shares = (actualReceived * _totalSupply) / balanceBefore;
        }

        _mint(msg.sender, shares);
        emit Deposit(msg.sender, actualReceived, shares);
        return shares;
    }

    function withdraw(uint256 _shares) external nonReentrant returns (uint256 amount) {
        require(_shares > 0, "Vault: Shares must be greater than 0");
        require(balanceOf(msg.sender) >= _shares, "Vault: Insufficient shares");

        uint256 _totalSupply = totalSupply();
        uint256 vaultBalance = aetxToken.balanceOf(address(this));

        amount = (_shares * vaultBalance) / _totalSupply;
        require(amount > 0, "Vault: Calculated amount is zero");

        _burn(msg.sender, _shares);
        aetxToken.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, _shares, amount);
        return amount;
    }
}
