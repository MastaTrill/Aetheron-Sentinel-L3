// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SentinelAPIMarketplace
 * @notice Marketplace for trading security data, threat intelligence, and monitoring services
 */
contract SentinelAPIMarketplace is Ownable, ReentrancyGuard {
    IERC20 public immutable paymentToken; // AETH token

    // Data listing structure
    struct DataListing {
        uint256 listingId;
        address provider;
        string dataType; // "threat-intelligence", "contract-audit", "monitoring-feed"
        string title;
        string description;
        uint256 price; // Price in AETH (wei)
        uint256 validityPeriod; // How long data is valid (seconds)
        bool isActive;
        uint256 totalSales;
        uint256 rating; // Average rating out of 100
        uint256 reviewCount;
    }

    // Purchase record
    struct DataPurchase {
        uint256 purchaseId;
        uint256 listingId;
        address buyer;
        uint256 purchasePrice;
        uint256 purchaseTime;
        uint256 expiryTime;
        bool isActive;
        string accessToken; // Encrypted access token
    }

    // Review structure
    struct Review {
        address reviewer;
        uint256 rating; // 1-5 stars
        string comment;
        uint256 timestamp;
    }

    mapping(uint256 => DataListing) public listings;
    mapping(uint256 => DataPurchase[]) public listingPurchases;
    mapping(uint256 => Review[]) public listingReviews;
    mapping(address => uint256[]) public providerListings;
    mapping(address => uint256[]) public buyerPurchases;
    mapping(string => bool) public validAccessTokens;

    uint256 public nextListingId = 1;
    uint256 public nextPurchaseId = 1;
    uint256 public platformFee = 500; // 5% platform fee (basis points)
    uint256 public totalVolume;

    event ListingCreated(uint256 indexed listingId, address indexed provider, string dataType);
    event DataPurchased(uint256 indexed purchaseId, uint256 indexed listingId, address indexed buyer);
    event ReviewSubmitted(uint256 indexed listingId, address indexed reviewer, uint256 rating);
    event ListingUpdated(uint256 indexed listingId, uint256 newPrice);

    constructor(address _paymentToken) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
    }

    /**
     * @notice Create a new data listing
     */
    function createListing(
        string memory dataType,
        string memory title,
        string memory description,
        uint256 price,
        uint256 validityPeriod
    ) external returns (uint256) {
        require(price > 0, "Price must be greater than 0");
        require(validityPeriod > 0, "Validity period must be greater than 0");

        uint256 listingId = nextListingId++;

        listings[listingId] = DataListing({
            listingId: listingId,
            provider: msg.sender,
            dataType: dataType,
            title: title,
            description: description,
            price: price,
            validityPeriod: validityPeriod,
            isActive: true,
            totalSales: 0,
            rating: 0,
            reviewCount: 0
        });

        providerListings[msg.sender].push(listingId);

        emit ListingCreated(listingId, msg.sender, dataType);

        return listingId;
    }

    /**
     * @notice Purchase data access
     */
    function purchaseData(uint256 listingId) external nonReentrant returns (uint256) {
        DataListing storage listing = listings[listingId];
        require(listing.isActive, "Listing is not active");
        require(listing.provider != msg.sender, "Cannot purchase own listing");

        uint256 platformFeeAmount = (listing.price * platformFee) / 10000;
        uint256 providerAmount = listing.price - platformFeeAmount;

        // Transfer payment
        require(paymentToken.transferFrom(msg.sender, address(this), listing.price), "Payment transfer failed");

        // Generate access token
        string memory accessToken = _generateAccessToken(listingId, msg.sender);

        uint256 purchaseId = nextPurchaseId++;

        DataPurchase memory purchase = DataPurchase({
            purchaseId: purchaseId,
            listingId: listingId,
            buyer: msg.sender,
            purchasePrice: listing.price,
            purchaseTime: block.timestamp,
            expiryTime: block.timestamp + listing.validityPeriod,
            isActive: true,
            accessToken: accessToken
        });

        listingPurchases[listingId].push(purchase);
        buyerPurchases[msg.sender].push(purchaseId);

        // Update listing stats
        listing.totalSales++;
        totalVolume += listing.price;

        // Distribute payments
        require(paymentToken.transfer(listing.provider, providerAmount), "Provider payment failed");
        require(paymentToken.transfer(owner(), platformFeeAmount), "Platform fee transfer failed");

        emit DataPurchased(purchaseId, listingId, msg.sender);

        return purchaseId;
    }

    /**
     * @notice Submit review for purchased data
     */
    function submitReview(uint256 listingId, uint256 rating, string memory comment) external {
        require(rating >= 1 && rating <= 5, "Rating must be between 1 and 5");

        // Verify buyer purchased this listing
        bool hasPurchased = false;
        DataPurchase[] memory purchases = listingPurchases[listingId];
        for (uint256 i = 0; i < purchases.length; i++) {
            if (purchases[i].buyer == msg.sender && purchases[i].isActive) {
                hasPurchased = true;
                break;
            }
        }
        require(hasPurchased, "Must have purchased this listing to review");

        Review memory review =
            Review({reviewer: msg.sender, rating: rating, comment: comment, timestamp: block.timestamp});

        listingReviews[listingId].push(review);

        // Update listing rating
        _updateListingRating(listingId);

        emit ReviewSubmitted(listingId, msg.sender, rating);
    }

    /**
     * @notice Update listing price
     */
    function updateListingPrice(uint256 listingId, uint256 newPrice) external {
        DataListing storage listing = listings[listingId];
        require(listing.provider == msg.sender, "Not the listing provider");
        require(newPrice > 0, "Price must be greater than 0");

        listing.price = newPrice;

        emit ListingUpdated(listingId, newPrice);
    }

    /**
     * @notice Deactivate listing
     */
    function deactivateListing(uint256 listingId) external {
        DataListing storage listing = listings[listingId];
        require(listing.provider == msg.sender, "Not the listing provider");

        listing.isActive = false;
    }

    /**
     * @notice Get listing details
     */
    function getListing(uint256 listingId) external view returns (DataListing memory) {
        return listings[listingId];
    }

    /**
     * @notice Get user's purchases
     */
    function getUserPurchases(address user) external view returns (DataPurchase[] memory) {
        uint256[] memory purchaseIds = buyerPurchases[user];
        DataPurchase[] memory purchases = new DataPurchase[](purchaseIds.length);

        for (uint256 i = 0; i < purchaseIds.length; i++) {
            // This is simplified - in practice, you'd need to track purchases differently
            purchases[i] = DataPurchase({
                purchaseId: purchaseIds[i],
                listingId: 0,
                buyer: user,
                purchasePrice: 0,
                purchaseTime: 0,
                expiryTime: 0,
                isActive: true,
                accessToken: ""
            });
        }

        return purchases;
    }

    /**
     * @notice Verify access token
     */
    function verifyAccessToken(string memory token) external view returns (bool) {
        return validAccessTokens[token];
    }

    /**
     * @notice Get marketplace statistics
     */
    function getMarketStats()
        external
        view
        returns (uint256 totalListings, uint256 activeListings, uint256 totalVolume_, uint256 totalReviews)
    {
        uint256 activeCount = 0;
        uint256 reviewCount = 0;

        for (uint256 i = 1; i < nextListingId; i++) {
            if (listings[i].isActive) activeCount++;
            reviewCount += listings[i].reviewCount;
        }

        return (nextListingId - 1, activeCount, totalVolume, reviewCount);
    }

    /**
     * @dev Generate access token
     */
    function _generateAccessToken(uint256 listingId, address buyer) internal returns (string memory) {
        string memory token = string(
            abi.encodePacked(
                "access-",
                Strings.toString(listingId),
                "-",
                Strings.toHexString(uint160(buyer)),
                "-",
                Strings.toString(block.timestamp)
            )
        );

        validAccessTokens[token] = true;
        return token;
    }

    /**
     * @dev Update listing rating
     */
    function _updateListingRating(uint256 listingId) internal {
        Review[] memory reviews = listingReviews[listingId];
        if (reviews.length == 0) return;

        uint256 totalRating = 0;
        for (uint256 i = 0; i < reviews.length; i++) {
            totalRating += reviews[i].rating * 20; // Convert 1-5 to 20-100 scale
        }

        listings[listingId].rating = totalRating / reviews.length;
        listings[listingId].reviewCount = reviews.length;
    }

    /**
     * @notice Set platform fee
     */
    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee cannot exceed 10%");
        platformFee = newFee;
    }

    /**
     * @notice Withdraw platform fees
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = paymentToken.balanceOf(address(this));
        require(paymentToken.transfer(owner(), balance), "Transfer failed");
    }
}

// Helper for string conversion
library Strings {
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function toHexString(uint160 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 4;
        }
        uint256 lengthMod = length % 2;
        uint256 lengthDiv2 = length / 2;
        length = lengthDiv2 + lengthMod;

        bytes memory buffer = new bytes(2 + 2 * length);
        buffer[0] = "0";
        buffer[1] = "x";
        uint256 index = 2 + 2 * length - 1;
        while (value != 0) {
            buffer[index] = bytes1(uint8(48 + uint256(value & 0xf)));
            if (buffer[index] > "9") {
                buffer[index] = bytes1(uint8(97 + uint256(value & 0xf) - 10));
            }
            value >>= 4;
            index--;
        }
        for (uint256 i = 2 + 2 * length - length * 2; i < 2 + 2 * length; i++) {
            buffer[i] = "0";
        }
        return string(buffer);
    }
}
