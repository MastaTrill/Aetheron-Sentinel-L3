// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title DynamicAccessControl
 * @notice Context-aware Attribute-Based Access Control (ABAC) engine
 * @dev Real-time permission adjustment based on threat level and context
 * 
 * Features:
 * - Context-aware permission calculation
 * - Threat-level based access adjustment
 * - Attribute-based access control
 * - Automatic privilege revocation during attacks
 */
contract DynamicAccessControl is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant POLICY_ADMIN = keccak256("POLICY_ADMIN");

    enum AccessDecision {
        DENY,
        ALLOW,
        ESCALATE,
        MONITOR
    }

    enum ContextFactor {
        ThreatLevel,
        TimeOfDay,
        UserReputation,
        TransactionValue,
        GasPrice,
        HistoricalBehavior,
        ChainState,
        MultiSigStatus
    }

    struct AccessPolicy {
        bytes32 id;
        string name;
        uint256 priority;
        bool active;
        uint256 minThreatLevel;
        uint256 maxThreatLevel;
        uint256 weight;
        address targetContract;
        bytes4 functionSelector;
    }

    struct UserContext {
        address user;
        uint256 reputation;
        uint256 successfulTransactions;
        uint256 failedAttempts;
        uint256 lastActive;
        uint256 sessionAge;
        bool mfaVerified;
        uint256 trustScore;
    }

    struct AccessRequest {
        address user;
        address targetContract;
        bytes4 functionSelector;
        uint256 value;
        uint256 gasPrice;
        uint256 threatLevel;
        uint256 timestamp;
    }

    mapping(bytes32 => AccessPolicy) public accessPolicies;
    mapping(address => UserContext) public userContexts;
    mapping(address => mapping(bytes4 => uint256)) public functionAccessWeights;
    mapping(address => bool) public trustedContracts;
    bytes32[] public policyIds;
    
    uint256 public constant MAX_THREAT_LEVEL = 100;
    uint256 public currentThreatLevel = 0;
    uint256 public defaultTrustScore = 50;
    uint256 public sessionTimeout = 1 hours;

    event AccessDecisionMade(
        bytes32 indexed policyId,
        address indexed user,
        AccessDecision decision,
        uint256 confidence,
        uint256 timestamp
    );
    
    event PolicyUpdated(bytes32 indexed policyId, bool active);
    event UserTrustScoreUpdated(address indexed user, uint256 oldScore, uint256 newScore);
    event ThreatLevelUpdated(uint256 oldLevel, uint256 newLevel);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(POLICY_ADMIN, msg.sender);
    }
    
    /**
     * @notice Initialize user context on first access
     */
    function _initializeUserContext(address user) internal {
        if (userContexts[user].trustScore == 0 && userContexts[user].lastActive == 0) {
            userContexts[user] = UserContext({
                user: user,
                reputation: 0,
                successfulTransactions: 0,
                failedAttempts: 0,
                lastActive: block.timestamp,
                sessionAge: 0,
                mfaVerified: false,
                trustScore: defaultTrustScore
            });
        }
    }

    /**
     * @notice Make access control decision based on full context
     */
    function checkAccess(AccessRequest calldata request) 
        external 
        nonReentrant
        returns (AccessDecision decision, uint256 confidence) 
    {
        // Calculate base score
        uint256 baseScore = _calculateBaseScore(request);
        
        // Apply policy modifiers
        (uint256 policyScore, bytes32 matchedPolicy) = _applyAccessPolicies(request);
        
        // Calculate final confidence
        confidence = (baseScore + policyScore) / 2;
        
        // Make decision
        if (confidence < 25) {
            decision = AccessDecision.DENY;
        } else if (confidence < 50) {
            decision = AccessDecision.MONITOR;
        } else if (confidence < 75) {
            decision = AccessDecision.ESCALATE;
        } else {
            decision = AccessDecision.ALLOW;
        }
        
        emit AccessDecisionMade(matchedPolicy, request.user, decision, confidence, block.timestamp);
    }

    /**
     * @notice Calculate base trust score from context factors
     */
    function _calculateBaseScore(AccessRequest calldata request) internal view returns (uint256) {
        UserContext storage ctx = userContexts[request.user];
        uint256 score = ctx.trustScore == 0 ? defaultTrustScore : ctx.trustScore;
        
        // Adjust for threat level
        if (currentThreatLevel > 75) {
            score = score * 75 / 100;
        } else if (currentThreatLevel > 50) {
            score = score * 90 / 100;
        }
        
        // Adjust for recent failures
        if (ctx.failedAttempts > 5) {
            score = score * 50 / 100;
        } else if (ctx.failedAttempts > 2) {
            score = score * 80 / 100;
        }
        
        // Adjust for session age
        if (block.timestamp > ctx.lastActive + sessionTimeout) {
            score = score * 60 / 100;
        }
        
        // Adjust for MFA verification
        if (!ctx.mfaVerified && request.value > 1 ether) {
            score = score * 40 / 100;
        }
        
        // Adjust for transaction value
        if (request.value > 100 ether) {
            score = score * 50 / 100;
        } else if (request.value > 10 ether) {
            score = score * 70 / 100;
        }
        
        return score;
    }

    /**
     * @notice Apply all active access policies to request
     */
    function _applyAccessPolicies(AccessRequest calldata request) 
        internal 
        view 
        returns (uint256 policyScore, bytes32 matchedPolicy) 
    {
        policyScore = 50; // Neutral starting score
        
        // Iterate through policies, sorted highest priority first
        bytes32[] memory policies = _getActivePolicies();
        
        for (uint256 i = 0; i < policies.length; i++) {
            AccessPolicy storage policy = accessPolicies[policies[i]];
            
            // Check if policy applies to this request
            if (policy.targetContract != address(0) && policy.targetContract != request.targetContract) {
                continue;
            }
            
            if (policy.functionSelector != bytes4(0) && policy.functionSelector != request.functionSelector) {
                continue;
            }
            
            if (currentThreatLevel < policy.minThreatLevel || currentThreatLevel > policy.maxThreatLevel) {
                continue;
            }
            
            // Apply policy weight: weight >50 = restrictive, <50 = permissive
            policyScore = (policyScore * (100 - policy.weight) + policy.weight * 50) / 100;
            matchedPolicy = policies[i];
            break; // Apply highest priority matching policy only
        }
    }

    /**
     * @notice Update current system threat level
     */
    function updateThreatLevel(uint256 newLevel) external onlyRole(ADMIN_ROLE) {
        require(newLevel <= MAX_THREAT_LEVEL, "Invalid threat level");
        
        uint256 oldLevel = currentThreatLevel;
        currentThreatLevel = newLevel;
        
        emit ThreatLevelUpdated(oldLevel, newLevel);
    }

    /**
     * @notice Update user trust score
     */
    function updateUserTrustScore(address user, int256 delta) external onlyRole(POLICY_ADMIN) {
        uint256 oldScore = userContexts[user].trustScore == 0 ? defaultTrustScore : userContexts[user].trustScore;
        int256 newScore = int256(oldScore) + delta;
        
        // Clamp to 0-100 range
        if (newScore < 0) {
            newScore = 0;
        } else if (newScore > 100) {
            newScore = 100;
        }
        
        userContexts[user].trustScore = uint256(newScore);
        
        emit UserTrustScoreUpdated(user, oldScore, userContexts[user].trustScore);
    }

    /**
     * @notice Record successful transaction for user
     */
    function recordSuccessfulTransaction(address user) external {
        _initializeUserContext(user);
        userContexts[user].successfulTransactions++;
        userContexts[user].lastActive = block.timestamp;
        
        if (userContexts[user].failedAttempts > 0) {
            userContexts[user].failedAttempts--;
        }
        
        // Gradually increase trust score
        if (userContexts[user].trustScore < 100) {
            userContexts[user].trustScore += 1;
        }
    }

    /**
     * @notice Record failed access attempt
     */
    function recordFailedAttempt(address user) external {
        _initializeUserContext(user);
        userContexts[user].failedAttempts++;
        userContexts[user].lastActive = block.timestamp;
        
        // Penalty for repeated failures
        if (userContexts[user].failedAttempts > 3) {
            userContexts[user].trustScore = userContexts[user].trustScore > 5 
                ? userContexts[user].trustScore - 5 
                : 0;
        }
    }

    /**
     * @notice Verify MFA status for user
     */
    function verifyMFA(address user, bool verified) external onlyRole(ADMIN_ROLE) {
        _initializeUserContext(user);
        userContexts[user].mfaVerified = verified;
        userContexts[user].lastActive = block.timestamp;
    }

    /**
     * @notice Add new access policy
     */
    function addAccessPolicy(
        bytes32 id,
        string calldata name,
        uint256 priority,
        uint256 minThreatLevel,
        uint256 maxThreatLevel,
        uint256 weight,
        address targetContract,
        bytes4 functionSelector
    ) external onlyRole(POLICY_ADMIN) {
        require(accessPolicies[id].id == bytes32(0), "Policy already exists");
        require(weight <= 100, "Weight must be <= 100");
        require(maxThreatLevel <= MAX_THREAT_LEVEL, "Max threat level exceeds limit");
        require(minThreatLevel <= maxThreatLevel, "Min exceeds max threat level");
        
        accessPolicies[id] = AccessPolicy({
            id: id,
            name: name,
            priority: priority,
            active: true,
            minThreatLevel: minThreatLevel,
            maxThreatLevel: maxThreatLevel,
            weight: weight,
            targetContract: targetContract,
            functionSelector: functionSelector
        });
        
        policyIds.push(id);
        emit PolicyUpdated(id, true);
    }

    /**
     * @notice Enable/disable access policy
     */
    function setPolicyActive(bytes32 policyId, bool active) external onlyRole(POLICY_ADMIN) {
        require(accessPolicies[policyId].id != bytes32(0), "Policy not found");
        accessPolicies[policyId].active = active;
        emit PolicyUpdated(policyId, active);
    }

    /**
     * @notice Get all active policies sorted by priority (highest first)
     */
    function _getActivePolicies() internal view returns (bytes32[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < policyIds.length; i++) {
            if (accessPolicies[policyIds[i]].active) {
                activeCount++;
            }
        }
        
        bytes32[] memory active = new bytes32[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < policyIds.length; i++) {
            if (accessPolicies[policyIds[i]].active) {
                active[idx] = policyIds[i];
                idx++;
            }
        }
        
        // Bubble sort by priority descending
        for (uint256 i = 0; i < active.length; i++) {
            for (uint256 j = i + 1; j < active.length; j++) {
                if (accessPolicies[active[i]].priority < accessPolicies[active[j]].priority) {
                    bytes32 temp = active[i];
                    active[i] = active[j];
                    active[j] = temp;
                }
            }
        }
        
        return active;
    }

    /**
     * @notice Get user context information
     */
    function getUserContext(address user) external view returns (
        uint256 reputation,
        uint256 successfulTransactions,
        uint256 failedAttempts,
        uint256 lastActive,
        bool mfaVerified,
        uint256 trustScore
    ) {
        UserContext storage ctx = userContexts[user];
        return (
            ctx.reputation,
            ctx.successfulTransactions,
            ctx.failedAttempts,
            ctx.lastActive,
            ctx.mfaVerified,
            ctx.trustScore
        );
    }
}
