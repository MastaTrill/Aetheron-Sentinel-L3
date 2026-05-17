pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AetheronRetainerVault is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable aetxToken;

    constructor(
        address _aetxToken
    ) ERC20("Aetheron Retainer Shares", "vAETX") {
        require(_aetxToken != address(0), "Invalid token");
        aetxToken = IERC20(_aetxToken);
    }

    function deposit(
        uint256 _amount
    ) external nonReentrant returns (uint256 shares) {
        uint256 balanceBefore = aetxToken.balanceOf(address(this));
        aetxToken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 received = aetxToken.balanceOf(address(this)) - balanceBefore;
        require(received > 0, "No tokens received");
        uint256 supply = totalSupply();
        shares = supply == 0 ? received : (received * supply) / balanceBefore;
        _mint(msg.sender, shares);
    }

    function withdraw(
        uint256 _shares
    ) external nonReentrant returns (uint256 amount) {
        require(balanceOf(msg.sender) >= _shares, "Insufficient shares");
        uint256 total = aetxToken.balanceOf(address(this));
        uint256 supply = totalSupply();
        amount = (_shares * total) / supply;
        _burn(msg.sender, _shares);
        aetxToken.safeTransfer(msg.sender, amount);
    }
}
