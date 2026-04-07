// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IKeeperNetwork
 * @notice Interface for KeeperNetwork
 */
interface IKeeperNetwork {
    enum TaskType {
        Custom,
        Compound,
        Rebalance,
        Liquidate,
        Swap,
        Harvest
    }
    enum TaskStatus {
        Pending,
        Executing,
        Completed,
        Failed,
        Cancelled,
        Expired
    }
    enum Priority {
        Low,
        Medium,
        High,
        Critical
    }
    enum KeeperTier {
        Bronze,
        Silver,
        Gold,
        Platinum
    }

    // ============ Keeper Management ============

    function registerKeeper(uint256 _bondAmount) external returns (bool);

    function activateKeeper() external;

    function deactivateKeeper() external;

    function bondExtra(uint256 _amount) external;

    function claimRewards() external;

    // ============ Task Management ============

    function createTask(
        address _target,
        bytes calldata _callData,
        uint256 _value,
        uint256 _gasLimit,
        uint256 _reward,
        uint256 _executeBefore,
        TaskType _taskType,
        Priority _priority,
        KeeperTier _minTier,
        bool _requireBonded
    ) external payable returns (uint256 taskId);

    function createCompoundTask(
        address _yieldPool,
        bytes calldata _callData,
        uint256 _executeBefore,
        Priority _priority
    ) external payable returns (uint256 taskId);

    function executeTask(uint256 _taskId) external returns (bool success);

    function cancelTask(uint256 _taskId) external;

    // ============ View Functions ============

    function getKeeperInfo(
        address _keeper
    )
        external
        view
        returns (
            uint256 bondedAmount,
            uint256 earnedRewards,
            uint256 totalExecutions,
            uint256 successfulExecutions,
            bool isActive,
            KeeperTier tier,
            uint256 reputation
        );

    function getTaskInfo(
        uint256 _taskId
    )
        external
        view
        returns (
            address caller,
            address target,
            uint256 reward,
            uint256 fee,
            uint256 executeBefore,
            TaskType taskType,
            TaskStatus status,
            Priority priority
        );

    function getPendingTasks(
        Priority _minPriority,
        KeeperTier _minTier
    ) external view returns (uint256[] memory);

    function getNetworkStats()
        external
        view
        returns (
            uint256 totalBonded,
            uint256 activeKeepers,
            uint256 pendingTasks,
            uint256 totalExecutions,
            uint256 totalRewards
        );
}
