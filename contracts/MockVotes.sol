// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
pragma solidity ^0.8.24;

contract MockVotes is ERC20, ERC20Votes {
    constructor() ERC20("Aetheron Governance Token", "AETX") ERC20Permit("Aetheron Governance Token") {
        _mint(msg.sender, 1000000 * 10**decimals());
    }
    function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }
    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._mint(to, amount);
    }
    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }
}
