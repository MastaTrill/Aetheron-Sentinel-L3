// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPredictiveModel {
    uint256 public trustScore;

    function setTrustScore(uint256 _score) external {
        trustScore = _score;
    }

    function getBehavioralProfile(address) external view returns (uint256, uint256, uint256, uint8, uint256) {
        return (trustScore, 0, 0, 0, 0);
    }
}
