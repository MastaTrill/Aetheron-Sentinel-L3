// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IAetheronModuleHub.sol";
import "../interfaces/ITimeLockVault.sol";
import "../interfaces/IYieldAggregator.sol";
import "../interfaces/IMultiSigGovernance.sol";
import "../interfaces/IKeeperNetwork.sol";
import "../interfaces/ICoveragePool.sol";
import "../interfaces/IBridgeHealthMonitor.sol";

/**
 * @title AetheronModuleHub
 * @notice Central hub connecting all Aetheron Sentinel L3 modules
 * @dev Provides unified interface and cross-module communication.
 *      This version introduces stricter validation for module updates,
 *      emits explicit events on address changes, and allows optional
 *      multi‑signature governance for sensitive operations.
 */
contract AetheronModuleHub is AccessControl, ReentrancyGuard, IAetheronModuleHub {
    // Module types
    bytes32 public constant MODULE_ADMIN_ROLE = keccak256("MODULE_ADMIN_ROLE");

    // Module addresses
    mapping(string => address) public moduleAddresses;
    mapping(address => ModuleInfo) public modules;
    string[] public moduleNames;

    // Core contract addresses
    address public bridgeAddress;
    address public sentinelAddress;

    // Optional governance address for multi‑sig operations
    address public governance;

    // Emergency state
    bool public emergencyActive;

    // Module events
    event ModuleRegistered(string indexed name, address indexed module);
    event ModuleUpdated(string indexed name, address indexed oldAddress, address indexed newAddress);
    event ModulePaused(string indexed name);
    event ModuleResumed(string indexed name);
    event CrossModuleCall(address indexed from, string indexed to, bytes32 callHash);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MODULE_ADMIN_ROLE, msg.sender);
        governance = msg.sender;
    }

    /**
     * @notice Update the governance address controlling module updates.
     * @param _governance The new governance contract (e.g. multisig) address.
     */
    function setGovernance(address _governance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_governance != address(0), "Invalid governance");
        governance = _governance;
    }

    // ============ Core Contract Configuration ============
    function setCoreContracts(
        address _bridge,
        address _sentinel
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_bridge != address(0)) {
            bridgeAddress = _bridge;
        }
        if (_sentinel != address(0)) {
            sentinelAddress = _sentinel;
        }
    }

    // ============ Module Registration ============
    function registerModule(
        string calldata _name,
        address _moduleAddress
    ) external onlyRole(MODULE_ADMIN_ROLE) {
        require(_moduleAddress != address(0), "Invalid address");
        require(moduleAddresses[_name] == address(0), "Module exists");
        require(modules[_moduleAddress].moduleAddress == address(0), "Address already registered");

        moduleAddresses[_name] = _moduleAddress;
        modules[_moduleAddress] = ModuleInfo({
            moduleAddress: _moduleAddress,
            name: _name,
            isActive: true,
            isPaused: false,
            lastActivity: block.timestamp
        });
        moduleNames.push(_name);
        emit ModuleRegistered(_name, _moduleAddress);
    }

    /**
     * @notice Update the address of an existing module.
     * @dev Requires the caller to either hold the MODULE_ADMIN_ROLE or be the configured governance contract.
     *      Performs strict validation and emits a dedicated ModuleUpdated event.
     * @param _name The module name to update.
     * @param _newAddress The new contract address for the module.
     */
    function updateModuleAddress(
        string calldata _name,
        address _newAddress
    ) external {
        address current = moduleAddresses[_name];
        require(current != address(0), "Module not found");
        require(_newAddress != address(0), "Invalid new address");
        require(_newAddress != current, "New address must differ");
        // Ensure the new address is not already registered under a different name
        require(modules[_newAddress].moduleAddress == address(0), "Address already in use");
        // Enforce multi‑sig governance if configured; otherwise require admin role
        if (governance != address(0) && msg.sender != governance) {
            require(hasRole(MODULE_ADMIN_ROLE, msg.sender), "Unauthorized");
        }
        // Deactivate old module record
        modules[current].isActive = false;
        // Update mapping
        moduleAddresses[_name] = _newAddress;
        modules[_newAddress] = ModuleInfo({
            moduleAddress: _newAddress,
            name: _name,
            isActive: true,
            isPaused: false,
            lastActivity: block.timestamp
        });
        emit ModuleUpdated(_name, current, _newAddress);
    }

    // ============ Module Control ============
    function pauseModule(string calldata _name) external onlyRole(MODULE_ADMIN_ROLE) {
        require(moduleAddresses[_name] != address(0), "Module not found");
        modules[moduleAddresses[_name]].isPaused = true;
        emit ModulePaused(_name);
    }
    function resumeModule(string calldata _name) external onlyRole(MODULE_ADMIN_ROLE) {
        require(moduleAddresses[_name] != address(0), "Module not found");
        modules[moduleAddresses[_name]].isPaused = false;
        emit ModuleResumed(_name);
    }

    // ============ Cross-Module Calls ============
    function executeModuleCall(
        string calldata _targetModule,
        bytes calldata _callData
    ) external payable nonReentrant returns (bytes memory result) {
        require(!emergencyActive, "Emergency active");
        address target = moduleAddresses[_targetModule];
        require(target != address(0), "Module not found");
        require(!modules[target].isPaused, "Module paused");
        modules[target].lastActivity = block.timestamp;
        (bool success, bytes memory data) = target.call{value: msg.value}(_callData);
        require(success, "Call failed");
        emit CrossModuleCall(msg.sender, _targetModule, keccak256(_callData));
        return data;
    }

    // ============ Emergency ============
    function emergencyStop() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyActive = true;
        // Pause all active modules
        for (uint256 i = 0; i < moduleNames.length; i++) {
            address moduleAddr = moduleAddresses[moduleNames[i]];
            if (modules[moduleAddr].isActive && !modules[moduleAddr].isPaused) {
                modules[moduleAddr].isPaused = true;
            }
        }
    }
    function emergencyResume() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyActive = false;
        // Resume all modules marked active
        for (uint256 i = 0; i < moduleNames.length; i++) {
            address moduleAddr = moduleAddresses[moduleNames[i]];
            if (modules[moduleAddr].isActive) {
                modules[moduleAddr].isPaused = false;
            }
        }
    }
    function isEmergencyActive() external view returns (bool) {
        return emergencyActive;
    }

    // ============ View Functions ============
    function getModule(string calldata _name) external view returns (ModuleInfo memory) {
        address moduleAddr = moduleAddresses[_name];
        require(moduleAddr != address(0), "Module not found");
        return modules[moduleAddr];
    }
    function getAllModules() external view returns (ModuleInfo[] memory result) {
        result = new ModuleInfo[](moduleNames.length);
        for (uint256 i = 0; i < moduleNames.length; i++) {
            result[i] = modules[moduleAddresses[moduleNames[i]]];
        }
    }
    function getModuleAddress(string calldata _name) external view returns (address) {
        return moduleAddresses[_name];
    }
    function getActiveModulesCount() external view returns (uint256) {
        uint256 count;
        for (uint256 i = 0; i < moduleNames.length; i++) {
            address moduleAddr = moduleAddresses[moduleNames[i]];
            if (modules[moduleAddr].isActive && !modules[moduleAddr].isPaused) {
                count++;
            }
        }
        return count;
    }

    // ============ Integrated Data Queries ============
    struct HubStats {
        uint256 totalModules;
        uint256 activeModules;
        uint256 tvl;
        uint256 totalVolume;
        uint256 governanceProposals;
        uint256 activeKeepers;
    }
    function getHubStats() external view returns (HubStats memory stats) {
        stats.totalModules = moduleNames.length;
        uint256 active;
        for (uint256 i = 0; i < moduleNames.length; i++) {
            address moduleAddr = moduleAddresses[moduleNames[i]];
            if (modules[moduleAddr].isActive && !modules[moduleAddr].isPaused) {
                active++;
            }
        }
        stats.activeModules = active;
        // Get TVL from sentinel if available
        if (sentinelAddress != address(0)) {
            (bool success, bytes memory data) = sentinelAddress.staticcall(
                abi.encodeWithSignature("totalValueLocked()")
            );
            if (success && data.length == 32) {
                stats.tvl = abi.decode(data, (uint256));
            }
        }
        return stats;
    }
    // ============ Module-Specific Integrations ============
    function getYieldStats() external view returns (
        uint256 tvl,
        uint256 apy,
        uint256 activeSources
    ) {
        address yieldAgg = moduleAddresses["YieldAggregator"];
        if (yieldAgg != address(0)) {
            try IYieldAggregator(yieldAgg).getTotalValueLocked() returns (uint256 value) {
                tvl = value;
            } catch {}
        }
    }
    function getGovernanceStats() external view returns (
        uint256 activeProposals,
        uint256 totalVotes
    ) {
        // Integration with governance module can be implemented here
    }
    function getKeeperStats() external view returns (
        uint256 activeKeepers,
        uint256 pendingTasks,
        uint256 totalBonded
    ) {
        address keeper = moduleAddresses["KeeperNetwork"];
        if (keeper != address(0)) {
            try IKeeperNetwork(keeper).getNetworkStats() returns (
                uint256 bonded,
                uint256 keepers,
                uint256 pending,
                uint256,
                uint256
            ) {
                activeKeepers = keepers;
                pendingTasks = pending;
                totalBonded = bonded;
            } catch {}
        }
    }
}