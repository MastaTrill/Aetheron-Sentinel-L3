// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface ISentinelSecurityAuditor {
    function reportSecurityIncident(
        string calldata incidentType,
        uint256 severity,
        string calldata description,
        bytes calldata evidence
    ) external returns (uint256);
}

/**
 * @title DecoyHoneypot
 * @notice Active defense decoy pool that baits and traps attackers
 */
contract DecoyHoneypot is Ownable {
    ISentinelSecurityAuditor public immutable s_auditor;
    uint256 public decoyBalance;

    mapping(address => bool) public isBlacklisted;

    event DecoyDeposited(address indexed user, uint256 amount);
    event HoneypotTriggered(address indexed attacker, uint256 severity);

    constructor(address auditor, address initialOwner) Ownable(initialOwner) {
        require(auditor != address(0), "Invalid auditor address");
        s_auditor = ISentinelSecurityAuditor(auditor);
    }

    /**
     * @notice Bait deposit function to make the pool look active
     */
    function depositDecoy() external payable {
        decoyBalance += msg.value;
        emit DecoyDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Bait exploit trigger designed to trap malicious actors
     */
    function triggerHoneypotDrain() external {
        require(!isBlacklisted[msg.sender], "Caller already blacklisted and trapped");
        
        // Mark caller as blacklisted locally
        isBlacklisted[msg.sender] = true;

        // Alarm raise to Security Auditor (this lowers the system security score!)
        s_auditor.reportSecurityIncident(
            "HONEYPOT_EXPLOIT_ATTEMPT",
            9, // High severity
            "Bait pool interaction: unauthorized contract drain signature matched",
            abi.encodePacked(msg.sender)
        );

        emit HoneypotTriggered(msg.sender, 9);
    }
}
