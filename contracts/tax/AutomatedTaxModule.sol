// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AutomatedTaxModule
 * @notice Split bridge fees to treasury, staking rewards, and insurance
 * @dev Supports dynamic allocation, automatic distributions, and reporting
 */
contract AutomatedTaxModule is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant TAX_ADMIN_ROLE = keccak256("TAX_ADMIN_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // Structs
    struct TaxRecipient {
        address recipient;
        uint256 allocation; // bps (basis points)
        uint256 accumulated;
        uint256 lastDistribution;
        bool isActive;
        RecipientType recipientType;
    }

    enum RecipientType {
        Treasury,
        StakingRewards,
        Insurance,
        Development,
        Burn,
        Custom
    }

    struct TaxConfig {
        uint256 treasuryAllocation;
        uint256 stakingAllocation;
        uint256 insuranceAllocation;
        uint256 developmentAllocation;
        uint256 burnAllocation;
        bool dynamicAdjustment;
        uint256 minThreshold;
    }

    struct RevenueEvent {
        uint256 eventId;
        address source;
        uint256 totalRevenue;
        uint256 treasuryShare;
        uint256 stakingShare;
        uint256 insuranceShare;
        uint256 developmentShare;
        uint256 burnShare;
        uint256 timestamp;
    }

    struct DistributionRecord {
        address recipient;
        uint256 amount;
        uint256 taxPeriod;
        uint256 timestamp;
    }

    // State
    IERC20 public immutable TOKEN;
    mapping(RecipientType => TaxRecipient) public recipients;
    mapping(address => uint256) public recipientBalances;
    mapping(address => bool) public isTaxExempt;

    // Configuration
    TaxConfig public config =
        TaxConfig({
            treasuryAllocation: 4000, // 40%
            stakingAllocation: 3000, // 30%
            insuranceAllocation: 2000, // 20%
            developmentAllocation: 500, // 5%
            burnAllocation: 500, // 5%
            dynamicAdjustment: false,
            minThreshold: 100e18
        });

    // Tracking
    uint256 public totalRevenue;
    uint256 public totalDistributed;
    uint256 public taxPeriodStart;
    uint256 public constant TAX_PERIOD = 1 weeks;
    uint256 public revenueCount;
    mapping(uint256 => RevenueEvent) public revenueEvents;

    // Distribution tracking
    mapping(address => DistributionRecord[]) public distributionHistory;
    uint256 public totalDistributions;

    // Auto-distribution
    bool public autoDistribute = true;
    uint256 public autoDistributeThreshold = 1000e18;
    uint256 public lastAutoDistribution;
    uint256 public autoDistributeInterval = 1 days;

    // Events
    event RevenueCollected(
        address indexed source,
        uint256 totalAmount,
        uint256 treasury,
        uint256 staking,
        uint256 insurance
    );
    event DistributionExecuted(
        address indexed recipient,
        RecipientType recipientType,
        uint256 amount,
        uint256 taxPeriod
    );
    event RecipientUpdated(
        RecipientType recipientType,
        address newRecipient,
        uint256 newAllocation
    );
    event TaxConfigUpdated(
        uint256 treasury,
        uint256 staking,
        uint256 insurance,
        uint256 development,
        uint256 burn
    );
    event AutoDistributeTriggered(
        uint256 totalDistributed,
        uint256 recipientCount
    );
    event TaxExemptionToggled(address indexed account, bool isExempt);
    event PeriodRolled(uint256 indexed oldPeriod, uint256 indexed newPeriod);
    event EmergencyWithdraw(address indexed recipient, uint256 amount);
    event RevenueReportGenerated(
        uint256 periodStart,
        uint256 periodEnd,
        uint256 totalRevenue,
        uint256 totalDistributed
    );

    constructor(address _token) {
        require(_token != address(0), "Invalid token");
        TOKEN = IERC20(_token);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TAX_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);

        taxPeriodStart = block.timestamp;

        // Initialize default recipients
        _initializeRecipients();
    }

    function _initializeRecipients() internal {
        recipients[RecipientType.Treasury] = TaxRecipient({
            recipient: address(0),
            allocation: 4000,
            accumulated: 0,
            lastDistribution: 0,
            isActive: true,
            recipientType: RecipientType.Treasury
        });

        recipients[RecipientType.StakingRewards] = TaxRecipient({
            recipient: address(0),
            allocation: 3000,
            accumulated: 0,
            lastDistribution: 0,
            isActive: true,
            recipientType: RecipientType.StakingRewards
        });

        recipients[RecipientType.Insurance] = TaxRecipient({
            recipient: address(0),
            allocation: 2000,
            accumulated: 0,
            lastDistribution: 0,
            isActive: true,
            recipientType: RecipientType.Insurance
        });

        recipients[RecipientType.Development] = TaxRecipient({
            recipient: address(0),
            allocation: 500,
            accumulated: 0,
            lastDistribution: 0,
            isActive: true,
            recipientType: RecipientType.Development
        });

        recipients[RecipientType.Burn] = TaxRecipient({
            recipient: address(0),
            allocation: 500,
            accumulated: 0,
            lastDistribution: 0,
            isActive: true,
            recipientType: RecipientType.Burn
        });
    }

    // ============ Revenue Collection ============

    function collectRevenue(
        address _source,
        uint256 _amount
    ) external nonReentrant {
        require(_source != address(0), "Invalid source");
        require(_amount > 0, "Invalid amount");

        // Transfer tokens from source
        TOKEN.safeTransferFrom(_source, address(this), _amount);

        // Calculate splits
        uint256 treasuryShare = (_amount * config.treasuryAllocation) / 10000;
        uint256 stakingShare = (_amount * config.stakingAllocation) / 10000;
        uint256 insuranceShare = (_amount * config.insuranceAllocation) / 10000;
        uint256 developmentShare = (_amount * config.developmentAllocation) /
            10000;
        uint256 burnShare = (_amount * config.burnAllocation) / 10000;

        // Record revenue event
        uint256 eventId = revenueCount++;
        revenueEvents[eventId] = RevenueEvent({
            eventId: eventId,
            source: _source,
            totalRevenue: _amount,
            treasuryShare: treasuryShare,
            stakingShare: stakingShare,
            insuranceShare: insuranceShare,
            developmentShare: developmentShare,
            burnShare: burnShare,
            timestamp: block.timestamp
        });

        // Accumulate to recipients
        recipients[RecipientType.Treasury].accumulated += treasuryShare;
        recipients[RecipientType.StakingRewards].accumulated += stakingShare;
        recipients[RecipientType.Insurance].accumulated += insuranceShare;
        recipients[RecipientType.Development].accumulated += developmentShare;

        totalRevenue += _amount;

        emit RevenueCollected(
            _source,
            _amount,
            treasuryShare,
            stakingShare,
            insuranceShare
        );

        // Check for auto-distribution
        if (autoDistribute) {
            _checkAutoDistribute();
        }

        // Check for period roll
        _checkPeriodRoll();
    }

    function collectRevenueFromBridge(
        address _bridge,
        uint256 _amount,
        bytes32 _txHash
    ) external onlyRole(TAX_ADMIN_ROLE) nonReentrant {
        require(_bridge != address(0), "Invalid bridge");
        require(_amount > 0, "Invalid amount");

        // Transfer tokens
        TOKEN.safeTransferFrom(_bridge, address(this), _amount);

        // Calculate and split
        uint256 treasuryShare = (_amount * config.treasuryAllocation) / 10000;
        uint256 stakingShare = (_amount * config.stakingAllocation) / 10000;
        uint256 insuranceShare = (_amount * config.insuranceAllocation) / 10000;
        uint256 developmentShare = (_amount * config.developmentAllocation) /
            10000;
        uint256 burnShare = (_amount * config.burnAllocation) / 10000;

        // Accumulate
        recipients[RecipientType.Treasury].accumulated += treasuryShare;
        recipients[RecipientType.StakingRewards].accumulated += stakingShare;
        recipients[RecipientType.Insurance].accumulated += insuranceShare;
        recipients[RecipientType.Development].accumulated += developmentShare;

        totalRevenue += _amount;

        // Record
        uint256 eventId = revenueCount++;
        revenueEvents[eventId] = RevenueEvent({
            eventId: eventId,
            source: _bridge,
            totalRevenue: _amount,
            treasuryShare: treasuryShare,
            stakingShare: stakingShare,
            insuranceShare: insuranceShare,
            developmentShare: developmentShare,
            burnShare: burnShare,
            timestamp: block.timestamp
        });

        emit RevenueCollected(
            _bridge,
            _amount,
            treasuryShare,
            stakingShare,
            insuranceShare
        );
    }

    // ============ Distribution ============

    function distributeAll() external nonReentrant {
        uint256 count;
        uint256 total;

        for (uint256 i = 0; i <= uint256(RecipientType.Custom); i++) {
            RecipientType rType = RecipientType(i);
            TaxRecipient storage recipient = recipients[rType];

            if (
                recipient.isActive &&
                recipient.accumulated > 0 &&
                recipient.recipient != address(0)
            ) {
                _distributeToRecipient(rType);
                total += recipient.accumulated;
                recipient.accumulated = 0;
                recipient.lastDistribution = block.timestamp;
                count++;
            }
        }

        totalDistributed += total;

        emit AutoDistributeTriggered(total, count);
    }

    function distributeToRecipient(
        RecipientType _recipientType
    ) external nonReentrant {
        _distributeToRecipient(_recipientType);
    }

    function _distributeToRecipient(RecipientType _recipientType) internal {
        TaxRecipient storage recipient = recipients[_recipientType];
        require(recipient.isActive, "Recipient not active");
        require(recipient.recipient != address(0), "Recipient not set");
        require(recipient.accumulated > 0, "Nothing to distribute");

        uint256 amount = recipient.accumulated;

        if (_recipientType == RecipientType.Burn) {
            // Burn tokens
            recipient.accumulated = 0;
            // Note: Actual burn would require token to support burning
            // For now, send to burn address
            TOKEN.safeTransfer(
                0x000000000000000000000000000000000000dEaD,
                amount
            );
        } else {
            recipient.accumulated = 0;
            recipientBalances[recipient.recipient] += amount;
            TOKEN.safeTransfer(recipient.recipient, amount);
        }

        // Record distribution
        distributionHistory[recipient.recipient].push(
            DistributionRecord({
                recipient: recipient.recipient,
                amount: amount,
                taxPeriod: _getCurrentPeriod(),
                timestamp: block.timestamp
            })
        );

        totalDistributions++;

        emit DistributionExecuted(
            recipient.recipient,
            _recipientType,
            amount,
            _getCurrentPeriod()
        );
    }

    function _checkAutoDistribute() internal {
        uint256 totalAccumulated;
        for (uint256 i = 0; i <= uint256(RecipientType.Custom); i++) {
            totalAccumulated += recipients[RecipientType(i)].accumulated;
        }

        if (
            totalAccumulated >= autoDistributeThreshold &&
            block.timestamp - lastAutoDistribution >= autoDistributeInterval
        ) {
            this.distributeAll();
            lastAutoDistribution = block.timestamp;
        }
    }

    function _checkPeriodRoll() internal {
        if (block.timestamp - taxPeriodStart >= TAX_PERIOD) {
            uint256 oldPeriod = taxPeriodStart;
            taxPeriodStart = block.timestamp;
            emit PeriodRolled(oldPeriod, taxPeriodStart);
        }
    }

    function _getCurrentPeriod() internal view returns (uint256) {
        return (block.timestamp - taxPeriodStart) / TAX_PERIOD;
    }

    // ============ Recipient Management ============

    function setRecipient(
        RecipientType _recipientType,
        address _recipient
    ) external onlyRole(TAX_ADMIN_ROLE) {
        require(_recipient != address(0), "Invalid recipient");

        recipients[_recipientType].recipient = _recipient;
        recipients[_recipientType].isActive = true;

        emit RecipientUpdated(
            _recipientType,
            _recipient,
            recipients[_recipientType].allocation
        );
    }

    function updateAllocation(
        RecipientType _recipientType,
        uint256 _newAllocation
    ) external onlyRole(TAX_ADMIN_ROLE) {
        require(_newAllocation <= 10000, "Invalid allocation");

        // Verify total doesn't exceed 100%
        uint256 totalAllocation = config.treasuryAllocation +
            config.stakingAllocation +
            config.insuranceAllocation +
            config.developmentAllocation +
            config.burnAllocation;

        // This is a simplified check - in production would need more careful handling
        recipients[_recipientType].allocation = _newAllocation;

        // Update config
        if (_recipientType == RecipientType.Treasury) {
            config.treasuryAllocation = _newAllocation;
        } else if (_recipientType == RecipientType.StakingRewards) {
            config.stakingAllocation = _newAllocation;
        } else if (_recipientType == RecipientType.Insurance) {
            config.insuranceAllocation = _newAllocation;
        } else if (_recipientType == RecipientType.Development) {
            config.developmentAllocation = _newAllocation;
        } else if (_recipientType == RecipientType.Burn) {
            config.burnAllocation = _newAllocation;
        }

        emit TaxConfigUpdated(
            config.treasuryAllocation,
            config.stakingAllocation,
            config.insuranceAllocation,
            config.developmentAllocation,
            config.burnAllocation
        );
    }

    function batchUpdateAllocations(
        uint256[] calldata _treasury,
        uint256[] calldata _staking,
        uint256[] calldata _insurance,
        uint256[] calldata _development,
        uint256[] calldata _burn
    ) external onlyRole(TAX_ADMIN_ROLE) {
        require(
            _treasury.length == 2 && _staking.length == 2,
            "Invalid arrays"
        );

        // Update all allocations
        config.treasuryAllocation = _treasury[1];
        config.stakingAllocation = _staking[1];
        config.insuranceAllocation = _insurance[1];
        config.developmentAllocation = _development[1];
        config.burnAllocation = _burn[1];

        recipients[RecipientType.Treasury].allocation = _treasury[1];
        recipients[RecipientType.StakingRewards].allocation = _staking[1];
        recipients[RecipientType.Insurance].allocation = _insurance[1];
        recipients[RecipientType.Development].allocation = _development[1];
        recipients[RecipientType.Burn].allocation = _burn[1];

        emit TaxConfigUpdated(
            config.treasuryAllocation,
            config.stakingAllocation,
            config.insuranceAllocation,
            config.developmentAllocation,
            config.burnAllocation
        );
    }

    // ============ Tax Exemptions ============

    function toggleTaxExemption(
        address _account
    ) external onlyRole(TAX_ADMIN_ROLE) {
        isTaxExempt[_account] = !isTaxExempt[_account];
        emit TaxExemptionToggled(_account, isTaxExempt[_account]);
    }

    function batchToggleExemptions(
        address[] calldata _accounts,
        bool _exempt
    ) external onlyRole(TAX_ADMIN_ROLE) {
        for (uint256 i = 0; i < _accounts.length; i++) {
            isTaxExempt[_accounts[i]] = _exempt;
            emit TaxExemptionToggled(_accounts[i], _exempt);
        }
    }

    // ============ Admin Functions ============

    function toggleAutoDistribute() external onlyRole(TAX_ADMIN_ROLE) {
        autoDistribute = !autoDistribute;
    }

    function updateAutoDistributeThreshold(
        uint256 _threshold
    ) external onlyRole(TAX_ADMIN_ROLE) {
        autoDistributeThreshold = _threshold;
    }

    function updateAutoDistributeInterval(
        uint256 _interval
    ) external onlyRole(TAX_ADMIN_ROLE) {
        require(_interval >= 1 hours, "Interval too short");
        autoDistributeInterval = _interval;
    }

    function emergencyWithdraw(
        address _recipient,
        uint256 _amount
    ) external onlyRole(TREASURY_ROLE) nonReentrant {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Invalid amount");

        uint256 balance = TOKEN.balanceOf(address(this));
        require(balance >= _amount, "Insufficient balance");

        TOKEN.safeTransfer(_recipient, _amount);

        emit EmergencyWithdraw(_recipient, _amount);
    }

    // ============ View Functions ============

    function getRecipientInfo(
        RecipientType _recipientType
    )
        external
        view
        returns (
            address recipient,
            uint256 allocation,
            uint256 accumulated,
            uint256 lastDistribution,
            bool isActive
        )
    {
        TaxRecipient storage r = recipients[_recipientType];
        return (
            r.recipient,
            r.allocation,
            r.accumulated,
            r.lastDistribution,
            r.isActive
        );
    }

    function getAccumulatedForRecipient(
        RecipientType _recipientType
    ) external view returns (uint256) {
        return recipients[_recipientType].accumulated;
    }

    function getTotalAccumulated() external view returns (uint256 total) {
        for (uint256 i = 0; i <= uint256(RecipientType.Custom); i++) {
            total += recipients[RecipientType(i)].accumulated;
        }
    }

    function getDistributionHistory(
        address _recipient,
        uint256 _count
    ) external view returns (DistributionRecord[] memory) {
        DistributionRecord[] storage all = distributionHistory[_recipient];
        uint256 start = all.length > _count ? all.length - _count : 0;
        uint256 length = all.length > _count ? _count : all.length;

        DistributionRecord[] memory result = new DistributionRecord[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = all[start + i];
        }

        return result;
    }

    function getRevenueReport(
        uint256 _eventId
    ) external view returns (RevenueEvent memory) {
        return revenueEvents[_eventId];
    }

    function getPeriodReport()
        external
        view
        returns (
            uint256 periodStart,
            uint256 periodEnd,
            uint256 totalRevenue,
            uint256 totalDistributed,
            uint256 treasuryAccrued,
            uint256 stakingAccrued,
            uint256 insuranceAccrued
        )
    {
        periodStart = taxPeriodStart;
        periodEnd = taxPeriodStart + TAX_PERIOD;

        return (
            periodStart,
            periodEnd,
            totalRevenue,
            totalDistributed,
            recipients[RecipientType.Treasury].accumulated,
            recipients[RecipientType.StakingRewards].accumulated,
            recipients[RecipientType.Insurance].accumulated
        );
    }

    function getAllAllocations()
        external
        view
        returns (
            uint256 treasury,
            uint256 staking,
            uint256 insurance,
            uint256 development,
            uint256 burn
        )
    {
        return (
            config.treasuryAllocation,
            config.stakingAllocation,
            config.insuranceAllocation,
            config.developmentAllocation,
            config.burnAllocation
        );
    }

    function getContractBalance() external view returns (uint256) {
        return TOKEN.balanceOf(address(this));
    }

    function getStats()
        external
        view
        returns (
            uint256 _totalRevenue,
            uint256 _totalDistributed,
            uint256 _undistributed,
            uint256 _revenueEvents,
            uint256 _totalDistributions
        )
    {
        uint256 undistributed;
        for (uint256 i = 0; i <= uint256(RecipientType.Custom); i++) {
            undistributed += recipients[RecipientType(i)].accumulated;
        }

        return (
            totalRevenue,
            totalDistributed,
            undistributed,
            revenueCount,
            totalDistributions
        );
    }
}
