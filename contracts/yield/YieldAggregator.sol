// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title YieldAggregator
 * @notice Auto-compound staking across multiple yield protocols with security scanning
 * @dev Integrates with various yield sources, monitors APY, and automatically rebalances funds
 */
contract YieldAggregator is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant SECURITY_ROLE = keccak256("SECURITY_ROLE");

    // Structs
    struct YieldSource {
        address protocol;
        address token;
        uint256 allocatedAmount;
        uint256 lastHarvestTime;
        uint256 accumulatedYield;
        bool active;
        bool isWhitelisted;
        uint256 riskScore; // 1-100, higher = safer
        address harvestStrategy;
    }

    struct UserPosition {
        uint256 depositedAmount;
        uint256 lastUpdated;
        uint256 accumulatedShares;
        uint256 pendingYield;
    }

    struct SecurityScan {
        address protocol;
        bool isSafe;
        uint256 riskScore;
        string[] detectedIssues;
        uint256 scanTimestamp;
    }

    // State
    IERC20 public immutable DEPOSIT_TOKEN;
    uint256 public totalDeposited;
    uint256 public constant MIN_DEPOSIT = 1e6; // 0.000001 tokens (for small decimals)
    uint256 public constant MAX_RISK_SCORE = 80; // Max allowed risk score
    uint256 public constant COMPOUND_THRESHOLD = 1e18; // Min yield before compound

    // Harvesting
    uint256 public harvestInterval = 24 hours;
    uint256 public lastGlobalHarvest;
    uint256 public protocolPerformanceFee = 1000; // 10% performance fee (in bps)

    // Security
    uint256 public constant MAX_DAILY_LOSS = 5e15; // 0.5% max daily loss
    bool public emergencyStop;
    mapping(address => bool) public isSecurityScanner;

    // Yield Sources
    mapping(bytes32 => YieldSource) public yieldSources;
    bytes32[] public activeSourceIds;

    // User Positions
    mapping(address => UserPosition) public userPositions;
    uint256 public totalShares;
    uint256 public sharesMultiplier = 1e18;

    // Security Events
    event YieldSourceAdded(
        bytes32 indexed sourceId,
        address indexed protocol,
        uint256 riskScore
    );
    event YieldSourceRemoved(bytes32 indexed sourceId);
    event Deposit(
        address indexed user,
        uint256 amount,
        bytes32 indexed sourceId
    );
    event Withdrawal(address indexed user, uint256 amount, uint256 yield);
    event YieldHarvested(
        bytes32 indexed sourceId,
        uint256 yieldAmount,
        uint256 performanceFee
    );
    event AutoCompounded(bytes32 indexed sourceId, uint256 amount);
    event EmergencyStopTriggered(address indexed triggerer);
    event ProtocolBlacklisted(address indexed protocol);
    event SecurityScanCompleted(
        address indexed protocol,
        bool isSafe,
        uint256 riskScore
    );
    event Rebalanced(
        address indexed fromSource,
        address indexed toSource,
        uint256 amount
    );

    modifier whenNotEmergency() {
        require(!emergencyStop, "Emergency stop active");
        _;
    }

    constructor(address _depositToken) {
        require(_depositToken != address(0), "Invalid token");
        DEPOSIT_TOKEN = IERC20(_depositToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(SECURITY_ROLE, msg.sender);
    }

    // ============ Deposit & Withdrawal ============

    function deposit(
        uint256 _amount,
        bytes32 _sourceId
    ) external nonReentrant whenNotEmergency returns (uint256 shares) {
        require(_amount >= MIN_DEPOSIT, "Amount too small");
        YieldSource storage source = yieldSources[_sourceId];
        require(source.active, "Source not active");
        require(source.isWhitelisted, "Source not whitelisted");
        require(source.riskScore <= MAX_RISK_SCORE, "Source risk too high");

        // Update user position
        UserPosition storage position = userPositions[msg.sender];
        _updatePosition(msg.sender);

        // Calculate shares
        uint256 depositAmount = _amount;
        shares = (depositAmount * sharesMultiplier) / 1e18;

        // Transfer tokens
        DEPOSIT_TOKEN.safeTransferFrom(msg.sender, address(this), _amount);

        // Allocate to source
        source.allocatedAmount += _amount;
        totalDeposited += _amount;

        // Update position
        position.depositedAmount += _amount;
        position.lastUpdated = block.timestamp;
        position.accumulatedShares += shares;

        // Approve and deposit to protocol
        _depositToProtocol(_sourceId, _amount);

        emit Deposit(msg.sender, _amount, _sourceId);
        return shares;
    }

    function withdraw(
        uint256 _shares
    ) external nonReentrant returns (uint256 amount, uint256 yield) {
        require(_shares > 0, "Invalid shares");
        require(
            _shares <= userPositions[msg.sender].accumulatedShares,
            "Insufficient shares"
        );

        UserPosition storage position = userPositions[msg.sender];
        _updatePosition(msg.sender);

        // Calculate proportional amounts
        uint256 depositedPortion = (position.depositedAmount * _shares) /
            position.accumulatedShares;

        // Calculate yield proportional to shares
        yield = (position.pendingYield * _shares) / position.accumulatedShares;
        amount = depositedPortion;

        // Update totals
        totalDeposited -= depositedPortion;
        totalShares -= _shares;

        // Update position
        position.depositedAmount -= depositedPortion;
        position.accumulatedShares -= _shares;
        position.pendingYield -= yield;
        position.lastUpdated = block.timestamp;

        // Transfer
        DEPOSIT_TOKEN.safeTransfer(msg.sender, amount + yield);

        emit Withdrawal(msg.sender, amount, yield);
        return (amount, yield);
    }

    function _updatePosition(address _user) internal {
        UserPosition storage position = userPositions[_user];
        if (position.lastUpdated == 0) {
            position.lastUpdated = block.timestamp;
            return;
        }

        // Harvest all pending yield from all sources
        uint256 totalYield;
        for (uint256 i = 0; i < activeSourceIds.length; i++) {
            bytes32 sourceId = activeSourceIds[i];
            uint256 yield = _harvestYield(sourceId);
            totalYield += yield;

            // Auto-compound if above threshold
            if (yield >= COMPOUND_THRESHOLD) {
                _autoCompound(sourceId, yield);
            }
        }

        // Distribute yield proportionally to user's shares
        if (totalShares > 0) {
            uint256 userYield = (totalYield * position.accumulatedShares) / totalShares;
            position.pendingYield += userYield;
        }
    }

    // ============ Yield Source Management ============

    function addYieldSource(
        address _protocol,
        address _token,
        uint256 _riskScore,
        address _harvestStrategy
    ) external onlyRole(MANAGER_ROLE) returns (bytes32 sourceId) {
        require(_protocol != address(0), "Invalid protocol");
        require(_riskScore <= 100, "Invalid risk score");

        sourceId = keccak256(abi.encode(_protocol, _token, block.timestamp));

        yieldSources[sourceId] = YieldSource({
            protocol: _protocol,
            token: _token,
            allocatedAmount: 0,
            lastHarvestTime: block.timestamp,
            accumulatedYield: 0,
            active: true,
            isWhitelisted: true,
            riskScore: _riskScore,
            harvestStrategy: _harvestStrategy
        });

        activeSourceIds.push(sourceId);

        emit YieldSourceAdded(sourceId, _protocol, _riskScore);
        return sourceId;
    }

    function removeYieldSource(
        bytes32 _sourceId
    ) external onlyRole(MANAGER_ROLE) {
        YieldSource storage source = yieldSources[_sourceId];
        require(source.active, "Source not active");
        require(source.allocatedAmount == 0, "Source has allocated funds");

        source.active = false;

        // Remove from active sources
        for (uint256 i = 0; i < activeSourceIds.length; i++) {
            if (activeSourceIds[i] == _sourceId) {
                activeSourceIds[i] = activeSourceIds[
                    activeSourceIds.length - 1
                ];
                activeSourceIds.pop();
                break;
            }
        }

        emit YieldSourceRemoved(_sourceId);
    }

    function _depositToProtocol(bytes32 _sourceId, uint256 _amount) internal {
        YieldSource storage source = yieldSources[_sourceId];

        // Approve protocol
        DEPOSIT_TOKEN.approve(source.protocol, _amount);

        // Call deposit on protocol (simplified - would integrate with actual protocols)
        (bool success, ) = source.protocol.call(
            abi.encodeWithSignature("deposit(uint256)", _amount)
        );

        if (!success) {
            // Fallback: keep in contract
            source.allocatedAmount -= _amount;
            totalDeposited -= _amount;
        }
    }

    function _harvestYield(bytes32 _sourceId) internal returns (uint256 yield) {
        YieldSource storage source = yieldSources[_sourceId];
        if (!source.active || source.allocatedAmount == 0) return 0;

        // Simplified yield calculation
        uint256 currentBalance = DEPOSIT_TOKEN.balanceOf(source.protocol);
        if (currentBalance > source.allocatedAmount) {
            yield = currentBalance - source.allocatedAmount;

            // Apply performance fee
            uint256 fee = (yield * protocolPerformanceFee) / 10000;
            yield = yield - fee;

            source.accumulatedYield += yield;
            source.lastHarvestTime = block.timestamp;

            emit YieldHarvested(_sourceId, yield, fee);
        }
    }

    function _autoCompound(bytes32 _sourceId, uint256 _yield) internal {
        YieldSource storage source = yieldSources[_sourceId];

        // Reinvest yield
        source.allocatedAmount += _yield;

        emit AutoCompounded(_sourceId, _yield);
    }

    // ============ Security Scanning ============

    function performSecurityScan(
        address _protocol
    ) external onlyRole(SECURITY_ROLE) returns (SecurityScan memory scan) {
        bool isSafe = true;
        uint256 riskScore = 50; // Base risk
        string[] memory issues = new string[](0);

        // Scan for common issues
        // 1. Check if contract is verified
        // 2. Check for upgradeable proxy
        // 3. Check admin functions
        // 4. Check for unlimited approval vulnerabilities

        // Simplified checks
        uint256 issuesCount;

        // Check contract size (too large = suspicious)
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(_protocol)
        }
        if (codeSize == 0) {
            isSafe = false;
            issues = new string[](3);
            issues[issuesCount++] = "No contract code found";
            riskScore += 30;
        }

        // Check for common attack vectors
        // This is simplified - real implementation would be more comprehensive

        if (riskScore > MAX_RISK_SCORE) {
            isSafe = false;
            emit ProtocolBlacklisted(_protocol);
        }

        emit SecurityScanCompleted(_protocol, isSafe, riskScore);

        return
            SecurityScan({
                protocol: _protocol,
                isSafe: isSafe,
                riskScore: riskScore,
                detectedIssues: issues,
                scanTimestamp: block.timestamp
            });
    }

    // ============ Rebalancing ============

    function rebalanceBetweenSources(
        bytes32 _fromSource,
        bytes32 _toSource,
        uint256 _amount
    ) external onlyRole(MANAGER_ROLE) nonReentrant {
        YieldSource storage from = yieldSources[_fromSource];
        YieldSource storage to = yieldSources[_toSource];

        require(from.active && to.active, "Source not active");
        require(from.allocatedAmount >= _amount, "Insufficient funds");
        require(to.riskScore <= MAX_RISK_SCORE, "Target risk too high");

        // Withdraw from source
        (bool success, ) = from.protocol.call(
            abi.encodeWithSignature("withdraw(uint256)", _amount)
        );

        if (success) {
            from.allocatedAmount -= _amount;
            to.allocatedAmount += _amount;

            emit Rebalanced(from.protocol, to.protocol, _amount);
        }
    }

    // ============ Emergency Controls ============

    function triggerEmergencyStop() external onlyRole(SECURITY_ROLE) {
        emergencyStop = true;
        emit EmergencyStopTriggered(msg.sender);
    }

    function resumeOperations() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyStop = false;
    }

    // ============ View Functions ============

    function getUserPosition(
        address _user
    )
        external
        view
        returns (uint256 deposited, uint256 pendingYield, uint256 totalValue)
    {
        UserPosition storage pos = userPositions[_user];
        return (
            pos.depositedAmount,
            pos.pendingYield,
            pos.depositedAmount + pos.pendingYield
        );
    }

    function getYieldSourceInfo(
        bytes32 _sourceId
    )
        external
        view
        returns (
            address protocol,
            uint256 allocatedAmount,
            uint256 accumulatedYield,
            bool active,
            uint256 riskScore,
            uint256 lastHarvest
        )
    {
        YieldSource storage source = yieldSources[_sourceId];
        return (
            source.protocol,
            source.allocatedAmount,
            source.accumulatedYield,
            source.active,
            source.riskScore,
            source.lastHarvestTime
        );
    }

    function getAPY(bytes32 _sourceId) external view returns (uint256 apy) {
        YieldSource storage source = yieldSources[_sourceId];
        if (source.lastHarvestTime == 0 || source.allocatedAmount == 0)
            return 0;

        uint256 timeDiff = block.timestamp - source.lastHarvestTime;
        if (timeDiff == 0) return 0;

        uint256 yieldRate = (source.accumulatedYield * 365 days) /
            (source.allocatedAmount * timeDiff);
        return yieldRate;
    }

    function getAllActiveSources() external view returns (bytes32[] memory) {
        return activeSourceIds;
    }

    function getTotalValueLocked() external view returns (uint256) {
        return totalDeposited;
    }
}
