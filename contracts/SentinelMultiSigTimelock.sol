// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SentinelMultiSigTimelock
 * @notice Multi-signature timelock controller for high-value protocol governance actions.
 * Requires M-of-N signatures from approved guardians before executing sensitive operations.
 */
contract SentinelMultiSigTimelock is Ownable, ReentrancyGuard {
    uint256 public constant MIN_DELAY = 2 days;
    uint256 public constant MAX_DELAY = 30 days;

    struct Proposal {
        address target;
        bytes data;
        uint256 value;
        uint256 eta;            // Execution time (block.timestamp + delay)
        uint256 signatureCount;
        bool executed;
        bool cancelled;
        mapping(address => bool) hasSigned;
    }

    mapping(bytes32 => Proposal) public proposals;
    address[] public guardians;
    mapping(address => bool) public isGuardian;
    uint256 public immutable requiredSignatures;
    uint256 public proposalCount;

    event ProposalQueued(bytes32 indexed proposalId, address target, uint256 eta);
    event ProposalSigned(bytes32 indexed proposalId, address guardian, uint256 sigCount);
    event ProposalExecuted(bytes32 indexed proposalId, address target);
    event ProposalCancelled(bytes32 indexed proposalId);
    event GuardianAdded(address indexed guardian);

    constructor(address initialOwner, address[] memory _guardians, uint256 _requiredSigs) Ownable(initialOwner) {
        require(_guardians.length >= _requiredSigs, "Not enough guardians");
        require(_requiredSigs > 0, "Zero required signatures");
        for (uint i = 0; i < _guardians.length; i++) {
            require(_guardians[i] != address(0), "Zero guardian address");
            guardians.push(_guardians[i]);
            isGuardian[_guardians[i]] = true;
            emit GuardianAdded(_guardians[i]);
        }
        requiredSignatures = _requiredSigs;
    }

    /**
     * @notice Queue a new governance action proposal
     */
    function queueProposal(address target, bytes calldata data, uint256 value, uint256 delay) external onlyOwner returns (bytes32 proposalId) {
        require(delay >= MIN_DELAY && delay <= MAX_DELAY, "Invalid delay");
        require(target != address(0), "Zero target address");

        proposalId = keccak256(abi.encodePacked(target, data, value, block.timestamp, proposalCount++));
        Proposal storage p = proposals[proposalId];
        p.target = target;
        p.data = data;
        p.value = value;
        p.eta = block.timestamp + delay;

        emit ProposalQueued(proposalId, target, p.eta);
    }

    /**
     * @notice Guardian signs a queued proposal
     */
    function signProposal(bytes32 proposalId) external {
        require(isGuardian[msg.sender], "Not a guardian");
        Proposal storage p = proposals[proposalId];
        require(p.eta > 0, "Proposal not found");
        require(!p.executed && !p.cancelled, "Proposal inactive");
        require(!p.hasSigned[msg.sender], "Already signed");

        p.hasSigned[msg.sender] = true;
        p.signatureCount++;

        emit ProposalSigned(proposalId, msg.sender, p.signatureCount);
    }

    /**
     * @notice Execute a fully signed & matured proposal
     */
    function executeProposal(bytes32 proposalId) external nonReentrant onlyOwner {
        Proposal storage p = proposals[proposalId];
        require(p.eta > 0, "Proposal not found");
        require(!p.executed && !p.cancelled, "Proposal inactive");
        require(block.timestamp >= p.eta, "Timelock not expired");
        require(p.signatureCount >= requiredSignatures, "Insufficient signatures");

        p.executed = true;
        (bool success, ) = p.target.call{value: p.value}(p.data);
        require(success, "Execution failed");

        emit ProposalExecuted(proposalId, p.target);
    }

    function getGuardianCount() external view returns (uint256) {
        return guardians.length;
    }
}
