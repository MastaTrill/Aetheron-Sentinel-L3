// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPriceOracle
 * @notice Interface for price oracle
 */
interface IPriceOracle {
    /**
     * @notice Get price allowing stale prices
     * @param asset Token address
     * @return price Current price
     * @return isStale Whether price is stale
     */
    function getPriceAllowStale(address asset) external view returns (uint256 price, bool isStale);
}