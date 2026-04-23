// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract VRFConsumerBase {
    function requestRandomness(
        bytes32 keyHash,
        uint256 fee
    ) internal virtual returns (bytes32 requestId);

    function fulfillRandomness(
        bytes32 requestId,
        uint256 randomness
    ) internal virtual;
}

abstract contract Lottery is VRFConsumerBase {
    address[] public players;
    uint256 public randomResult;

    function pickWinner() public returns (bytes32) {
        // Replacing block.timestamp with secure Chainlink VRF request
        return requestRandomness(bytes32(uint256(0xabc123)), 0.1 * 10 ** 18);
    }

    function fulfillRandomness(
        bytes32 /* requestId */,
        uint256 randomness
    ) internal override {
        randomResult = randomness;
    }

    function getWinner() public view returns (address) {
        require(randomResult > 0, "Randomness not fulfilled");
        uint256 index = randomResult % players.length;
        return players[index];
    }
}
