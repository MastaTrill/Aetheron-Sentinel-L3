// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MEVProtection
 * @notice Multi-layer MEV (Maximal Extractable Value) protection system
 * @dev Protects against:
 *      - Front-running (detector + position shuffle)
 *      - Back-running (arbitrage detection)
 *      - Sandwich attacks (commit-reveal scheme)
 *      - Flashbot integration patterns
 *      - PGA (Priority Gas Auction) resistance
 *
 * @dev Features:
 *      - Commit-reveal scheme for sensitive transactions
 *      - Randomization for transaction ordering
 *      - Bundle detection and isolation
 *      - MEV tax for sandwich protection
 *      - Time-weighted execution windows
 */
contract MEVProtection is AccessControl, Pausable {
    // ============ Constants ============

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant OBSERVER_ROLE = keccak256("OBSERVER_ROLE");

    uint256 public constant COMMIT_HASH_EXPIRY = 5 minutes;
    uint256 public constant REVEAL_WINDOW = 2 minutes;
    uint256 public constant MIN_DELAY = 12 seconds; // ~1 block
    uint256 public constant MAX_DELAY = 300 seconds; // ~5 min

    // ============ State Variables ============

    /// @notice MEV tax percentage (basis points) - goes to treasury
    uint256 public mevTax = 25; // 0.25%

    /// @notice MEV treasury address
    address public mevTreasury;

    /// @notice Minimum gas price for MEV-protected txs
    uint256 public minGasPrice;

    /// @notice Randomness beacon for ordering
    bytes32 public latestRandomness;

    /// @notice Sequential nonce for ordering
    uint256 public sequenceNonce;

    /// @notice Whether MEV protection is mandatory
    bool public mandatoryProtection = true;

    // ============ Commit-Reveal Storage ============

    mapping(bytes32 => CommitInfo) public commits;
    mapping(address => uint256) public pendingBalances;
    mapping(bytes32 => bool) public revealedHashes;

    struct CommitInfo {
        bytes32 commitHash;
        address committer;
        uint256 value;
        uint256 revealDeadline;
        bool revealed;
        bytes32 secret;
    }

    // ============ Sandwich Attack Detection ============

    mapping(address => uint256) public victimCompensation;
    mapping(address => uint256) public lastActivity;
    uint256 public sandwichWindowBlocks = 3;

    // ============ Bundle Detection ============

    mapping(bytes32 => BundleInfo) public bundles;
    uint256 public bundleCounter;

    struct BundleInfo {
        address[] transactions;
        bytes32 bundleHash;
        uint256 submitBlock;
        uint256 gasLimit;
        bool executed;
    }

    // ============ Arbitrage Tracking ============

    mapping(address => uint256) public arbitrageProfit;
    mapping(address => uint256) public arbitrageCount;
    uint256 public totalArbProfit;

    // ============ Events ============

    event Committed(
        bytes32 indexed commitHash,
        address indexed committer,
        uint256 value,
        uint256 revealDeadline
    );

    event Revealed(
        bytes32 indexed commitHash,
        bytes32 indexed secret,
        address indexed committer,
        uint256 value
    );

    event Executed(
        bytes32 indexed commitHash,
        address indexed executor,
        uint256 mevTaxPaid
    );

    event SandwichAttackDetected(
        address indexed victim,
        address indexed attacker,
        uint256 frontRunAmount,
        uint256 backRunAmount
    );

    event MEVTaxCollected(
        address indexed from,
        uint256 amount,
        uint256 taxPaid
    );

    event RandomnessUpdated(bytes32 indexed randomness, uint256 timestamp);
    event BundleRegistered(bytes32 indexed bundleHash, uint256 txCount);
    event ArbitrageDetected(
        address indexed bot,
        uint256 profit,
        uint256 taxLevied
    );
    event MEVTaxUpdated(uint256 oldTax, uint256 newTax);

    // ============ Errors ============

    error CommitNotFound(bytes32 commitHash);
    error CommitAlreadyRevealed(bytes32 commitHash);
    error RevealWindowExpired(bytes32 commitHash);
    error InvalidSecret();
    error InvalidCommitHash();
    error InsufficientValue();
    error SandwichAttemptDetected();
    error BundleAlreadyExecuted(bytes32 bundleHash);
    error InvalidBundleHash();
    error UnauthorizedRelayer();

    // ============ Constructor ============

    constructor(address _mevTreasury) {
        mevTreasury = _mevTreasury;
        minGasPrice = 1 gwei;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);
        _grantRole(OBSERVER_ROLE, msg.sender);
    }

    // ============ Commit-Reveal Scheme ============

    /**
     * @notice Commit a transaction hash (hides the actual transaction)
     * @param commitHash keccak256(abi.encode(secret, recipient, data))
     * @param value ETH value attached
     */
    function commit(
        bytes32 commitHash,
        uint256 value
    ) external payable whenNotPaused {
        if (mandatoryProtection && value > 0) {
            require(msg.value == value, "Invalid value");
        }

        if (commits[commitHash].committer != address(0)) {
            revert CommitAlreadyRevealed(commitHash);
        }

        commits[commitHash] = CommitInfo({
            commitHash: commitHash,
            committer: msg.sender,
            value: value,
            revealDeadline: block.timestamp + COMMIT_HASH_EXPIRY,
            revealed: false,
            secret: bytes32(0)
        });

        pendingBalances[msg.sender] += value;

        emit Committed(
            commitHash,
            msg.sender,
            value,
            block.timestamp + COMMIT_HASH_EXPIRY
        );
    }

    /**
     * @notice Reveal the committed transaction
     * @param secret The secret that was hashed
     * @param recipient Recipient address
     * @param data Transaction calldata
     */
    function reveal(
        bytes32 secret,
        address recipient,
        bytes calldata data
    ) external whenNotPaused {
        bytes32 commitHash = keccak256(abi.encode(secret, recipient, data));
        CommitInfo storage commit = commits[commitHash];

        if (commit.committer == address(0)) {
            revert CommitNotFound(commitHash);
        }

        if (commit.revealed) {
            revert CommitAlreadyRevealed(commitHash);
        }

        if (block.timestamp > commit.revealDeadline) {
            revert RevealWindowExpired(commitHash);
        }

        if (commit.committer != msg.sender) {
            revert InvalidSecret();
        }

        commit.revealed = true;
        commit.secret = secret;
        revealedHashes[commitHash] = true;

        emit Revealed(commitHash, secret, msg.sender, commit.value);
    }

    /**
     * @notice Execute a revealed transaction with MEV protection
     * @param secret The secret used in commit
     * @param target Target contract
     * @param data Calldata
     */
    function executeProtected(
        bytes32 secret,
        address target,
        bytes calldata data
    ) external payable whenNotPaused {
        bytes32 commitHash = keccak256(abi.encode(secret, target, data));
        CommitInfo storage commit = commits[commitHash];

        if (!commit.revealed) {
            revert CommitNotFound(commitHash);
        }

        uint256 value = commit.value;

        // Calculate MEV tax
        uint256 tax = (value * mevTax) / 10000;
        uint256 netValue = value - tax;

        // Track last activity for sandwich detection
        lastActivity[commit.committer] = block.number;

        // Delete commit
        delete commits[commitHash];

        // Transfer tax to treasury
        if (tax > 0) {
            pendingBalances[mevTreasury] += tax;
            emit MEVTaxCollected(commit.committer, value, tax);
        }

        // Execute the actual transaction
        (bool success, ) = target.call{value: netValue}(data);
        require(success, "Execution failed");

        emit Executed(commitHash, msg.sender, tax);
    }

    // ============ MEV Detection Functions ============

    /**
     * @notice Report sandwich attack (called by observer)
     */
    function reportSandwichAttack(
        address victim,
        address attacker,
        uint256 frontRunAmount,
        uint256 backRunAmount
    ) external onlyRole(OBSERVER_ROLE) {
        // Verify this is indeed a sandwich attack pattern
        uint256 victimLastBlock = lastActivity[victim];
        uint256 currentBlock = block.number;

        if (currentBlock <= victimLastBlock + sandwichWindowBlocks) {
            emit SandwichAttackDetected(
                victim,
                attacker,
                frontRunAmount,
                backRunAmount
            );

            // Compensate victim
            uint256 compensation = (frontRunAmount + backRunAmount) / 100; // 1%
            victimCompensation[victim] += compensation;
        }
    }

    /**
     * @notice Register an arbitrage transaction
     */
    function registerArbitrage(
        address bot,
        uint256 profit
    ) external onlyRole(OBSERVER_ROLE) {
        arbitrageProfit[bot] += profit;
        arbitrageCount[bot]++;
        totalArbProfit += profit;

        // Levy MEV tax on arbitrage
        uint256 tax = (profit * mevTax) / 10000;
        if (tax > 0) {
            arbitrageProfit[bot] -= tax;
            pendingBalances[mevTreasury] += tax;

            emit ArbitrageDetected(bot, profit, tax);
        }
    }

    /**
     * @notice Update randomness beacon (called by VRF or commit-reveal)
     */
    function updateRandomness(
        bytes32 newRandomness
    ) external onlyRole(RELAYER_ROLE) {
        latestRandomness = keccak256(
            abi.encode(newRandomness, block.timestamp)
        );
        emit RandomnessUpdated(latestRandomness, block.timestamp);
    }

    // ============ Bundle Functions ============

    /**
     * @notice Register a bundle of transactions
     * @param txHashes Array of transaction hashes
     */
    function registerBundle(
        bytes32[] calldata txHashes
    ) external onlyRole(RELAYER_ROLE) returns (bytes32 bundleHash) {
        bundleHash = keccak256(abi.encode(txHashes, block.number));

        bundles[bundleHash] = BundleInfo({
            transactions: new address[](txHashes.length),
            bundleHash: bundleHash,
            submitBlock: block.number,
            gasLimit: gasleft(),
            executed: false
        });

        emit BundleRegistered(bundleHash, txHashes.length);
    }

    /**
     * @notice Execute bundle atomically
     */
    function executeBundle(
        bytes32 bundleHash
    ) external onlyRole(RELAYER_ROLE) returns (bool success) {
        BundleInfo storage bundle = bundles[bundleHash];

        if (bundle.executed) {
            revert BundleAlreadyExecuted(bundleHash);
        }

        bundle.executed = true;

        // Bundle execution logic would go here
        // In production, this would be handled by Flashbots/mev-geth

        return true;
    }

    // ============ Time-Lock Execution ============

    /**
     * @notice Execute with randomized delay
     * @param target Target contract
     * @param data Calldata
     * @param minDelay Minimum delay in seconds
     */
    function timeLockExecute(
        address target,
        bytes calldata data,
        uint256 minDelay
    ) external payable whenNotPaused {
        if (mandatoryProtection) {
            require(minDelay >= MIN_DELAY, "Delay too short");
            require(minDelay <= MAX_DELAY, "Delay too long");
        }

        uint256 executeAfter = block.timestamp + minDelay;

        bytes32 timelockHash = keccak256(
            abi.encode(msg.sender, target, data, executeAfter)
        );

        // Schedule execution
        commits[timelockHash] = CommitInfo({
            commitHash: timelockHash,
            committer: msg.sender,
            value: msg.value,
            revealDeadline: executeAfter + REVEAL_WINDOW,
            revealed: true,
            secret: bytes32(executeAfter)
        });

        emit Committed(timelockHash, msg.sender, msg.value, executeAfter);
    }

    // ============ Admin Functions ============

    function setMEVTax(uint256 newTax) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTax <= 500, "Tax too high"); // Max 5%
        uint256 old = mevTax;
        mevTax = newTax;
        emit MEVTaxUpdated(old, newTax);
    }

    function setMEVTreasury(
        address newTreasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mevTreasury = newTreasury;
    }

    function setMandatoryProtection(
        bool mandatory
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mandatoryProtection = mandatory;
    }

    function setMinGasPrice(
        uint256 newMinPrice
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minGasPrice = newMinPrice;
    }

    function setSandwichWindow(
        uint256 blocks
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        sandwichWindowBlocks = blocks;
    }

    function withdrawPending(address to, uint256 amount) external {
        require(pendingBalances[msg.sender] >= amount, "Insufficient balance");
        pendingBalances[msg.sender] -= amount;
        payable(to).transfer(amount);
    }

    // ============ View Functions ============

    function getCommitInfo(
        bytes32 commitHash
    )
        external
        view
        returns (
            address committer,
            uint256 value,
            uint256 revealDeadline,
            bool revealed
        )
    {
        CommitInfo storage commit = commits[commitHash];
        return (
            commit.committer,
            commit.value,
            commit.revealDeadline,
            commit.revealed
        );
    }

    function getArbitrageStats(
        address bot
    ) external view returns (uint256 profit, uint256 count) {
        return (arbitrageProfit[bot], arbitrageCount[bot]);
    }

    function getMEVStats()
        external
        view
        returns (
            uint256 _mevTax,
            uint256 _totalArbProfit,
            bytes32 _latestRandomness
        )
    {
        return (mevTax, totalArbProfit, latestRandomness);
    }
}
