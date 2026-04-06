// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITimeLockVault
 * @notice Interface for TimeLockVault treasury management
 */
interface ITimeLockVault {
    // ============ Vesting Schedules ============

    struct VestingScheduleInfo {
        uint256 totalAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 duration;
        uint256 released;
        bool revocable;
        bool revoked;
        uint256 vested;
    }

    function createVestingSchedule(
        uint256 _totalAmount,
        uint256 _startTime,
        uint256 _cliffDuration,
        uint256 _duration,
        bool _revocable,
        address[] calldata _beneficiaries
    ) external returns (bytes32 scheduleId);

    function depositToSchedule(bytes32 _scheduleId, uint256 _amount) external;

    // ============ Claiming ============

    function claim(address _beneficiary) external returns (uint256 amount);

    function claimable(address _beneficiary) external view returns (uint256);

    // ============ Emergency ============

    function toggleEmergencyPause() external;

    function initiateEmergencyWithdrawal(address _to) external;

    function executeEmergencyWithdrawal(address _to) external;

    // ============ View Functions ============

    function getScheduleInfo(
        bytes32 _scheduleId
    )
        external
        view
        returns (
            uint256 totalAmount,
            uint256 startTime,
            uint256 cliffDuration,
            uint256 duration,
            uint256 released,
            bool revocable,
            bool revoked,
            uint256 vested
        );

    function getBeneficiarySchedules(
        address _beneficiary
    ) external view returns (bytes32[] memory);

    function getVaultBalance() external view returns (uint256);
}
