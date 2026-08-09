// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SentinelAgentPolicy
 * @notice On-chain registry that binds DeFAI agent identifiers to allowed
 *         action bitmasks. Policy changes are subject to a mandatory timelock
 *         delay to prevent flash-loan-boosted governance attacks.
 *
 * @dev Architecture:
 *  - Each agent is identified by a uint256 agentId.
 *  - An actionMask is a bitmask of allowed on-chain action classes:
 *      Bit 0  — SWAP          (single-hop DEX swap)
 *      Bit 1  — MULTI_SWAP    (multi-hop swap)
 *      Bit 2  — LIQUIDITY     (add/remove liquidity)
 *      Bit 3  — BRIDGE        (cross-chain bridge operation)
 *      Bit 4  — GOVERNANCE    (on-chain governance vote)
 *      Bit 5  — EMERGENCY     (emergency pause trigger)
 *      Bits 6-255 reserved
 *  - Policy changes follow a two-phase propose → execute pattern with a
 *    configurable minimum delay set at construction time.
 *  - DEFAULT_ADMIN_ROLE can propose, execute, and cancel policies.
 *  - OPERATOR_ROLE can read policies but cannot modify them.
 *
 * @custom:security-contact security@aetheron.io
 */
contract SentinelAgentPolicy is Ownable, AccessControl, Pausable {
    // ─── Roles ────────────────────────────────────────────────────────────────
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ─── Action mask constants ────────────────────────────────────────────────
    uint256 public constant ACTION_SWAP       = 1 << 0;
    uint256 public constant ACTION_MULTI_SWAP = 1 << 1;
    uint256 public constant ACTION_LIQUIDITY  = 1 << 2;
    uint256 public constant ACTION_BRIDGE     = 1 << 3;
    uint256 public constant ACTION_GOVERNANCE = 1 << 4;
    uint256 public constant ACTION_EMERGENCY  = 1 << 5;

    // ─── Structs ───────────────────────────────────────────────────────────────
    struct Policy {
        uint256 actionMask;
        bool    active;
        uint256 activatedAt;   // timestamp when policy became active
        uint256 updatedAt;     // timestamp of last executed update
    }

    struct PendingPolicy {
        uint256 actionMask;
        uint256 executeAfter;  // earliest timestamp at which this may execute
        bool    exists;
    }

    // ─── State ─────────────────────────────────────────────────────────────────
    uint256 public immutable minDelay;

    mapping(uint256 => Policy)        public policies;
    mapping(uint256 => PendingPolicy) public pendingPolicies;

    // ─── Events ────────────────────────────────────────────────────────────────
    event PolicyProposed(
        uint256 indexed agentId,
        uint256 actionMask,
        uint256 executeAfter
    );
    event PolicyExecuted(
        uint256 indexed agentId,
        uint256 actionMask,
        uint256 executedAt
    );
    event PolicyCancelled(uint256 indexed agentId);
    event PolicyRevoked(uint256 indexed agentId);

    // ─── Errors ────────────────────────────────────────────────────────────────
    error TimelockNotExpired(uint256 agentId, uint256 executeAfter, uint256 currentTime);
    error NoPendingPolicy(uint256 agentId);
    error PolicyAlreadyPending(uint256 agentId);
    error InvalidActionMask(uint256 actionMask);
    error InvalidMinDelay(uint256 provided, uint256 minimum);

    // ─── Constants ─────────────────────────────────────────────────────────────
    uint256 public constant MINIMUM_DELAY = 1 hours;
    // Full set of defined bits — all others are reserved and must be zero.
    uint256 public constant VALID_MASK = ACTION_SWAP | ACTION_MULTI_SWAP
        | ACTION_LIQUIDITY | ACTION_BRIDGE | ACTION_GOVERNANCE | ACTION_EMERGENCY;

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(address initialOwner, uint256 _minDelay) Ownable(initialOwner) {
        if (_minDelay < MINIMUM_DELAY) {
            revert InvalidMinDelay(_minDelay, MINIMUM_DELAY);
        }
        minDelay = _minDelay;

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(OPERATOR_ROLE, initialOwner);
    }

    // ─── Phase 1: Propose ─────────────────────────────────────────────────────

    /**
     * @notice Propose a new policy for an agent. Queues it behind the timelock.
     * @param agentId    Unique identifier for the DeFAI agent.
     * @param actionMask Bitmask of permitted action classes.
     */
    function proposePolicy(
        uint256 agentId,
        uint256 actionMask
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        if (actionMask == 0 || (actionMask & ~VALID_MASK) != 0) {
            revert InvalidActionMask(actionMask);
        }
        if (pendingPolicies[agentId].exists) {
            revert PolicyAlreadyPending(agentId);
        }

        uint256 executeAfter = block.timestamp + minDelay;
        pendingPolicies[agentId] = PendingPolicy({
            actionMask: actionMask,
            executeAfter: executeAfter,
            exists: true
        });

        emit PolicyProposed(agentId, actionMask, executeAfter);
    }

    // ─── Phase 2: Execute ─────────────────────────────────────────────────────

    /**
     * @notice Execute a pending policy after its timelock delay has elapsed.
     * @param agentId Agent whose policy should be activated.
     */
    function executePolicy(
        uint256 agentId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        PendingPolicy storage pending = pendingPolicies[agentId];
        if (!pending.exists) revert NoPendingPolicy(agentId);
        if (block.timestamp < pending.executeAfter) {
            revert TimelockNotExpired(agentId, pending.executeAfter, block.timestamp);
        }

        uint256 mask = pending.actionMask;
        delete pendingPolicies[agentId];

        Policy storage p = policies[agentId];
        bool isNew = !p.active;
        p.actionMask  = mask;
        p.active      = true;
        p.updatedAt   = block.timestamp;
        if (isNew) p.activatedAt = block.timestamp;

        emit PolicyExecuted(agentId, mask, block.timestamp);
    }

    // ─── Instant write (admin bypass for admin-owned sim deployments) ──────────

    /**
     * @notice Directly set a policy, bypassing the timelock. Only callable by
     *         DEFAULT_ADMIN_ROLE. Intended for simulation environments only; on
     *         a hardened Safe/timelock owner this function is unreachable without
     *         multi-sig consensus + Safe transaction delay.
     * @param agentId    Unique identifier for the DeFAI agent.
     * @param actionMask Bitmask of permitted action classes.
     */
    function setPolicy(
        uint256 agentId,
        uint256 actionMask
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        if (actionMask == 0 || (actionMask & ~VALID_MASK) != 0) {
            revert InvalidActionMask(actionMask);
        }
        Policy storage p = policies[agentId];
        bool isNew = !p.active;
        p.actionMask = actionMask;
        p.active     = true;
        p.updatedAt  = block.timestamp;
        if (isNew) p.activatedAt = block.timestamp;

        emit PolicyExecuted(agentId, actionMask, block.timestamp);
    }

    // ─── Cancel ──────────────────────────────────────────────────────────────

    /**
     * @notice Cancel a pending (not-yet-executed) policy proposal.
     * @param agentId Agent whose pending proposal should be cancelled.
     */
    function cancelPolicy(
        uint256 agentId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!pendingPolicies[agentId].exists) revert NoPendingPolicy(agentId);
        delete pendingPolicies[agentId];
        emit PolicyCancelled(agentId);
    }

    // ─── Revoke ──────────────────────────────────────────────────────────────

    /**
     * @notice Revoke an active policy, disabling all actions for the agent.
     * @param agentId Agent to revoke.
     */
    function revokePolicy(uint256 agentId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        policies[agentId].active = false;
        policies[agentId].updatedAt = block.timestamp;
        emit PolicyRevoked(agentId);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the active policy for an agent.
     */
    function getPolicy(uint256 agentId) external view returns (Policy memory) {
        return policies[agentId];
    }

    /**
     * @notice Returns true if the agent is permitted to execute the given action.
     * @param agentId    Agent identifier.
     * @param action     A single action bit (e.g., ACTION_SWAP).
     */
    function isActionPermitted(uint256 agentId, uint256 action) external view returns (bool) {
        Policy storage p = policies[agentId];
        return p.active && (p.actionMask & action) != 0;
    }

    /**
     * @notice Returns the pending policy for an agent (if any).
     */
    function getPendingPolicy(uint256 agentId) external view returns (PendingPolicy memory) {
        return pendingPolicies[agentId];
    }

    // ─── Emergency ────────────────────────────────────────────────────────────

    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ─── Ownership migration ──────────────────────────────────────────────────

    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner();
        super.transferOwnership(newOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, newOwner);
        _grantRole(OPERATOR_ROLE, newOwner);
        _revokeRole(OPERATOR_ROLE, previousOwner);
        _revokeRole(DEFAULT_ADMIN_ROLE, previousOwner);
    }
}
