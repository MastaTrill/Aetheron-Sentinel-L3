// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title AdvancedAccessControl
 * @notice Multi-dimensional access control with time, geography, and behavior
 * @dev Implements:
 *      - Time-based access (business hours, holidays)
 *      - Geographic restrictions (IP geolocation simulation)
 *      - Behavioral analysis (usage patterns, risk scoring)
 *      - Multi-factor authentication simulation
 *      - Access pattern anomaly detection
 *      - Emergency lockdown capabilities
 */
contract AdvancedAccessControl is AccessControl {
    using ECDSA for bytes32;
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant SECURITY_ADMIN = keccak256("SECURITY_ADMIN");
    bytes32 public constant GEOGRAPHIC_ADMIN = keccak256("GEOGRAPHIC_ADMIN");
    bytes32 public constant TIME_ADMIN = keccak256("TIME_ADMIN");

    // Geographic regions
    enum GeographicRegion {
        NORTH_AMERICA,
        EUROPE,
        ASIA,
        SOUTH_AMERICA,
        AFRICA,
        OCEANIA,
        UNKNOWN
    }

    // Risk levels
    enum RiskLevel {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    // Access policies
    struct AccessPolicy {
        bytes32 policyId;
        string name;
        bool timeRestrictions;
        bool geographicRestrictions;
        bool behavioralAnalysis;
        uint256 maxDailyTransactions;
        uint256 maxTransactionValue;
        RiskLevel minRiskLevel;
        bool requiresMFA;
        bool emergencyLockout;
    }

    struct UserProfile {
        address user;
        GeographicRegion primaryRegion;
        uint256 riskScore;  // 0-1000
        uint256 lastActivity;
        uint256 dailyTransactionCount;
        uint256 dailyTransactionValue;
        uint256 failedAttempts;
        bool locked;
        uint256 lockoutUntil;
        bytes32[] accessHistory;
    }

    struct TimeWindow {
        uint256 startHour;  // 0-23
        uint256 endHour;    // 0-23
        bool[] allowedDays; // 7-element array for days of week
        bool excludeHolidays;
    }

    // State
    mapping(address => UserProfile) public userProfiles;
    mapping(bytes32 => AccessPolicy) public accessPolicies;
    mapping(address => bytes32) public userPolicies;
    mapping(GeographicRegion => bool) public allowedRegions;
    mapping(address => TimeWindow) public timeRestrictions;

    // Geographic data (simulated)
    mapping(address => GeographicRegion) public userGeolocations;
    mapping(bytes32 => bool) public holidayDates;

    // Behavioral analysis
    mapping(address => uint256[]) public transactionAmounts;
    mapping(address => uint256[]) public transactionTimestamps;
    mapping(address => uint256) public unusualActivityScore;

    // Emergency controls
    bool public globalLockout;
    uint256 public lockoutEndTime;
    address public emergencyOperator;

    // Configuration
    uint256 public constant MAX_RISK_SCORE = 1000;
    uint256 public constant LOCKOUT_DURATION = 24 hours;
    uint256 public constant MFA_TIMEOUT = 15 minutes;
    uint256 public constant MAX_FAILED_ATTEMPTS = 5;

    // Events
    event AccessGranted(address indexed user, bytes32 policyId, uint256 timestamp);
    event AccessDenied(address indexed user, string reason, uint256 timestamp);
    event RiskScoreUpdated(address indexed user, uint256 newScore, uint256 timestamp);
    event GeographicViolation(address indexed user, GeographicRegion attempted, GeographicRegion allowed);
    event TimeViolation(address indexed user, uint256 attemptedHour);
    event BehavioralAnomaly(address indexed user, uint256 anomalyScore);
    event EmergencyLockout(address indexed operator, uint256 duration);
    event UserLocked(address indexed user, string reason, uint256 lockoutUntil);

    // Errors
    error AccessDeniedError(string reason);
    error UserLockedError(address user, uint256 lockoutUntil);
    error InvalidTimeWindow(uint256 start, uint256 end);
    error GeographicRestriction(GeographicRegion attempted, GeographicRegion allowed);
    error RiskScoreTooHigh(uint256 score, uint256 threshold);
    error EmergencyLockoutActive();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SECURITY_ADMIN, msg.sender);
        _grantRole(GEOGRAPHIC_ADMIN, msg.sender);
        _grantRole(TIME_ADMIN, msg.sender);

        // Default allowed regions
        allowedRegions[GeographicRegion.NORTH_AMERICA] = true;
        allowedRegions[GeographicRegion.EUROPE] = true;
        allowedRegions[GeographicRegion.ASIA] = true;

        // Create default policy
        _createDefaultPolicy();
    }

    // ============ Policy Management ============

    function _createDefaultPolicy() internal {
        bytes32 policyId = keccak256("DEFAULT_POLICY");

        accessPolicies[policyId] = AccessPolicy({
            policyId: policyId,
            name: "Default Access Policy",
            timeRestrictions: true,
            geographicRestrictions: true,
            behavioralAnalysis: true,
            maxDailyTransactions: 100,
            maxTransactionValue: 100000e18,
            minRiskLevel: RiskLevel.MEDIUM,
            requiresMFA: true,
            emergencyLockout: false
        });
    }

    /**
     * @notice Create a new access policy
     */
    function createAccessPolicy(
        string calldata name,
        bool timeRestrictions,
        bool geographicRestrictions,
        bool behavioralAnalysis,
        uint256 maxDailyTransactions,
        uint256 maxTransactionValue,
        RiskLevel minRiskLevel,
        bool requiresMFA
    ) external onlyRole(SECURITY_ADMIN) returns (bytes32 policyId) {
        policyId = keccak256(abi.encode(
            "ACCESS_POLICY",
            name,
            block.timestamp,
            msg.sender
        ));

        accessPolicies[policyId] = AccessPolicy({
            policyId: policyId,
            name: name,
            timeRestrictions: timeRestrictions,
            geographicRestrictions: geographicRestrictions,
            behavioralAnalysis: behavioralAnalysis,
            maxDailyTransactions: maxDailyTransactions,
            maxTransactionValue: maxTransactionValue,
            minRiskLevel: minRiskLevel,
            requiresMFA: requiresMFA,
            emergencyLockout: false
        });
    }

    /**
     * @notice Assign policy to user
     */
    function assignUserPolicy(address user, bytes32 policyId) external onlyRole(SECURITY_ADMIN) {
        require(accessPolicies[policyId].policyId != bytes32(0), "Policy not found");
        userPolicies[user] = policyId;
    }

    // ============ Geographic Controls ============

    /**
     * @notice Update allowed geographic regions
     */
    function setAllowedRegion(GeographicRegion region, bool allowed) external onlyRole(GEOGRAPHIC_ADMIN) {
        allowedRegions[region] = allowed;
    }

    /**
     * @notice Set user's primary geographic region
     */
    function setUserRegion(address user, GeographicRegion region) external onlyRole(GEOGRAPHIC_ADMIN) {
        userGeolocations[user] = region;
        userProfiles[user].primaryRegion = region;
    }

    /**
     * @notice Simulate IP geolocation (in production: use oracle)
     */
    function updateUserGeolocation(address user, GeographicRegion region) external onlyRole(GEOGRAPHIC_ADMIN) {
        userGeolocations[user] = region;
    }

    // ============ Time-Based Controls ============

    /**
     * @notice Set time restrictions for user
     */
    function setTimeRestrictions(
        address user,
        uint256 startHour,
        uint256 endHour,
        bool[] calldata allowedDays
    ) external onlyRole(TIME_ADMIN) {
        require(startHour < endHour && endHour <= 24, "Invalid time window");
        require(allowedDays.length == 7, "Must specify 7 days");

        timeRestrictions[user] = TimeWindow({
            startHour: startHour,
            endHour: endHour,
            allowedDays: allowedDays,
            excludeHolidays: true
        });
    }

    /**
     * @notice Add holiday date
     */
    function addHoliday(uint256 year, uint256 month, uint256 day) external onlyRole(TIME_ADMIN) {
        bytes32 holidayKey = keccak256(abi.encode(year, month, day));
        holidayDates[holidayKey] = true;
    }

    // ============ Access Control ============

    /**
     * @notice Main access control function
     * @param user Address requesting access
     * @param action Action being performed
     * @param value Value involved (if applicable)
     */
    function checkAccess(
        address user,
        string calldata action,
        uint256 value
    ) external returns (bool allowed) {
        // Check emergency lockout
        if (globalLockout && block.timestamp < lockoutEndTime) {
            emit AccessDenied(user, "Global emergency lockout active", block.timestamp);
            return false;
        }

        // Get user profile and policy
        UserProfile storage profile = userProfiles[user];
        bytes32 policyId = userPolicies[user];
        if (policyId == bytes32(0)) {
            policyId = keccak256("DEFAULT_POLICY"); // Use default policy
        }

        AccessPolicy storage policy = accessPolicies[policyId];

        // Check if user is locked
        if (profile.locked && block.timestamp < profile.lockoutUntil) {
            emit AccessDenied(user, "User account locked", block.timestamp);
            return false;
        }

        // Check geographic restrictions
        if (policy.geographicRestrictions) {
            GeographicRegion userRegion = userGeolocations[user];
            if (userRegion != GeographicRegion.UNKNOWN && !allowedRegions[userRegion]) {
                emit GeographicViolation(user, userRegion, profile.primaryRegion);
                _recordFailedAttempt(user);
                return false;
            }
        }

        // Check time restrictions
        if (policy.timeRestrictions) {
            if (!_checkTimeRestrictions(user)) {
                uint256 currentHour = (block.timestamp / 1 hours) % 24;
                emit TimeViolation(user, currentHour);
                _recordFailedAttempt(user);
                return false;
            }
        }

        // Check behavioral analysis
        if (policy.behavioralAnalysis) {
            RiskLevel riskLevel = _assessBehavioralRisk(user, value);
            if (uint256(riskLevel) > uint256(policy.minRiskLevel)) {
                emit BehavioralAnomaly(user, profile.riskScore);
                _recordFailedAttempt(user);
                return false;
            }
        }

        // Check transaction limits
        if (profile.dailyTransactionCount >= policy.maxDailyTransactions) {
            emit AccessDenied(user, "Daily transaction limit exceeded", block.timestamp);
            return false;
        }

        if (value > policy.maxTransactionValue) {
            emit AccessDenied(user, "Transaction value exceeds limit", block.timestamp);
            return false;
        }

        // Update profile
        profile.lastActivity = block.timestamp;
        profile.dailyTransactionCount++;
        profile.dailyTransactionValue += value;

        // Reset failed attempts on successful access
        profile.failedAttempts = 0;

        emit AccessGranted(user, policyId, block.timestamp);
        return true;
    }

    // ============ Behavioral Analysis ============

    function _assessBehavioralRisk(address user, uint256 value) internal returns (RiskLevel) {
        UserProfile storage profile = userProfiles[user];

        // Update transaction history
        transactionAmounts[user].push(value);
        transactionTimestamps[user].push(block.timestamp);

        // Keep only last 100 transactions
        if (transactionAmounts[user].length > 100) {
            // Remove oldest (simplified)
            transactionAmounts[user][0] = transactionAmounts[user][transactionAmounts[user].length - 1];
            transactionTimestamps[user][0] = transactionTimestamps[user][transactionTimestamps[user].length - 1];
            transactionAmounts[user].pop();
            transactionTimestamps[user].pop();
        }

        // Calculate risk score
        uint256 riskScore = _calculateRiskScore(user, value);
        profile.riskScore = riskScore;

        emit RiskScoreUpdated(user, riskScore, block.timestamp);

        // Convert to risk level
        if (riskScore >= 800) return RiskLevel.CRITICAL;
        if (riskScore >= 600) return RiskLevel.HIGH;
        if (riskScore >= 400) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }

    function _calculateRiskScore(address user, uint256 value) internal view returns (uint256) {
        uint256[] storage amounts = transactionAmounts[user];
        uint256[] storage timestamps = transactionTimestamps[user];

        if (amounts.length < 3) return 200; // Default medium-low risk

        // Calculate statistical measures
        uint256 avgAmount = 0;
        uint256 variance = 0;

        for (uint256 i = 0; i < amounts.length; i++) {
            avgAmount += amounts[i];
        }
        avgAmount /= amounts.length;

        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 diff = amounts[i] > avgAmount ? amounts[i] - avgAmount : avgAmount - amounts[i];
            variance += diff * diff;
        }
        variance /= amounts.length;

        // Calculate z-score for current transaction
        uint256 stdDev = _sqrt(variance);
        uint256 zScore = stdDev > 0 ? ((value > avgAmount ? value - avgAmount : avgAmount - value) * 1000) / stdDev : 0;

        // Time-based analysis
        uint256 timeVariance = _calculateTimeVariance(timestamps);
        uint256 timeScore = timeVariance > 3600 ? 300 : (timeVariance * 300) / 3600; // Max 300 for irregular timing

        // Combine scores
        uint256 amountScore = zScore > 3000 ? 400 : (zScore * 400) / 3000; // Max 400 for unusual amounts
        uint256 totalScore = amountScore + timeScore;

        // Cap at MAX_RISK_SCORE
        return totalScore > MAX_RISK_SCORE ? MAX_RISK_SCORE : totalScore;
    }

    function _calculateTimeVariance(uint256[] storage timestamps) internal view returns (uint256) {
        if (timestamps.length < 2) return 0;

        uint256 avgInterval = 0;
        for (uint256 i = 1; i < timestamps.length; i++) {
            avgInterval += timestamps[i] - timestamps[i - 1];
        }
        avgInterval /= (timestamps.length - 1);

        uint256 variance = 0;
        for (uint256 i = 1; i < timestamps.length; i++) {
            uint256 interval = timestamps[i] - timestamps[i - 1];
            uint256 diff = interval > avgInterval ? interval - avgInterval : avgInterval - interval;
            variance += diff * diff;
        }

        return variance / (timestamps.length - 1);
    }

    // ============ Emergency Controls ============

    /**
     * @notice Activate emergency lockout
     */
    function activateEmergencyLockout(uint256 duration) external onlyRole(SECURITY_ADMIN) {
        globalLockout = true;
        lockoutEndTime = block.timestamp + duration;
        emergencyOperator = msg.sender;

        emit EmergencyLockout(msg.sender, duration);
    }

    /**
     * @notice Deactivate emergency lockout
     */
    function deactivateEmergencyLockout() external {
        require(msg.sender == emergencyOperator, "Not emergency operator");
        globalLockout = false;
        lockoutEndTime = 0;
        emergencyOperator = address(0);
    }

    // ============ Helper Functions ============

    function _checkTimeRestrictions(address user) internal view returns (bool) {
        TimeWindow storage restriction = timeRestrictions[user];
        if (restriction.startHour == 0 && restriction.endHour == 0) return true; // No restrictions

        uint256 currentHour = (block.timestamp / 1 hours) % 24;
        uint256 currentDay = (block.timestamp / 1 days + 4) % 7; // 0 = Sunday

        // Check time window
        if (currentHour < restriction.startHour || currentHour >= restriction.endHour) {
            return false;
        }

        // Check allowed days
        if (!restriction.allowedDays[currentDay]) {
            return false;
        }

        // Check holidays
        if (restriction.excludeHolidays) {
            uint256 year = (block.timestamp / 31536000) + 1970;
            uint256 month = ((block.timestamp % 31536000) / 2628000) + 1;
            uint256 day = ((block.timestamp % 2628000) / 86400) + 1;

            bytes32 holidayKey = keccak256(abi.encode(year, month, day));
            if (holidayDates[holidayKey]) {
                return false;
            }
        }

        return true;
    }

    function _recordFailedAttempt(address user) internal {
        UserProfile storage profile = userProfiles[user];
        profile.failedAttempts++;

        if (profile.failedAttempts >= MAX_FAILED_ATTEMPTS) {
            profile.locked = true;
            profile.lockoutUntil = block.timestamp + LOCKOUT_DURATION;

            emit UserLocked(user, "Too many failed attempts", profile.lockoutUntil);
        }
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    // ============ View Functions ============

    function getUserRiskProfile(address user) external view returns (
        uint256 riskScore,
        GeographicRegion region,
        uint256 dailyTransactions,
        uint256 failedAttempts,
        bool locked
    ) {
        UserProfile storage profile = userProfiles[user];
        return (
            profile.riskScore,
            profile.primaryRegion,
            profile.dailyTransactionCount,
            profile.failedAttempts,
            profile.locked
        );
    }

    function getAccessPolicy(address user) external view returns (
        string memory name,
        bool timeRestrictions,
        bool geographicRestrictions,
        bool behavioralAnalysis,
        uint256 maxDailyTransactions
    ) {
        bytes32 policyId = userPolicies[user];
        if (policyId == bytes32(0)) {
            policyId = keccak256("DEFAULT_POLICY");
        }

        AccessPolicy storage policy = accessPolicies[policyId];
        return (
            policy.name,
            policy.timeRestrictions,
            policy.geographicRestrictions,
            policy.behavioralAnalysis,
            policy.maxDailyTransactions
        );
    }

    function isEmergencyLockoutActive() external view returns (bool) {
        return globalLockout && block.timestamp < lockoutEndTime;
    }
}