// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAetheronModuleHub
 * @notice Central interface connecting all Aetheron Sentinel L3 modules
 * @dev This interface provides a unified API for all integrated contracts
 */
interface IAetheronModuleHub {
    // ============ Module Status ============

    struct ModuleInfo {
        address moduleAddress;
        string name;
        bool isActive;
        bool isPaused;
        uint256 lastActivity;
    }

    function registerModule(
        string calldata _name,
        address _moduleAddress
    ) external;

    function getModule(
        string calldata _name
    ) external view returns (ModuleInfo memory);

    function getAllModules() external view returns (ModuleInfo[] memory);

    function pauseModule(string calldata _name) external;

    function resumeModule(string calldata _name) external;

    // ============ Cross-Module Calls ============

    function executeModuleCall(
        string calldata _targetModule,
        bytes calldata _callData
    ) external payable returns (bytes memory);

    // ============ Emergency Controls ============

    function emergencyStop() external;

    function emergencyResume() external;

    function isEmergencyActive() external view returns (bool);
}
