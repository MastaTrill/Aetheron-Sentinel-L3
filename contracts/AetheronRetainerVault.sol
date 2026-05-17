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
        require(_aetxToken != address(0), "Vault: Invalid token");
        aetxToken = IERC20(_aetxToken);
    }

    function deposit(uint256 _amount) external nonReentrant returns (uint256 shares) {
        require(_amount > 0, "Vault: Amount > 0");
        uint256 balanceBefore = aetxToken.balanceOf(address(this));
        aetxToken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 actualReceived = aetxToken.balanceOf(address(this)) - balanceBefore;
        require(actualReceived > 0, "Vault: Tax consumed deposit");
        uint256 totalSupply = totalSupply();
        shares = totalSupply == 0 ? actualReceived : (actualReceived * totalSupply) / balanceBefore;
        _mint(msg.sender, shares);
        emit Deposit(msg.sender, actualReceived, shares);
        return shares;
    }

    function withdraw(uint256 _shares) external nonReentrant returns (uint256 amount) {
        require(_shares > 0 && balanceOf(msg.sender) >= _shares, "Vault: Invalid shares");
        uint256 totalSupply = totalSupply();
        uint256 vaultBalance = aetxToken.balanceOf(address(this));
        amount = (_shares * vaultBalance) / totalSupply;
        require(amount > 0, "Vault: Amount is zero");
        _burn(msg.sender, _shares);
        aetxToken.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, _shares, amount);
        return amount;
    }
}
