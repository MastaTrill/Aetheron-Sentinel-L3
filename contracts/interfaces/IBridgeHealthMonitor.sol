// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBridgeHealthMonitor
 * @notice Interface for BridgeHealthMonitor
 */
interface IBridgeHealthMonitor {
    enum AnomalyType {
        HighLatency,
        LowLiquidity,
        UnusualVolume,
        FailedTransactions,
        PriceDeviation,
        SuspiciousActivity,
        BridgeOffline,
        SecurityBreach
    }

    // ============ Bridge Management ============

    function registerBridge(
        address _bridgeAddress,
        string calldata _name,
        uint256 _chainId
    ) external;

    function deactivateBridge(address _bridge) external;

    function reactivateBridge(address _bridge) external;

    // ============ Metrics ============

    function updateBridgeMetrics(
        address _bridge,
        uint256 _volume,
        uint256 _txCount,
        bool _success
    ) external;

    function recordTransaction(
        bytes32 _txHash,
        address _bridge,
        address _user,
        uint256 _amount,
        uint256 _latency,
        uint256 _gasUsed,
        uint256 _gasPrice
    ) external;

    // ============ Health ============

    function updateHealthScore(address _bridge) external;

    function resolveAnomaly(uint256 _anomalyId) external;

    // ============ View Functions ============

    function getDashboardData(
        address _bridge
    )
        external
        view
        returns (
            string memory name,
            uint256 chainId,
            bool isActive,
            uint256 healthScore,
            uint256 totalVolume,
            uint256 totalTransactions,
            uint256 avgLatency,
            uint256 unresolvedAnomalies
        );

    function getAllBridgeStats()
        external
        view
        returns (
            uint256 totalVol,
            uint256 totalTxs,
            uint256 avgLatency,
            uint256 totalBridges,
            uint256 healthyBridges,
            uint256 unresolvedAnomaliesTotal
        );
}
