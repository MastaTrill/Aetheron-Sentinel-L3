// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IMultiSigGovernance.sol";

/**
 * @title TimeLockVault
 * @notice Secure vault with configurable unlock schedules for treasury management
 * @dev Supports multiple vesting schedules, emergency withdrawals, and beneficiary management
 */
contract TimeLockVault is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // Structs
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 duration;
        uint256 released;
        bool revocable;
        bool revoked;
    }

    struct Beneficiary {
        address recipient;
        uint256 scheduleId;
        uint256 claimableAmount;
    }

    // State
    IERC20 public immutable TOKEN;
    address public immutable multiSigGovernance;
    mapping(bytes32 => VestingSchedule) public vestingSchedules;
    mapping(address => bytes32[]) public beneficiarySchedules;
    mapping(bytes32 => address[]) public scheduleBeneficiaries;

    // Emergency controls
    bool public emergencyPause;
    uint256 public constant EMERGENCY_DELAY = 48 hours;
    mapping(address => bool) public emergencyApproved;
    uint256 public emergencyInitiatedAt;

    // Events
    event ScheduleCreated(
        bytes32 indexed scheduleId,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 duration
    );
    event TokensDeposited(bytes32 indexed scheduleId, uint256 amount);
    event TokensReleased(
        address indexed beneficiary,
        bytes32 indexed scheduleId,
        uint256 amount
    );
    event ScheduleRevoked(bytes32 indexed scheduleId, uint256 unclaimedAmount);
    event EmergencyPauseToggled(bool paused);
    event EmergencyWithdrawalInitiated(
        address indexed initiator,
        uint256 timestamp
    );
    event EmergencyWithdrawalExecuted(address indexed to, uint256 amount);
    event BeneficiaryAdded(
        bytes32 indexed scheduleId,
        address indexed beneficiary
    );

    modifier whenNotPaused() {
        require(!emergencyPause, "Vault is paused");
        _;
    }

    modifier requiresMultiSigApproval(uint256 proposalId) {
        // Check if proposal is executed in multi-sig governance
        IMultiSigGovernance.ProposalState state = IMultiSigGovernance(multiSigGovernance).getProposalState(proposalId);
        require(state == IMultiSigGovernance.ProposalState.Executed, "Proposal not executed by multi-sig");
        _;
    }

    constructor(address _token, address _multiSigGovernance) {
        require(_token != address(0), "Invalid token address");
        require(_multiSigGovernance != address(0), "Invalid multi-sig address");
        TOKEN = IERC20(_token);
        multiSigGovernance = _multiSigGovernance;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
    }

    // ============ Schedule Management ============

    function createVestingSchedule(
        uint256 _totalAmount,
        uint256 _startTime,
        uint256 _cliffDuration,
        uint256 _duration,
        bool _revocable,
        address[] calldata _beneficiaries
    ) external onlyRole(ADMIN_ROLE) returns (bytes32 scheduleId) {
        require(_duration > 0, "Duration must be > 0");
        require(_totalAmount > 0, "Amount must be > 0");
        require(_beneficiaries.length > 0, "Need beneficiaries");

        scheduleId = keccak256(
            abi.encode(msg.sender, block.timestamp, _totalAmount, _duration)
        );

        vestingSchedules[scheduleId] = VestingSchedule({
            totalAmount: _totalAmount,
            startTime: _startTime,
            cliffDuration: _cliffDuration,
            duration: _duration,
            released: 0,
            revocable: _revocable,
            revoked: false
        });

        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            require(_beneficiaries[i] != address(0), "Invalid beneficiary");
            beneficiarySchedules[_beneficiaries[i]].push(scheduleId);
            scheduleBeneficiaries[scheduleId].push(_beneficiaries[i]);
            emit BeneficiaryAdded(scheduleId, _beneficiaries[i]);
        }

        emit ScheduleCreated(
            scheduleId,
            _totalAmount,
            _startTime,
            _cliffDuration,
            _duration
        );
    }

    function depositToSchedule(
        bytes32 _scheduleId,
        uint256 _amount
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        require(schedule.totalAmount > 0, "Schedule not found");
        require(!schedule.revoked, "Schedule revoked");

        schedule.totalAmount += _amount;
        require(
            TOKEN.transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );

        emit TokensDeposited(_scheduleId, _amount);
    }

    // ============ Claiming ============

    function claim(
        address _beneficiary
    ) external nonReentrant whenNotPaused returns (uint256 amount) {
        bytes32[] storage schedules = beneficiarySchedules[_beneficiary];
        uint256 totalClaimable;

        for (uint256 i = 0; i < schedules.length; i++) {
            totalClaimable += _calculateReleasable(schedules[i], _beneficiary);
        }

        require(totalClaimable > 0, "Nothing to claim");

        for (uint256 i = 0; i < schedules.length; i++) {
            uint256 releasable = _calculateReleasable(
                schedules[i],
                _beneficiary
            );
            if (releasable > 0) {
                vestingSchedules[schedules[i]].released += releasable;
                emit TokensReleased(_beneficiary, schedules[i], releasable);
            }
        }

        require(
            TOKEN.transfer(_beneficiary, totalClaimable),
            "Transfer failed"
        );
        return totalClaimable;
    }

    function claimable(
        address _beneficiary
    ) external view returns (uint256 totalClaimable) {
        bytes32[] storage schedules = beneficiarySchedules[_beneficiary];

        for (uint256 i = 0; i < schedules.length; i++) {
            totalClaimable += _calculateReleasable(schedules[i], _beneficiary);
        }
    }

    function _calculateReleasable(
        bytes32 _scheduleId,
        address _beneficiary
    ) internal view returns (uint256 releasable) {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        require(schedule.totalAmount > 0, "Schedule not found");

        // Check if within beneficiary list
        bool isBeneficiary;
        address[] memory beneficiaries = scheduleBeneficiaries[_scheduleId];
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            if (beneficiaries[i] == _beneficiary) {
                isBeneficiary = true;
                break;
            }
        }
        require(isBeneficiary, "Not a beneficiary");

        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return 0;
        }

        if (schedule.revoked) {
            return 0;
        }

        uint256 vested = _vestedAmount(schedule);
        uint256 released = schedule.released;

        // Distribute evenly among beneficiaries
        uint256 beneficiaryShare = schedule.totalAmount / beneficiaries.length;
        uint256 beneficiaryVested = vested * beneficiaries.length >
            schedule.totalAmount
            ? schedule.totalAmount
            : vested;
        uint256 totalReleasable = (beneficiaryVested *
            (schedule.totalAmount / beneficiaries.length)) /
            schedule.totalAmount;

        return totalReleasable - released;
    }

    function _vestedAmount(
        VestingSchedule storage _schedule
    ) internal view returns (uint256) {
        if (block.timestamp < _schedule.startTime) return 0;
        if (block.timestamp >= _schedule.startTime + _schedule.duration) {
            return _schedule.totalAmount;
        }
        return
            (_schedule.totalAmount * (block.timestamp - _schedule.startTime)) /
            _schedule.duration;
    }

    // ============ Revocation ============

    function revokeSchedule(bytes32 _scheduleId) external onlyRole(ADMIN_ROLE) {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        require(schedule.revocable, "Not revocable");
        require(!schedule.revoked, "Already revoked");

        schedule.revoked = true;

        uint256 released = schedule.released;
        uint256 revokedAmount = schedule.totalAmount - released;

        if (revokedAmount > 0) {
            require(
                TOKEN.transfer(msg.sender, revokedAmount),
                "Transfer failed"
            );
        }

        emit ScheduleRevoked(_scheduleId, revokedAmount);
    }

    // ============ Emergency Controls ============

    function toggleEmergencyPause() external onlyRole(GUARDIAN_ROLE) {
        emergencyPause = !emergencyPause;
        emit EmergencyPauseToggled(emergencyPause);
    }

    function initiateEmergencyWithdrawal(
        address _to
    ) external onlyRole(GUARDIAN_ROLE) {
        require(!emergencyApproved[msg.sender], "Already initiated");
        emergencyApproved[msg.sender] = true;
        emergencyInitiatedAt = block.timestamp;
        emit EmergencyWithdrawalInitiated(msg.sender, block.timestamp);
    }

    function executeEmergencyWithdrawal(
        address _to,
        uint256 _proposalId
    ) external onlyRole(GUARDIAN_ROLE) nonReentrant requiresMultiSigApproval(_proposalId) {
        require(emergencyInitiatedAt > 0, "No emergency initiated");
        require(
            block.timestamp >= emergencyInitiatedAt + EMERGENCY_DELAY,
            "Delay not passed"
        );

        uint256 balance = TOKEN.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");

        // Reset emergency state
        emergencyInitiatedAt = 0;
        emergencyApproved[msg.sender] = false;

        require(TOKEN.transfer(_to, balance), "Transfer failed");
        emit EmergencyWithdrawalExecuted(_to, balance);
    }

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
        )
    {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        return (
            schedule.totalAmount,
            schedule.startTime,
            schedule.cliffDuration,
            schedule.duration,
            schedule.released,
            schedule.revocable,
            schedule.revoked,
            _vestedAmount(schedule)
        );
    }

    function getBeneficiarySchedules(
        address _beneficiary
    ) external view returns (bytes32[] memory) {
        return beneficiarySchedules[_beneficiary];
    }

    function getVaultBalance() external view returns (uint256) {
        return TOKEN.balanceOf(address(this));
    }
}
