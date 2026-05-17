// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SentinelNFTCertification
 * @notice NFT Security Certification Service
 * Issues security certificates for NFT collections and individual NFTs
 */
contract SentinelNFTCertification is ERC721, Ownable, ReentrancyGuard {
    // Certificate types
    enum CertificateType {
        BASIC_SECURITY, // Basic vulnerability scan
        ADVANCED_SECURITY, // Comprehensive security audit
        QUANTUM_RESISTANT, // Quantum-safe verification
        CROSS_CHAIN, // Multi-chain security
        ENTERPRISE_GRADE // Full enterprise certification
    }

    struct NFTCertificate {
        uint256 tokenId;
        address nftContract;
        uint256 nftTokenId;
        CertificateType certType;
        uint256 issueDate;
        uint256 expiryDate;
        uint256 securityScore;
        string auditReportURI;
        bool isActive;
    }

    struct CollectionAudit {
        address collectionAddress;
        uint256 totalSupply;
        uint256 auditedSupply;
        uint256 averageSecurityScore;
        uint256 lastAuditDate;
        string auditReportURI;
        bool isCertified;
    }

    mapping(uint256 => NFTCertificate) public certificates;
    mapping(address => CollectionAudit) public collectionAudits;
    mapping(address => mapping(uint256 => uint256)) public nftCertificates; // contract => tokenId => certId

    uint256 public nextCertificateId = 1;
    uint256 public constant CERTIFICATE_DURATION = 365 days;
    uint256 public CERTIFICATION_FEE = 0.1 ether;

    event CertificationFeeUpdated(uint256 oldFee, uint256 newFee);

    event CertificateIssued(
        uint256 indexed certificateId, address indexed nftContract, uint256 indexed nftTokenId, CertificateType certType
    );

    event CollectionCertified(address indexed collectionAddress, uint256 securityScore, bool certified);

    event CertificateRenewed(uint256 indexed certificateId);
    event CertificateRevoked(uint256 indexed certificateId, string reason);

    constructor() ERC721("Sentinel NFT Security Certificate", "SNSC") Ownable(msg.sender) {}

    /**
     * @notice Certify individual NFT
     */
    function certifyNFT(
        address nftContract,
        uint256 nftTokenId,
        CertificateType certType,
        uint256 securityScore,
        string memory auditReportURI
    ) external payable nonReentrant {
        require(msg.value >= CERTIFICATION_FEE, "Insufficient certification fee");
        require(securityScore <= 100, "Invalid security score");

        uint256 certificateId = nextCertificateId++;

        _mint(msg.sender, certificateId);

        certificates[certificateId] = NFTCertificate({
            tokenId: certificateId,
            nftContract: nftContract,
            nftTokenId: nftTokenId,
            certType: certType,
            issueDate: block.timestamp,
            expiryDate: block.timestamp + CERTIFICATE_DURATION,
            securityScore: securityScore,
            auditReportURI: auditReportURI,
            isActive: true
        });

        nftCertificates[nftContract][nftTokenId] = certificateId;

        emit CertificateIssued(certificateId, nftContract, nftTokenId, certType);
    }

    /**
     * @notice Certify entire NFT collection
     */
    function certifyCollection(
        address collectionAddress,
        uint256 totalSupply,
        uint256 averageSecurityScore,
        string memory auditReportURI
    ) external payable nonReentrant onlyOwner {
        require(msg.value >= CERTIFICATION_FEE * 10, "Insufficient collection certification fee");
        require(averageSecurityScore <= 100, "Invalid security score");
        require(bytes(auditReportURI).length > 0, "Audit report URI required");

        collectionAudits[collectionAddress] = CollectionAudit({
            collectionAddress: collectionAddress,
            totalSupply: totalSupply,
            auditedSupply: totalSupply, // Assume full audit
            averageSecurityScore: averageSecurityScore,
            lastAuditDate: block.timestamp,
            auditReportURI: auditReportURI,
            isCertified: true
        });

        emit CollectionCertified(collectionAddress, averageSecurityScore, true);
    }

    /**
     * @notice Renew certificate
     */
    function renewCertificate(uint256 certificateId) external payable nonReentrant {
        require(ownerOf(certificateId) == msg.sender, "Not certificate owner");
        require(msg.value >= CERTIFICATION_FEE / 2, "Insufficient renewal fee");

        NFTCertificate storage cert = certificates[certificateId];
        require(cert.isActive, "Certificate not active");

        cert.expiryDate = block.timestamp + CERTIFICATE_DURATION;

        emit CertificateRenewed(certificateId);
    }

    /**
     * @notice Revoke certificate (admin only)
     */
    function revokeCertificate(uint256 certificateId, string memory reason) external onlyOwner {
        certificates[certificateId].isActive = false;
        emit CertificateRevoked(certificateId, reason);
    }

    /**
     * @notice Check NFT certification status
     */
    function isNFTCertified(address nftContract, uint256 nftTokenId) external view returns (bool) {
        uint256 certId = nftCertificates[nftContract][nftTokenId];
        if (certId == 0) return false;

        NFTCertificate memory cert = certificates[certId];
        return cert.isActive && cert.expiryDate > block.timestamp;
    }

    /**
     * @notice Get NFT security score
     */
    function getNFTSecurityScore(address nftContract, uint256 nftTokenId) external view returns (uint256) {
        uint256 certId = nftCertificates[nftContract][nftTokenId];
        if (certId == 0) return 0;

        return certificates[certId].securityScore;
    }

    /**
     * @notice Check collection certification
     */
    function isCollectionCertified(address collectionAddress) external view returns (bool) {
        return collectionAudits[collectionAddress].isCertified;
    }

    /**
     * @notice Get collection security metrics
     */
    function getCollectionMetrics(address collectionAddress)
        external
        view
        returns (uint256 averageScore, uint256 lastAuditDate, bool isCertified)
    {
        CollectionAudit memory audit = collectionAudits[collectionAddress];
        return (audit.averageSecurityScore, audit.lastAuditDate, audit.isCertified);
    }

    /**
     * @notice Withdraw certification fees
     */
    function withdrawFees() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @notice Update certification fee
     */
    function setCertificationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = CERTIFICATION_FEE;
        CERTIFICATION_FEE = newFee;
        emit CertificationFeeUpdated(oldFee, newFee);
    }
}
