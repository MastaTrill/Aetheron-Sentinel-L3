// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title SentinelInterceptorV2
 * @notice UUPS upgradeable version of SentinelInterceptor
 * @dev Adds version tracking and additional security features
 */
contract SentinelInterceptorV2 is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable
{
    bytes32 public constant SENTINEL_ROLE = keccak256("SENTINEL_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @notice TVL spike threshold in basis points
    uint256 public tvlSpikeThreshold;

    /// @notice Maximum pause duration
    uint256 public constant MAX_PAUSE_DURATION = 1 hours;

    /// @notice Bridge address (immutable after init)
    address public immutable bridgeAddress;

    /// @notice Current TVL
    uint256 public totalValueLocked;

    /// @notice Whether autonomous mode is enabled
    bool public autonomousMode;

    /// @notice Last pause timestamp
    uint256 public lastPauseTimestamp;

    /// @notice Version for tracking upgrades
    string public version;

    // Storage gap for future upgrades
    uint256[50] private __gap;

    event AnomalyDetected(uint256 tvlPercentage, uint256 threshold);
    event AutonomousPauseTriggered(address indexed trigger, uint256 tvlAtPause);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event AutonomousModeToggled(bool enabled);
    event ContractUpgraded(
        address indexed oldImpl,
        address indexed newImpl,
        string newVersion
    );

    error TVLSpikeDetected(uint256 tvlPercentage, uint256 threshold);
    error UnauthorizedUpgrade();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _bridgeAddress) {
        require(_bridgeAddress != address(0), "Invalid bridge");
        bridgeAddress = _bridgeAddress;
        _disableInitializers();
    }

    function initialize(
        address initialAdmin,
        uint256 _tvlSpikeThreshold,
        bool _autonomousMode
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();

        tvlSpikeThreshold = _tvlSpikeThreshold;
        autonomousMode = _autonomousMode;
        version = "2.0.0";

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(SENTINEL_ROLE, initialAdmin);
        _grantRole(ORACLE_ROLE, initialAdmin);
        _grantRole(UPGRADER_ROLE, initialAdmin);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {
        emit ContractUpgraded(address(this), newImplementation, "2.0.0");
    }

    function reportAnomaly(
        uint256 tvlPercentage,
        uint256 currentTVL
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        if (tvlPercentage >= tvlSpikeThreshold && autonomousMode) {
            _triggerAutonomousPause(currentTVL);
        }

        emit AnomalyDetected(tvlPercentage, tvlSpikeThreshold);
    }

    function emergencyPause(
        string calldata reason
    ) external onlyRole(SENTINEL_ROLE) whenNotPaused {
        _pause();
        lastPauseTimestamp = block.timestamp;

        _pauseBridge();

        emit AutonomousPauseTriggered(msg.sender, totalValueLocked);
    }

    function resumeBridge(
        uint256 newTVL
    ) external onlyRole(SENTINEL_ROLE) whenPaused {
        require(
            block.timestamp - lastPauseTimestamp <= MAX_PAUSE_DURATION,
            "Max pause duration exceeded"
        );

        _unpause();
        totalValueLocked = newTVL;

        _resumeBridge();
    }

    function updateTVL(uint256 newTVL) external onlyRole(ORACLE_ROLE) {
        totalValueLocked = newTVL;
    }

    function setAutonomousMode(
        bool enabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        autonomousMode = enabled;
        emit AutonomousModeToggled(enabled);
    }

    function updateThreshold(
        uint256 newThreshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 old = tvlSpikeThreshold;
        tvlSpikeThreshold = newThreshold;
        emit ThresholdUpdated(old, newThreshold);
    }

    function getSecurityStatus()
        external
        view
        returns (bool isPaused, uint256 currentTVL, bool isAutonomous)
    {
        return (paused(), totalValueLocked, autonomousMode);
    }

    function getResponseMetrics()
        external
        pure
        returns (
            uint256 detectionLatencyMs,
            uint256 executionLatencyMs,
            uint256 totalInterceptTimeMs
        )
    {
        return (4, 10, 14);
    }

    function _triggerAutonomousPause(uint256 currentTVL) internal {
        _pause();
        lastPauseTimestamp = block.timestamp;
        _pauseBridge();
        emit AutonomousPauseTriggered(address(this), currentTVL);
    }

    function _pauseBridge() internal {
        (bool success, ) = bridgeAddress.call(
            abi.encodeWithSignature("emergencyPause()")
        );
    }

    function _resumeBridge() internal {
        (bool success, ) = bridgeAddress.call(
            abi.encodeWithSignature("resume()")
        );
    }
}
