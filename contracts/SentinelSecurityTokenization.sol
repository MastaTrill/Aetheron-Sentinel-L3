// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/**
 * @title SentinelSecurityTokenization
 * @notice Security Tokenization Platform - Tokenize audit reports, compliance certificates, and security assets
 */
contract SentinelSecurityTokenization is Ownable, ReentrancyGuard {
  // Security Asset types
  enum AssetType {
    AUDIT_REPORT,
    COMPLIANCE_CERTIFICATE,
    VULNERABILITY_RESEARCH,
    SECURITY_MONITORING_DATA,
    INSURANCE_POLICY,
    COMPLIANCE_FRAMEWORK
  }

  // ERC20 Security Token
  struct SecurityToken {
    address tokenAddress;
    string name;
    string symbol;
    uint256 totalSupply;
    address creator;
    AssetType assetType;
    uint256 issueDate;
    uint256 expiryDate;
    string metadataURI;
    bool isActive;
  }

  // ERC721 Security NFT
  struct SecurityNFT {
    uint256 tokenId;
    address creator;
    AssetType assetType;
    string title;
    string description;
    string metadataURI;
    uint256 issueDate;
    uint256 value; // USD value in cents
    bool isTransferable;
  }

  mapping(address => SecurityToken) public securityTokens;
  mapping(uint256 => SecurityNFT) public securityNFTs;
  mapping(uint256 => mapping(address => bool)) public nftAuthorizedHolders;

  address[] public activeTokens;
  uint256 public nextNFTId = 1;
  uint256 public platformFee = 500; // 5% fee (basis points)

  event SecurityTokenCreated(address indexed tokenAddress, string name, AssetType assetType);
  event SecurityNFTMinted(uint256 indexed tokenId, address indexed creator, AssetType assetType);
  event TokenTransferred(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amount
  );

  constructor() Ownable(msg.sender) {}

  /**
   * @notice Create ERC20 Security Token
   */
  function createSecurityToken(
    string memory name,
    string memory symbol,
    uint256 initialSupply,
    AssetType assetType,
    uint256 expiryDate,
    string memory metadataURI
  ) external payable nonReentrant returns (address) {
    require(msg.value >= platformFee, 'Insufficient platform fee');
    require(initialSupply > 0, 'Invalid supply');

    // Deploy new ERC20 token
    SecurityERC20 token = new SecurityERC20(name, symbol, initialSupply, msg.sender);

    address tokenAddress = address(token);

    securityTokens[tokenAddress] = SecurityToken({
      tokenAddress: tokenAddress,
      name: name,
      symbol: symbol,
      totalSupply: initialSupply,
      creator: msg.sender,
      assetType: assetType,
      issueDate: block.timestamp,
      expiryDate: expiryDate,
      metadataURI: metadataURI,
      isActive: true
    });

    activeTokens.push(tokenAddress);

    emit SecurityTokenCreated(tokenAddress, name, assetType);

    return tokenAddress;
  }

  /**
   * @notice Mint Security NFT
   */
  function mintSecurityNFT(
    AssetType assetType,
    string memory title,
    string memory description,
    string memory metadataURI,
    uint256 value,
    bool isTransferable
  ) external payable nonReentrant returns (uint256) {
    require(msg.value >= platformFee, 'Insufficient platform fee');

    uint256 tokenId = nextNFTId++;

    securityNFTs[tokenId] = SecurityNFT({
      tokenId: tokenId,
      creator: msg.sender,
      assetType: assetType,
      title: title,
      description: description,
      metadataURI: metadataURI,
      issueDate: block.timestamp,
      value: value,
      isTransferable: isTransferable
    });

    emit SecurityNFTMinted(tokenId, msg.sender, assetType);

    return tokenId;
  }

  /**
   * @notice Transfer security token
   */
  function transferSecurityToken(
    address tokenAddress,
    address to,
    uint256 amount
  ) external nonReentrant {
    SecurityToken memory token = securityTokens[tokenAddress];
    require(token.isActive, 'Token not active');
    require(token.expiryDate > block.timestamp, 'Token expired');

    // Transfer ERC20 tokens
    SecurityERC20(tokenAddress).transferFrom(msg.sender, to, amount);

    emit TokenTransferred(tokenAddress, msg.sender, to, amount);
  }

  /**
   * @notice Transfer security NFT (if transferable)
   */
  function transferSecurityNFT(uint256 tokenId, address) external nonReentrant {
    SecurityNFT storage nft = securityNFTs[tokenId];
    require(nft.creator == msg.sender, 'Not NFT owner');
    require(nft.isTransferable, 'NFT not transferable');
  }

  /**
   * @notice Authorize NFT holder
   */
  function authorizeNFTHolder(uint256 tokenId, address holder, bool authorized) external {
    SecurityNFT storage nft = securityNFTs[tokenId];
    require(nft.creator == msg.sender, 'Not NFT creator');

    nftAuthorizedHolders[tokenId][holder] = authorized;
  }

  /**
   * @notice Check NFT authorization
   */
  function isAuthorizedHolder(uint256 tokenId, address holder) external view returns (bool) {
    return nftAuthorizedHolders[tokenId][holder];
  }

  /**
   * @notice Redeem security asset value
   */
  function redeemSecurityAsset(address tokenAddress, uint256 amount) external nonReentrant {
    SecurityToken memory token = securityTokens[tokenAddress];
    require(token.isActive, 'Token not active');
    require(token.creator == msg.sender, 'Not token creator');

    // Burn tokens (simplified redemption)
    SecurityERC20(tokenAddress).burnFrom(msg.sender, amount);
  }

  /**
   * @notice Get token details
   */
  function getTokenDetails(address tokenAddress) external view returns (SecurityToken memory) {
    return securityTokens[tokenAddress];
  }

  /**
   * @notice Get NFT details
   */
  function getNFTDetails(
    uint256 tokenId
  )
    external
    view
    returns (
      address creator,
      AssetType assetType,
      string memory title,
      uint256 value,
      bool isTransferable
    )
  {
    SecurityNFT memory nft = securityNFTs[tokenId];
    return (nft.creator, nft.assetType, nft.title, nft.value, nft.isTransferable);
  }

  /**
   * @notice Get active security tokens
   */
  function getActiveTokens() external view returns (address[] memory) {
    return activeTokens;
  }

  /**
   * @notice Update platform fee
   */
  function setPlatformFee(uint256 newFee) external onlyOwner {
    require(newFee <= 1000, 'Fee cannot exceed 10%');
    platformFee = newFee;
  }

  /**
   * @notice Deactivate security token
   */
  function deactivateToken(address tokenAddress) external onlyOwner {
    securityTokens[tokenAddress].isActive = false;
  }

  /**
   * @notice Withdraw platform fees
   */
  function withdrawFees() external onlyOwner {
    payable(owner()).transfer(address(this).balance);
  }
}

/**
 * @title SecurityERC20
 * @notice ERC20 token for security assets
 */
contract SecurityERC20 is ERC20, Ownable {
  constructor(
    string memory name,
    string memory symbol,
    uint256 initialSupply,
    address creator
  ) ERC20(name, symbol) Ownable(creator) {
    _mint(creator, initialSupply);
  }

  function burnFrom(address account, uint256 amount) external onlyOwner {
    _burn(account, amount);
  }
}
