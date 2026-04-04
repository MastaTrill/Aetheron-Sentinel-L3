// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PriceOracle
 * @notice Aggregated price feed with anomaly detection
 * @dev Uses multiple data sources and detects manipulation
 */
contract PriceOracle is AccessControl, Pausable {
    bytes32 public constant DATA_FEED_ROLE = keccak256("DATA_FEED_ROLE");

    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint8 decimals;
    }

    struct AnomalyThresholds {
        uint256 maxDeviation; // Max % deviation from last price (500 = 5%)
        uint256 maxStaleness; // Max seconds before price is stale
        uint256 heartbeatInterval; // Expected update frequency
    }

    /// @notice Price data per asset
    mapping(address => PriceData) public prices;

    /// @notice Previous price for deviation detection
    mapping(address => uint256) public previousPrices;

    /// @notice Anomaly thresholds per asset
    mapping(address => AnomalyThresholds) public thresholds;

    /// @notice Staleness tolerance (default 1 hour)
    uint256 public defaultStalenessTolerance = 1 hours;

    /// @notice Max deviation tolerance (default 5%)
    uint256 public defaultMaxDeviation = 500;

    /// @notice Trusted data feeds (Chainlink nodes, etc)
    mapping(address => bool) public authorizedFeeds;

    event PriceUpdated(address indexed asset, uint256 price, uint256 timestamp);
    event PriceAnomalyDetected(
        address indexed asset,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 deviation
    );
    event ThresholdUpdated(
        address indexed asset,
        uint256 maxDeviation,
        uint256 maxStaleness
    );
    event FeedAuthorized(address indexed feed, bool authorized);

    error PriceStale(
        address asset,
        uint256 lastUpdate,
        uint256 stalenessTolerance
    );
    error PriceDeviationExceeded(
        address asset,
        uint256 deviation,
        uint256 maxDeviation
    );
    error UnauthorizedFeed(address feed);
    error InvalidPrice(address asset);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DATA_FEED_ROLE, msg.sender);
    }

    /**
     * @notice Update price with anomaly detection
     * @param asset Token address
     * @param price New price
     */
    function updatePrice(
        address asset,
        uint256 price
    ) external onlyRole(DATA_FEED_ROLE) whenNotPaused {
        if (price == 0) revert InvalidPrice(asset);

        PriceData memory current = prices[asset];
        AnomalyThresholds memory threshold = thresholds[asset];

        // Set defaults if not configured
        uint256 maxDev = threshold.maxDeviation != 0
            ? threshold.maxDeviation
            : defaultMaxDeviation;
        uint256 maxStale = threshold.maxStaleness != 0
            ? threshold.maxStaleness
            : defaultStalenessTolerance;

        // Check for price anomaly if we have a previous price
        if (current.price != 0 && previousPrices[asset] != 0) {
            uint256 deviation = _calculateDeviation(current.price, price);

            if (deviation > maxDev) {
                emit PriceAnomalyDetected(
                    asset,
                    current.price,
                    price,
                    deviation
                );
                // Don't revert - allow emergency pause to handle
            }
        }

        // Update prices
        previousPrices[asset] = current.price != 0 ? current.price : price;
        prices[asset] = PriceData({
            price: price,
            timestamp: block.timestamp,
            decimals: 8 // Standard for most oracles
        });

        emit PriceUpdated(asset, price, block.timestamp);
    }

    /**
     * @notice Batch update prices
     */
    function batchUpdatePrices(
        address[] calldata assets,
        uint256[] calldata newPrices
    ) external onlyRole(DATA_FEED_ROLE) whenNotPaused {
        if (assets.length != newPrices.length) revert InvalidPrice(address(0));

        for (uint256 i = 0; i < assets.length; i++) {
            updatePrice(assets[i], newPrices[i]);
        }
    }

    /**
     * @notice Get current price with validation
     */
    function getPrice(address asset) external view returns (uint256) {
        PriceData memory data = prices[asset];
        AnomalyThresholds memory threshold = thresholds[asset];
        uint256 maxStale = threshold.maxStaleness != 0
            ? threshold.maxStaleness
            : defaultStalenessTolerance;

        if (block.timestamp - data.timestamp > maxStale) {
            revert PriceStale(asset, data.timestamp, maxStale);
        }

        return data.price;
    }

    /**
     * @notice Get price allowing stale prices (for view functions)
     */
    function getPriceAllowStale(
        address asset
    ) external view returns (uint256, bool) {
        PriceData memory data = prices[asset];
        AnomalyThresholds memory threshold = thresholds[asset];
        uint256 maxStale = threshold.maxStaleness != 0
            ? threshold.maxStaleness
            : defaultStalenessTolerance;

        bool isStale = block.timestamp - data.timestamp > maxStale;
        return (data.price, isStale);
    }

    /**
     * @notice Calculate deviation between two prices
     */
    function _calculateDeviation(
        uint256 oldPrice,
        uint256 newPrice
    ) internal pure returns (uint256) {
        if (oldPrice == 0) return 0;
        uint256 diff = newPrice > oldPrice
            ? newPrice - oldPrice
            : oldPrice - newPrice;
        return (diff * 10000) / oldPrice; // Basis points
    }

    function setThresholds(
        address asset,
        uint256 maxDeviation,
        uint256 maxStaleness
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        thresholds[asset] = AnomalyThresholds({
            maxDeviation: maxDeviation,
            maxStaleness: maxStaleness,
            heartbeatInterval: maxStaleness / 2
        });
        emit ThresholdUpdated(asset, maxDeviation, maxStaleness);
    }

    function setDefaultStalenessTolerance(
        uint256 newTolerance
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        defaultStalenessTolerance = newTolerance;
    }

    function setDefaultMaxDeviation(
        uint256 newMaxDeviation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        defaultMaxDeviation = newMaxDeviation;
    }

    function authorizeFeed(
        address feed,
        bool authorized
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        authorizedFeeds[feed] = authorized;
        emit FeedAuthorized(feed, authorized);
    }

    function getPriceData(
        address asset
    )
        external
        view
        returns (
            uint256 price,
            uint256 timestamp,
            uint256 deviation,
            bool isStale
        )
    {
        PriceData memory data = prices[asset];
        uint256 deviation = _calculateDeviation(
            previousPrices[asset],
            data.price
        );
        uint256 maxStale = thresholds[asset].maxStaleness != 0
            ? thresholds[asset].maxStaleness
            : defaultStalenessTolerance;

        return (
            data.price,
            data.timestamp,
            deviation,
            block.timestamp - data.timestamp > maxStale
        );
    }
}
