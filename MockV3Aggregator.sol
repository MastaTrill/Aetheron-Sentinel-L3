// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MockV3Aggregator
 * @dev Simple mock for Chainlink's AggregatorV3Interface to facilitate unit testing.
 */
contract MockV3Aggregator {
  int256 private s_answer;
  uint256 private s_updatedAt;

  constructor(int256 initialAnswer) {
    updateAnswer(initialAnswer);
  }

  function updateAnswer(int256 newAnswer) public {
    s_answer = newAnswer;
    s_updatedAt = block.timestamp;
  }

  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    // Returns dummy values for round metadata and the actual mock answer
    return (1, s_answer, s_updatedAt, s_updatedAt, 1);
  }
}
