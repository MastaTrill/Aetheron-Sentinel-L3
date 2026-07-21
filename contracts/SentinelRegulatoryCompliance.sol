// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SentinelRegulatoryCompliance
 * @notice Enterprise Regulatory Compliance Module - Handles KYC/AML and Sanctions
 */
contract SentinelRegulatoryCompliance is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant COMPLIANCE_OFFICER_ROLE = keccak256("COMPLIANCE_OFFICER_ROLE");

    enum KycLevel {
        NONE,
        BASIC,
        INSTITUTIONAL
    }

    mapping(address => bool) public sanctionedEntities;
    mapping(address => KycLevel) public kycRegistry;

    event SanctionAdded(address indexed entity, address indexed officer);
    event SanctionRemoved(address indexed entity, address indexed officer);
    event KycLevelUpdated(address indexed entity, KycLevel level, address indexed officer);

    /**
     * @dev Constructor assigns the initial compliance officer role.
     * @param initialAdmin Address of the initial admin and compliance officer.
     */
    constructor(address initialAdmin) {
        require(initialAdmin != address(0), "Invalid admin address");
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(COMPLIANCE_OFFICER_ROLE, initialAdmin);
    }

    /**
     * @notice Add an address to the global sanctions list.
     * @param entity The address to sanction.
     */
    function addSanction(address entity) external onlyRole(COMPLIANCE_OFFICER_ROLE) {
        require(entity != address(0), "Invalid entity address");
        require(!sanctionedEntities[entity], "Entity already sanctioned");
        
        sanctionedEntities[entity] = true;
        
        emit SanctionAdded(entity, msg.sender);
    }

    /**
     * @notice Remove an address from the global sanctions list.
     * @param entity The address to unsanction.
     */
    function removeSanction(address entity) external onlyRole(COMPLIANCE_OFFICER_ROLE) {
        require(entity != address(0), "Invalid entity address");
        require(sanctionedEntities[entity], "Entity not sanctioned");
        
        sanctionedEntities[entity] = false;
        
        emit SanctionRemoved(entity, msg.sender);
    }

    /**
     * @notice Update the KYC level for an entity.
     * @param entity The address to update.
     * @param level The new KYC level.
     */
    function updateKycLevel(address entity, KycLevel level) external onlyRole(COMPLIANCE_OFFICER_ROLE) {
        require(entity != address(0), "Invalid entity address");
        
        kycRegistry[entity] = level;
        
        emit KycLevelUpdated(entity, level, msg.sender);
    }

    /**
     * @notice Check if an entity is compliant.
     * @dev Returns false if the entity is sanctioned or doesn't meet the required KYC level.
     * @param entity The address to check.
     * @param requiredLevel The minimum required KYC level.
     * @return bool True if compliant, false otherwise.
     */
    function isCompliant(address entity, KycLevel requiredLevel) external view returns (bool) {
        if (sanctionedEntities[entity]) {
            return false;
        }
        
        if (requiredLevel == KycLevel.NONE) {
            return true; // No KYC required, just sanction check
        }

        return uint256(kycRegistry[entity]) >= uint256(requiredLevel);
    }

    /**
     * @notice Checks if an entity is sanctioned.
     * @param entity The address to check.
     * @return bool True if sanctioned.
     */
    function isSanctioned(address entity) external view returns (bool) {
        return sanctionedEntities[entity];
    }
}
