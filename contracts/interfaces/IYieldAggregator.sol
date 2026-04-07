// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IYieldAggregator
 * @notice Interface for YieldAggregator
 */
interface IYieldAggregator {
    // ============ Deposit/Withdraw ============

    function deposit(
        uint256 _amount,
        bytes32 _sourceId
    ) external returns (uint256 shares);

    function withdraw(
        uint256 _shares
    ) external returns (uint256 amount, uint256 yield);

    // ============ Yield Source Management ============

    function addYieldSource(
        address _protocol,
        address _token,
        uint256 _riskScore,
        address _harvestStrategy
    ) external returns (bytes32 sourceId);

    function removeYieldSource(bytes32 _sourceId) external;

    function rebalanceBetweenSources(
        bytes32 _fromSource,
        bytes32 _toSource,
        uint256 _amount
    ) external;

    // ============ Security ============

    function performSecurityScan(
        address _protocol
    )
        external
        returns (
            address protocol,
            bool isSafe,
            uint256 riskScore,
            uint256 scanTimestamp
        );

    function triggerEmergencyStop() external;

    function resumeOperations() external;

    // ============ View Functions ============

    function getUserPosition(
        address _user
    )
        external
        view
        returns (uint256 deposited, uint256 pendingYield, uint256 totalValue);

    function getAPY(bytes32 _sourceId) external view returns (uint256 apy);

    function getAllActiveSources() external view returns (bytes32[] memory);

    function getTotalValueLocked() external view returns (uint256);
}
