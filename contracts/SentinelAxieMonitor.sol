// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title SentinelAxieMonitor
 * @notice NFT gaming security for Axie Infinity ecosystem
 * Monitors marketplace transactions and breeding activities
 */
contract SentinelAxieMonitor is Ownable {
    // Axie contract addresses (mainnet)
    address public constant AXIE_CONTRACT = 0x32950db2a7164aE833121501C797D79E7B79d74C;
    address public constant MARKETPLACE_CONTRACT = 0x213073989821F458169832D24d8c97c0Af3C9A0b;
    string public constant BREEDING_CONTRACT = "";

    // Security thresholds
    uint256 public constant HIGH_VALUE_THRESHOLD = 100 ether; // 100 AXS
    uint256 public constant SUSPICIOUS_VOLUME_THRESHOLD = 10; // Axies per hour
    uint256 public constant BREEDING_LIMIT = 7; // Max breeding per Axie

    struct AxieTransaction {
        address seller;
        address buyer;
        uint256 axieId;
        uint256 price;
        uint256 timestamp;
        TransactionType txType;
    }

    struct BreedingRecord {
        uint256 axieId;
        uint256 breedingCount;
        uint256 lastBreedingTime;
        address breeder;
    }

    enum TransactionType {
        SALE,
        BREEDING,
        TRANSFER
    }

    mapping(uint256 => AxieTransaction[]) public axieTransactions;
    mapping(uint256 => BreedingRecord) public breedingRecords;
    mapping(address => uint256) public userActivityCount;
    mapping(bytes32 => bool) public flaggedTransactions;

    event SuspiciousTransaction(uint256 indexed axieId, address indexed seller, uint256 price, string reason);

    event BreedingAnomaly(uint256 indexed axieId, address indexed breeder, uint256 breedingCount, string anomalyType);

    event MarketplaceAlert(address indexed user, uint256 activityCount, string alertType);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Monitor marketplace transaction
     */
    function monitorTransaction(address seller, address buyer, uint256 axieId, uint256 price) external {
        AxieTransaction memory axieTx = AxieTransaction({
            seller: seller,
            buyer: buyer,
            axieId: axieId,
            price: price,
            timestamp: block.timestamp,
            txType: TransactionType.SALE
        });

        axieTransactions[axieId].push(axieTx);

        // Check for suspicious patterns
        _analyzeTransaction(axieTx);

        // Update user activity
        userActivityCount[seller]++;
        userActivityCount[buyer]++;

        // Check for high activity users
        if (userActivityCount[seller] > SUSPICIOUS_VOLUME_THRESHOLD) {
            emit MarketplaceAlert(seller, userActivityCount[seller], "HighVolumeSeller");
        }
        if (userActivityCount[buyer] > SUSPICIOUS_VOLUME_THRESHOLD) {
            emit MarketplaceAlert(buyer, userActivityCount[buyer], "HighVolumeBuyer");
        }
    }

    /**
     * @notice Monitor breeding activity
     */
    function monitorBreeding(
        uint256 axieId,
        address breeder,
        uint256 /*fee*/
    )
        external
    {
        BreedingRecord storage record = breedingRecords[axieId];
        record.axieId = axieId;
        record.breedingCount++;
        record.lastBreedingTime = block.timestamp;
        record.breeder = breeder;

        // Check breeding limits
        if (record.breedingCount > BREEDING_LIMIT) {
            emit BreedingAnomaly(axieId, breeder, record.breedingCount, "ExcessiveBreeding");
        }

        // Check for rapid breeding
        if (record.breedingCount > 1 && block.timestamp - record.lastBreedingTime < 3600) {
            emit BreedingAnomaly(axieId, breeder, record.breedingCount, "RapidBreeding");
        }
    }

    /**
     * @notice Report stolen Axie
     */
    function reportStolenAxie(
        uint256 axieId,
        bytes memory /*evidence*/
    )
        external
    {
        // Mark Axie as flagged
        bytes32 txHash = keccak256(abi.encodePacked(axieId, block.timestamp));
        flaggedTransactions[txHash] = true;

        // Get current owner
        address currentOwner = IERC721(AXIE_CONTRACT).ownerOf(axieId);

        emit SuspiciousTransaction(axieId, currentOwner, 0, "ReportedStolen");
    }

    /**
     * @notice Check if transaction is flagged
     */
    function isTransactionFlagged(bytes32 txHash) external view returns (bool) {
        return flaggedTransactions[txHash];
    }

    /**
     * @notice Get Axie transaction history
     */
    function getAxieHistory(uint256 axieId) external view returns (AxieTransaction[] memory) {
        return axieTransactions[axieId];
    }

    /**
     * @notice Get breeding record
     */
    function getBreedingRecord(uint256 axieId)
        external
        view
        returns (uint256 breedingCount, uint256 lastBreedingTime, address breeder)
    {
        BreedingRecord memory record = breedingRecords[axieId];
        return (record.breedingCount, record.lastBreedingTime, record.breeder);
    }

    /**
     * @notice Emergency pause marketplace monitoring
     */
    function emergencyPause() external onlyOwner {
        // Implementation would pause monitoring functions
    }

    /**
     * @dev Analyze transaction for suspicious patterns
     */
    function _analyzeTransaction(AxieTransaction memory axieTx) internal {
        // Check for high-value transactions
        if (axieTx.price > HIGH_VALUE_THRESHOLD) {
            emit SuspiciousTransaction(axieTx.axieId, axieTx.seller, axieTx.price, "HighValueTransaction");
        }

        // Check for unusual price patterns
        AxieTransaction[] memory history = axieTransactions[axieTx.axieId];
        if (history.length > 1) {
            AxieTransaction memory lastTx = history[history.length - 2];
            uint256 priceChange = axieTx.price > lastTx.price
                ? ((axieTx.price - lastTx.price) * 100) / lastTx.price
                : ((lastTx.price - axieTx.price) * 100) / axieTx.price;

            if (priceChange > 200) {
                // 200% price change
                emit SuspiciousTransaction(axieTx.axieId, axieTx.seller, axieTx.price, "ExtremePriceChange");
            }
        }
    }

    /**
     * @notice Get marketplace statistics
     */
    function getMarketplaceStats()
        external
        pure
        returns (uint256 totalTransactions, uint256, /* flaggedTransactions */ uint256 activeUsers)
    {
        // Simplified statistics
        return (0, 0, 0); // Would need proper tracking
    }
}
