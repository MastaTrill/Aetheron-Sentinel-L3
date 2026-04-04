// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IAetheronModuleHub.sol";

interface IUpgradeableProxy {
    function upgradeTo(address newImplementation) external;
}

contract AutonomousPatcher is AccessControl, ReentrancyGuard {
    bytes32 public constant PATCH_ADMIN = keccak256("PATCH_ADMIN");
    bytes32 public constant PATCH_APPROVER = keccak256("PATCH_APPROVER");
    bytes32 public constant EMERGENCY_PATCHER = keccak256("EMERGENCY_PATCHER");

    enum PatchStatus {
        Proposed,
        Approved,
        Deploying,
        Deployed,
        Failed,
        RolledBack
    }

    enum PatchSeverity {
        Low,
        Medium,
        High,
        Critical
    }

    struct Patch {
        bytes32 id;
        address targetContract;
        address newImplementation;
        PatchSeverity severity;
        uint256 threatThreshold;
        uint256 approvalCount;
        uint256 requiredApprovals;
        uint256 proposedAt;
        uint256 deployAfter;
        uint256 deployedAt;
        PatchStatus status;
        address proposer;
        bytes metadata;
    }

    mapping(bytes32 => Patch) public patches;
    mapping(bytes32 => mapping(address => bool)) public patchApprovals;
    mapping(address => address) public previousImplementations;
    
    IAetheronModuleHub public moduleHub;
    uint256 public defaultRequiredApprovals = 3;
    uint256 public currentThreatLevel;
    
    event PatchProposed(bytes32 indexed patchId, address indexed target, PatchSeverity severity);
    event PatchApproved(bytes32 indexed patchId, address indexed approver);
    event PatchDeployed(bytes32 indexed patchId, address indexed target, address newImpl);
    event PatchFailed(bytes32 indexed patchId, string reason);
    event PatchRolledBack(bytes32 indexed patchId, address indexed target);

    constructor(address _moduleHub) {
        require(_moduleHub != address(0), "Invalid module hub");
        moduleHub = IAetheronModuleHub(_moduleHub);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PATCH_ADMIN, msg.sender);
        _grantRole(PATCH_APPROVER, msg.sender);
        _grantRole(EMERGENCY_PATCHER, msg.sender);
    }

    function proposePatch(
        bytes32 patchId,
        address targetContract,
        address newImplementation,
        PatchSeverity severity,
        uint256 deployDelay,
        bytes calldata metadata
    ) external onlyRole(PATCH_ADMIN) nonReentrant {
        require(patches[patchId].id == bytes32(0), "Patch already exists");
        require(targetContract != address(0), "Invalid target");
        require(newImplementation != address(0), "Invalid implementation");
        require(deployDelay <= 7 days, "Delay too long");
        
        uint256 requiredApprovals = defaultRequiredApprovals;
        if (severity == PatchSeverity.Critical) requiredApprovals = 5;
        else if (severity == PatchSeverity.High) requiredApprovals = 3;
        else if (severity == PatchSeverity.Medium) requiredApprovals = 2;
        
        patches[patchId] = Patch({
            id: patchId,
            targetContract: targetContract,
            newImplementation: newImplementation,
            severity: severity,
            threatThreshold: severity == PatchSeverity.Critical ? 75 : 50,
            approvalCount: 0,
            requiredApprovals: requiredApprovals,
            proposedAt: block.timestamp,
            deployAfter: block.timestamp + deployDelay,
            deployedAt: 0,
            status: PatchStatus.Proposed,
            proposer: msg.sender,
            metadata: metadata
        });
        
        emit PatchProposed(patchId, targetContract, severity);
    }

    function approvePatch(bytes32 patchId) external onlyRole(PATCH_APPROVER) nonReentrant {
        require(patches[patchId].id != bytes32(0), "Patch not found");
        require(patches[patchId].status == PatchStatus.Proposed, "Invalid status");
        require(!patchApprovals[patchId][msg.sender], "Already approved");
        
        patchApprovals[patchId][msg.sender] = true;
        patches[patchId].approvalCount++;
        
        emit PatchApproved(patchId, msg.sender);
        
        if (patches[patchId].approvalCount >= patches[patchId].requiredApprovals) {
            patches[patchId].status = PatchStatus.Approved;
        }
    }

    function deployPatch(bytes32 patchId, address previousImplementation) external nonReentrant {
        Patch storage patch = patches[patchId];
        require(patch.id != bytes32(0), "Patch not found");
        require(patch.status == PatchStatus.Approved, "Not approved");
        require(block.timestamp >= patch.deployAfter, "Too early to deploy");
        require(currentThreatLevel >= patch.threatThreshold || hasRole(EMERGENCY_PATCHER, msg.sender), "Threat level too low");
        
        patch.status = PatchStatus.Deploying;
        previousImplementations[patch.targetContract] = previousImplementation;
        
        try IUpgradeableProxy(patch.targetContract).upgradeTo(patch.newImplementation) {
            patch.status = PatchStatus.Deployed;
            patch.deployedAt = block.timestamp;
            emit PatchDeployed(patchId, patch.targetContract, patch.newImplementation);
        } catch Error(string memory reason) {
            patch.status = PatchStatus.Failed;
            emit PatchFailed(patchId, reason);
        } catch {
            patch.status = PatchStatus.Failed;
            emit PatchFailed(patchId, "Unknown error");
        }
    }

    function emergencyDeployPatch(bytes32 patchId, address previousImplementation) external onlyRole(EMERGENCY_PATCHER) nonReentrant {
        Patch storage patch = patches[patchId];
        require(patch.id != bytes32(0), "Patch not found");
        require(patch.severity == PatchSeverity.Critical, "Not critical");
        
        patch.status = PatchStatus.Deploying;
        previousImplementations[patch.targetContract] = previousImplementation;
        
        try IUpgradeableProxy(patch.targetContract).upgradeTo(patch.newImplementation) {
            patch.status = PatchStatus.Deployed;
            patch.deployedAt = block.timestamp;
            emit PatchDeployed(patchId, patch.targetContract, patch.newImplementation);
        } catch Error(string memory reason) {
            patch.status = PatchStatus.Failed;
            emit PatchFailed(patchId, reason);
        }
    }

    function rollbackPatch(bytes32 patchId) external onlyRole(PATCH_ADMIN) nonReentrant {
        Patch storage patch = patches[patchId];
        require(patch.id != bytes32(0), "Patch not found");
        require(patch.status == PatchStatus.Deployed || patch.status == PatchStatus.Failed, "Cannot rollback");
        require(previousImplementations[patch.targetContract] != address(0), "No previous version");
        
        address previousImpl = previousImplementations[patch.targetContract];
        
        try IUpgradeableProxy(patch.targetContract).upgradeTo(previousImpl) {
            patch.status = PatchStatus.RolledBack;
            emit PatchRolledBack(patchId, patch.targetContract);
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("Rollback failed: ", reason)));
        }
    }

    function updateThreatLevel(uint256 newLevel) external onlyRole(PATCH_ADMIN) {
        require(newLevel <= 100, "Invalid level");
        currentThreatLevel = newLevel;
    }

    function setDefaultRequiredApprovals(uint256 count) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(count >= 1 && count <= 10, "Invalid count");
        defaultRequiredApprovals = count;
    }

    function canDeployPatch(bytes32 patchId) external view returns (bool) {
        Patch storage patch = patches[patchId];
        return patch.id != bytes32(0) &&
               patch.status == PatchStatus.Approved &&
               block.timestamp >= patch.deployAfter &&
               (currentThreatLevel >= patch.threatThreshold || patch.severity == PatchSeverity.Critical);
    }

    function getPatch(bytes32 patchId) external view returns (
        address targetContract,
        address newImplementation,
        PatchSeverity severity,
        PatchStatus status,
        uint256 approvalCount,
        uint256 requiredApprovals
    ) {
        Patch storage patch = patches[patchId];
        return (
            patch.targetContract,
            patch.newImplementation,
            patch.severity,
            patch.status,
            patch.approvalCount,
            patch.requiredApprovals
        );
    }
}
