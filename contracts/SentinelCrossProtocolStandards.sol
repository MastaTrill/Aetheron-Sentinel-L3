// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SentinelCrossProtocolStandards
 * @notice Cross-Protocol Security Standards and Compliance Framework
 * Establishes industry standards for DeFi security across protocols
 */
contract SentinelCrossProtocolStandards is Ownable {
    using ECDSA for bytes32;

    // Standard categories
    enum StandardCategory {
        SMART_CONTRACT_SECURITY,
        ORACLE_INTEGRITY,
        LIQUIDITY_PROTECTION,
        GOVERNANCE_SECURITY,
        CROSS_CHAIN_BRIDGE_SECURITY,
        USER_FUND_PROTECTION
    }

    // Compliance levels
    enum ComplianceLevel {
        BASIC, // Minimum requirements
        INTERMEDIATE, // Enhanced protection
        ADVANCED, // Enterprise-grade
        ELITE // Cutting-edge security
    }

    // Standard definition
    struct SecurityStandard {
        bytes32 standardId;
        StandardCategory category;
        ComplianceLevel level;
        string title;
        string description;
        string[] requirements;
        uint256 version;
        bool isActive;
        uint256 adoptionCount;
        address[] certifiedProtocols;
    }

    // Protocol certification
    struct ProtocolCertification {
        address protocolAddress;
        bytes32 standardId;
        ComplianceLevel certifiedLevel;
        uint256 certificationDate;
        uint256 expiryDate;
        address certifyingAuthority;
        string auditReportURI;
        bool isActive;
    }

    mapping(bytes32 => SecurityStandard) public standards;
    mapping(address => ProtocolCertification[]) public protocolCertifications;
    mapping(bytes32 => mapping(address => bool)) public standardAdopters;

    bytes32[] public activeStandards;
    address[] public certifyingAuthorities;

    event StandardCreated(bytes32 indexed standardId, StandardCategory category, ComplianceLevel level);
    event ProtocolCertified(address indexed protocol, bytes32 indexed standardId, ComplianceLevel level);
    event CertificationRevoked(address indexed protocol, bytes32 indexed standardId);

    constructor() Ownable(msg.sender) {
        // Add initial certifying authorities
        certifyingAuthorities.push(owner());
    }

    /**
     * @notice Create a new security standard
     */
    function createStandard(
        StandardCategory category,
        ComplianceLevel level,
        string memory title,
        string memory description,
        string[] memory requirements
    ) external onlyOwner returns (bytes32) {
        bytes32 standardId = keccak256(abi.encodePacked(category, level, title, block.timestamp));

        require(standards[standardId].standardId == bytes32(0), "Standard already exists");

        standards[standardId] = SecurityStandard({
            standardId: standardId,
            category: category,
            level: level,
            title: title,
            description: description,
            requirements: requirements,
            version: 1,
            isActive: true,
            adoptionCount: 0,
            certifiedProtocols: new address[](0)
        });

        activeStandards.push(standardId);

        emit StandardCreated(standardId, category, level);

        return standardId;
    }

    /**
     * @notice Certify protocol compliance with standard
     */
    function certifyProtocol(
        address protocolAddress,
        bytes32 standardId,
        ComplianceLevel certifiedLevel,
        uint256 validityPeriod,
        string memory auditReportURI
    ) external onlyOwner {
        require(isCertifyingAuthority(msg.sender), "Not authorized to certify");
        require(standards[standardId].isActive, "Standard not active");
        require(certifiedLevel >= standards[standardId].level, "Certification level too low");
        require(bytes(auditReportURI).length > 0, "Audit report URI required");
        require(validityPeriod > 0 && validityPeriod <= 365 days, "Invalid validity period");

        ProtocolCertification memory cert = ProtocolCertification({
            protocolAddress: protocolAddress,
            standardId: standardId,
            certifiedLevel: certifiedLevel,
            certificationDate: block.timestamp,
            expiryDate: block.timestamp + validityPeriod,
            certifyingAuthority: msg.sender,
            auditReportURI: auditReportURI,
            isActive: true
        });

        protocolCertifications[protocolAddress].push(cert);
        standards[standardId].certifiedProtocols.push(protocolAddress);
        standards[standardId].adoptionCount++;
        standardAdopters[standardId][protocolAddress] = true;

        emit ProtocolCertified(protocolAddress, standardId, certifiedLevel);
    }

    /**
     * @notice Revoke protocol certification
     */
    function revokeCertification(
        address protocolAddress,
        bytes32 standardId
    ) external {
        require(isCertifyingAuthority(msg.sender), "Not authorized");

        ProtocolCertification[] storage certs = protocolCertifications[protocolAddress];
        for (uint256 i = 0; i < certs.length; i++) {
            if (certs[i].standardId == standardId && certs[i].isActive) {
                certs[i].isActive = false;

                // Remove from standard adopters
                standards[standardId].adoptionCount--;
                standardAdopters[standardId][protocolAddress] = false;

                // Remove from certified protocols array
                address[] storage certified = standards[standardId].certifiedProtocols;
                for (uint256 j = 0; j < certified.length; j++) {
                    if (certified[j] == protocolAddress) {
                        certified[j] = certified[certified.length - 1];
                        certified.pop();
                        break;
                    }
                }

                emit CertificationRevoked(protocolAddress, standardId);
                break;
            }
        }
    }

    /**
     * @notice Check protocol certification status
     */
    function isProtocolCertified(
        address protocolAddress,
        bytes32 standardId
    ) external view returns (bool, ComplianceLevel) {
        ProtocolCertification[] memory certs = protocolCertifications[protocolAddress];

        for (uint256 i = 0; i < certs.length; i++) {
            if (certs[i].standardId == standardId && certs[i].isActive && certs[i].expiryDate > block.timestamp) {
                return (true, certs[i].certifiedLevel);
            }
        }

        return (false, ComplianceLevel.BASIC);
    }

    /**
     * @notice Get protocol certifications
     */
    function getProtocolCertifications(
        address protocolAddress
    ) external view returns (ProtocolCertification[] memory) {
        return protocolCertifications[protocolAddress];
    }

    /**
     * @notice Get standard details
     */
    function getStandard(
        bytes32 standardId
    ) external view returns (SecurityStandard memory) {
        return standards[standardId];
    }

    /**
     * @notice Get all active standards
     */
    function getActiveStandards() external view returns (bytes32[] memory) {
        return activeStandards;
    }

    /**
     * @notice Add certifying authority
     */
    function addCertifyingAuthority(
        address authority
    ) external onlyOwner {
        require(!isCertifyingAuthority(authority), "Already a certifying authority");
        certifyingAuthorities.push(authority);
    }

    /**
     * @notice Remove certifying authority
     */
    function removeCertifyingAuthority(
        address authority
    ) external onlyOwner {
        for (uint256 i = 0; i < certifyingAuthorities.length; i++) {
            if (certifyingAuthorities[i] == authority) {
                certifyingAuthorities[i] = certifyingAuthorities[certifyingAuthorities.length - 1];
                certifyingAuthorities.pop();
                break;
            }
        }
    }

    /**
     * @notice Check if address is certifying authority
     */
    function isCertifyingAuthority(
        address authority
    ) public view returns (bool) {
        for (uint256 i = 0; i < certifyingAuthorities.length; i++) {
            if (certifyingAuthorities[i] == authority) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Update standard version
     */
    function updateStandardVersion(
        bytes32 standardId,
        string[] memory newRequirements
    ) external onlyOwner {
        SecurityStandard storage standard = standards[standardId];
        require(standard.isActive, "Standard not active");

        standard.version++;
        standard.requirements = newRequirements;
    }

    /**
     * @notice Deactivate standard
     */
    function deactivateStandard(
        bytes32 standardId
    ) external onlyOwner {
        standards[standardId].isActive = false;

        // Remove from active standards
        for (uint256 i = 0; i < activeStandards.length; i++) {
            if (activeStandards[i] == standardId) {
                activeStandards[i] = activeStandards[activeStandards.length - 1];
                activeStandards.pop();
                break;
            }
        }
    }

    /**
     * @notice Get standards by category
     */
    function getStandardsByCategory(
        StandardCategory category
    ) external view returns (bytes32[] memory) {
        bytes32[] memory categoryStandards = new bytes32[](activeStandards.length);
        uint256 count = 0;

        for (uint256 i = 0; i < activeStandards.length; i++) {
            if (standards[activeStandards[i]].category == category) {
                categoryStandards[count] = activeStandards[i];
                count++;
            }
        }

        // Resize array
        bytes32[] memory result = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = categoryStandards[i];
        }

        return result;
    }

    /**
     * @notice Get certification statistics
     */
    function getCertificationStats()
        external
        view
        returns (uint256 totalStandards, uint256 totalCertifications, uint256 activeCertifications)
    {
        uint256 certifications = 0;
        uint256 activeCerts = 0;

        for (uint256 i = 0; i < activeStandards.length; i++) {
            certifications += standards[activeStandards[i]].adoptionCount;
            activeCerts += standards[activeStandards[i]].certifiedProtocols.length;
        }

        return (activeStandards.length, certifications, activeCerts);
    }
}
