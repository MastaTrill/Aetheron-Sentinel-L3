// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SentinelSecurityBadge
 * @notice Soulbound (non-transferable) ERC-721 security certification badge issued by Sentinel L3.
 */
contract SentinelSecurityBadge is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    struct BadgeInfo {
        string protocolName;
        uint256 securityScore;
        uint256 issuedTimestamp;
        uint256 lastUpdatedTimestamp;
        bool isActive;
    }

    mapping(uint256 => BadgeInfo) public badges;
    mapping(address => uint256) public protocolToTokenId;

    event SecurityBadgeMinted(
        uint256 indexed tokenId,
        address indexed protocol,
        string protocolName,
        uint256 securityScore
    );
    event SecurityScoreUpdated(uint256 indexed tokenId, uint256 newScore);
    event BadgeRevoked(uint256 indexed tokenId);

    constructor(address initialOwner)
        ERC721("Sentinel L3 Security Badge", "SL3BADGE")
        Ownable(initialOwner)
    {}

    /**
     * @notice Issue a new security badge to a verified protocol
     */
    function mintBadge(
        address protocol,
        string calldata protocolName,
        uint256 securityScore,
        string calldata uri
    ) external onlyOwner returns (uint256) {
        require(protocol != address(0), "Zero address protocol");
        require(securityScore <= 100, "Score cannot exceed 100");
        require(protocolToTokenId[protocol] == 0, "Protocol already has a badge");

        uint256 tokenId = ++_nextTokenId;
        _safeMint(protocol, tokenId);
        _setTokenURI(tokenId, uri);

        badges[tokenId] = BadgeInfo({
            protocolName: protocolName,
            securityScore: securityScore,
            issuedTimestamp: block.timestamp,
            lastUpdatedTimestamp: block.timestamp,
            isActive: true
        });

        protocolToTokenId[protocol] = tokenId;

        emit SecurityBadgeMinted(tokenId, protocol, protocolName, securityScore);
        return tokenId;
    }

    /**
     * @notice Update security score for an issued badge
     */
    function updateScore(uint256 tokenId, uint256 newScore) external onlyOwner {
        require(badges[tokenId].isActive, "Badge is inactive");
        require(newScore <= 100, "Score cannot exceed 100");

        badges[tokenId].securityScore = newScore;
        badges[tokenId].lastUpdatedTimestamp = block.timestamp;

        emit SecurityScoreUpdated(tokenId, newScore);
    }

    /**
     * @notice Revoke a security badge if protocol breaches security standards
     */
    function revokeBadge(uint256 tokenId) external onlyOwner {
        require(badges[tokenId].isActive, "Badge already inactive");
        badges[tokenId].isActive = false;
        emit BadgeRevoked(tokenId);
    }

    /**
     * @notice Soulbound check — prevent transfer between non-zero addresses
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) returns (address) {
        address from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0)) {
            revert("SentinelSecurityBadge: Token is soulbound and non-transferable");
        }
        return from;
    }

    // Required overrides
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
