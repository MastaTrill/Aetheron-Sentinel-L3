// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library SafeMathV2 {
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }
}

contract Staking {
    using SafeMathV2 for uint256;
    mapping(address => uint256) public balances;
    uint256 public rewardRate = 100;

    function calculateReward(address account) public view returns (uint256) {
        return balances[account].mul(rewardRate);
    }
}
