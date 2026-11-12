// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Draft ERC20 for factory integration review; no post-construction minting.
/// @dev No owner, proxy, pause, blacklist, or privileged mint functions.
contract SentinelFixedSupply {
    string public constant name = "SENTINEL";
    string public constant symbol = "SENTINEL";
    uint8 public constant decimals = 18;
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10 ** 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error ZeroRecipient();
    error InsufficientBalance();
    error InsufficientAllowance();

    constructor(address recipient) {
        if (recipient == address(0)) revert ZeroRecipient();
        totalSupply = INITIAL_SUPPLY;
        balanceOf[recipient] = INITIAL_SUPPLY;
        emit Transfer(address(0), recipient, INITIAL_SUPPLY);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            unchecked { allowance[from][msg.sender] = allowed - amount; }
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroRecipient();
        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientBalance();
        unchecked { balanceOf[from] = balance - amount; }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
