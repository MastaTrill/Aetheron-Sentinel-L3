// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RevenueDistributor
 * @notice Auto-split protocol revenue by allocation to stakeholders
 * @dev Supports streaming payments, vesting schedules, and multi-token distributions
 */
contract RevenueDistributor is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant ALLOCATION_MANAGER_ROLE =
        keccak256("ALLOCATION_MANAGER_ROLE");

    // Structs
    struct Share {
        uint256 shareId;
        address recipient;
        uint256 allocation; // bps (basis points)
        uint256 claimedAmount;
        uint256 pendingClaim;
        uint256 released;
        uint256 totalReceived;
        uint256 lastClaimedAt;
        bool isActive;
        bool isVesting;
        VestingSchedule vesting;
    }

    struct VestingSchedule {
        uint256 startTime;
        uint256 cliffDuration;
        uint256 duration;
        uint256 revocable;
        uint256 totalAmount;
        uint256 released;
    }

    struct Distribution {
        uint256 distributionId;
        address token;
        uint256 totalAmount;
        uint256 distributedAmount;
        uint256 remainingAmount;
        uint256 timestamp;
        uint256 period; // For periodic distributions
        DistributionType distType;
        bool isActive;
        uint256 claimedCount;
    }

    enum DistributionType {
        OneTime,
        Streaming,
        Periodic,
        Dividend,
        Airdrop
    }

    struct AllocationRule {
        uint256 ruleId;
        bytes32 category; // e.g., keccak256("treasury")
        uint256 allocation; // bps
        address recipient;
        bool isActive;
        uint256 minThreshold;
        uint256 maxCap;
        bool useVesting;
        VestingSchedule vestingSchedule;
    }

    struct RecipientInfo {
        uint256 totalAllocation;
        uint256 totalClaimed;
        uint256 pendingClaim;
        uint256 nextClaimTime;
        Share[] shares;
    }

    struct RevenueSource {
        address source;
        bytes32 category;
        bool isWhitelisted;
        uint256 totalRevenue;
        uint256 lastDistribution;
    }

    // State
    uint256 public shareCount;
    uint256 public distributionCount;
    uint256 public ruleCount;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_DAY = 86400;

    // Mappings
    mapping(uint256 => Share) public shares;
    mapping(uint256 => Distribution) public distributions;
    mapping(uint256 => AllocationRule) public allocationRules;
    mapping(address => uint256[]) public recipientShareIds;
    mapping(address => uint256[]) public recipientDistributions;
    mapping(bytes32 => address[]) public categoryRecipients;
    mapping(address => RevenueSource) public revenueSources;
    mapping(address => bool) public supportedTokens;

    // Streaming
    mapping(address => uint256) public streamingBalances;
    uint256 public streamFlowRate; // tokens per second
    mapping(address => uint256) public lastStreamUpdate;

    // Treasury
    address public treasury;
    uint256 public treasuryBalance;

    // Events
    event ShareCreated(
        uint256 indexed shareId,
        address indexed recipient,
        uint256 allocation
    );
    event ShareUpdated(uint256 indexed shareId, uint256 newAllocation);
    event ShareTransferred(
        uint256 indexed shareId,
        address indexed from,
        address indexed to
    );
    event DistributionCreated(
        uint256 indexed distributionId,
        address indexed token,
        uint256 totalAmount,
        DistributionType distType
    );
    event RevenueReceived(
        address indexed source,
        address indexed token,
        uint256 amount,
        bytes32 category
    );
    event Claimed(
        uint256 indexed shareId,
        address indexed recipient,
        uint256 amount
    );
    event StreamStarted(address indexed recipient, uint256 flowRate);
    event StreamStopped(address indexed recipient, uint256 finalAmount);
    event StreamUpdated(address indexed recipient, uint256 newFlowRate);
    event AllocationRuleCreated(
        uint256 indexed ruleId,
        bytes32 indexed category,
        uint256 allocation
    );
    event AllocationRuleUpdated(uint256 indexed ruleId, uint256 newAllocation);
    event RevenueSourceRegistered(address indexed source, bytes32 category);
    event TreasuryUpdated(address indexed treasury, uint256 amount);
    event VestingStarted(uint256 indexed shareId, VestingSchedule schedule);
    event VestingRevoked(uint256 indexed shareId, uint256 unvestedAmount);

    constructor(address _treasury) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        _grantRole(ALLOCATION_MANAGER_ROLE, msg.sender);
    }

    // ============ Share Management ============

    function createShare(
        address _recipient,
        uint256 _allocation,
        bool _useVesting,
        VestingSchedule calldata _vesting
    ) external onlyRole(ALLOCATION_MANAGER_ROLE) returns (uint256 shareId) {
        require(_recipient != address(0), "Invalid recipient");
        require(
            _allocation > 0 && _allocation <= BPS_DENOMINATOR,
            "Invalid allocation"
        );

        shareId = shareCount++;

        Share storage share = shares[shareId];
        share.shareId = shareId;
        share.recipient = _recipient;
        share.allocation = _allocation;
        share.isActive = true;
        share.isVesting = _useVesting;

        if (_useVesting) {
            share.vesting = _vesting;
            emit VestingStarted(shareId, _vesting);
        }

        recipientShareIds[_recipient].push(shareId);
        shareCount++;

        emit ShareCreated(shareId, _recipient, _allocation);
        return shareId;
    }

    function createBatchShares(
        address[] calldata _recipients,
        uint256[] calldata _allocations
    )
        external
        onlyRole(ALLOCATION_MANAGER_ROLE)
        returns (uint256[] memory shareIds)
    {
        require(_recipients.length == _allocations.length, "Length mismatch");
        require(
            _totalAllocations() + _sumAllocations(_allocations) <=
                BPS_DENOMINATOR,
            "Total exceeds 100%"
        );

        shareIds = new uint256[](_recipients.length);

        for (uint256 i = 0; i < _recipients.length; i++) {
            shareIds[i] = this.createShare(
                _recipients[i],
                _allocations[i],
                false,
                VestingSchedule({
                    startTime: 0,
                    cliffDuration: 0,
                    duration: 0,
                    revocable: 0,
                    totalAmount: 0,
                    released: 0
                })
            );
        }

        return shareIds;
    }

    function _totalAllocations() internal view returns (uint256 total) {
        for (uint256 i = 0; i < shareCount; i++) {
            if (shares[i].isActive) {
                total += shares[i].allocation;
            }
        }
    }

    function _sumAllocations(
        uint256[] memory _allocations
    ) internal pure returns (uint256 sum) {
        for (uint256 i = 0; i < _allocations.length; i++) {
            sum += _allocations[i];
        }
    }

    function updateShareAllocation(
        uint256 _shareId,
        uint256 _newAllocation
    ) external onlyRole(ALLOCATION_MANAGER_ROLE) {
        Share storage share = shares[_shareId];
        require(share.isActive, "Share not active");

        uint256 oldAllocation = share.allocation;
        share.allocation = _newAllocation;

        emit ShareUpdated(_shareId, _newAllocation);
    }

    function transferShare(uint256 _shareId, address _newRecipient) external {
        Share storage share = shares[_shareId];
        require(share.recipient == msg.sender, "Not the recipient");
        require(_newRecipient != address(0), "Invalid recipient");

        // Remove from old recipient
        uint256[] storage oldShares = recipientShareIds[msg.sender];
        for (uint256 i = 0; i < oldShares.length; i++) {
            if (oldShares[i] == _shareId) {
                oldShares[i] = oldShares[oldShares.length - 1];
                oldShares.pop();
                break;
            }
        }

        // Update share
        share.recipient = _newRecipient;
        recipientShareIds[_newRecipient].push(_shareId);

        emit ShareTransferred(_shareId, msg.sender, _newRecipient);
    }

    function pauseShare(
        uint256 _shareId
    ) external onlyRole(ALLOCATION_MANAGER_ROLE) {
        shares[_shareId].isActive = false;
    }

    function resumeShare(
        uint256 _shareId
    ) external onlyRole(ALLOCATION_MANAGER_ROLE) {
        shares[_shareId].isActive = true;
    }

    // ============ Revenue Collection ============

    function receiveRevenue(
        address _token,
        uint256 _amount
    ) external nonReentrant {
        require(_amount > 0, "Invalid amount");
        require(
            supportedTokens[_token] || hasRole(DISTRIBUTOR_ROLE, msg.sender),
            "Token not supported"
        );

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // Record revenue
        RevenueSource storage source = revenueSources[msg.sender];
        source.totalRevenue += _amount;
        source.lastDistribution = block.timestamp;

        emit RevenueReceived(msg.sender, _token, _amount, source.category);

        // Split and distribute
        _distributeRevenue(_token, _amount, source.category);
    }

    function receiveRevenueFromSource(
        address _source,
        address _token,
        uint256 _amount,
        bytes32 _category
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
        require(_amount > 0, "Invalid amount");

        IERC20(_token).safeTransferFrom(_source, address(this), _amount);

        RevenueSource storage source = revenueSources[_source];
        source.totalRevenue += _amount;
        source.lastDistribution = block.timestamp;

        emit RevenueReceived(_source, _token, _amount, _category);

        _distributeRevenue(_token, _amount, _category);
    }

    function _distributeRevenue(
        address _token,
        uint256 _amount,
        bytes32 _category
    ) internal {
        // Find matching allocation rules
        address[] storage recipients = categoryRecipients[_category];

        // If no category-specific rules, use global shares
        if (recipients.length == 0) {
            _distributeToShares(_token, _amount);
        } else {
            // Distribute to category recipients
            uint256 totalCategoryAllocation;
            for (uint256 i = 0; i < recipients.length; i++) {
                uint256[] storage shareIds = recipientShareIds[recipients[i]];
                for (uint256 j = 0; j < shareIds.length; j++) {
                    Share storage share = shares[shareIds[j]];
                    if (share.isActive) {
                        totalCategoryAllocation += share.allocation;
                    }
                }
            }

            if (totalCategoryAllocation > 0) {
                for (uint256 i = 0; i < recipients.length; i++) {
                    uint256[] storage shareIds = recipientShareIds[
                        recipients[i]
                    ];
                    for (uint256 j = 0; j < shareIds.length; j++) {
                        Share storage share = shares[shareIds[j]];
                        if (share.isActive) {
                            uint256 amount_ = (_amount * share.allocation) /
                                totalCategoryAllocation;
                            _creditShare(share, _token, amount_);
                        }
                    }
                }
            }
        }
    }

    function _distributeToShares(address _token, uint256 _amount) internal {
        uint256 totalActiveAllocation;
        for (uint256 i = 0; i < shareCount; i++) {
            if (shares[i].isActive) {
                totalActiveAllocation += shares[i].allocation;
            }
        }

        require(totalActiveAllocation > 0, "No active shares");

        for (uint256 i = 0; i < shareCount; i++) {
            Share storage share = shares[i];
            if (share.isActive) {
                uint256 amount = (_amount * share.allocation) /
                    totalActiveAllocation;
                _creditShare(share, _token, amount);
            }
        }
    }

    function _creditShare(
        Share storage _share,
        address _token,
        uint256 _amount
    ) internal {
        if (_share.isVesting) {
            // Handle vesting
            uint256 releasable = _calculateVestedAmount(_share);
            _share.totalReceived += _amount;
            _share.pendingClaim += _amount;
        } else {
            _share.totalReceived += _amount;
            _share.pendingClaim += _amount;
        }
    }

    function _calculateVestedAmount(
        Share storage _share
    ) internal view returns (uint256) {
        if (!_share.isVesting) return _share.totalReceived - _share.released;

        VestingSchedule storage vesting = _share.vesting;

        if (block.timestamp < vesting.startTime + vesting.cliffDuration) {
            return 0;
        }

        if (block.timestamp >= vesting.startTime + vesting.duration) {
            return vesting.totalAmount;
        }

        uint256 timeVested = block.timestamp - vesting.startTime;
        return (vesting.totalAmount * timeVested) / vesting.duration;
    }

    // ============ Claiming ============

    function claim(
        uint256 _shareId
    ) external nonReentrant returns (uint256 amount) {
        Share storage share = shares[_shareId];
        require(share.recipient == msg.sender, "Not the recipient");
        require(share.isActive, "Share not active");
        require(share.pendingClaim > 0, "Nothing to claim");

        // Calculate claimable amount
        uint256 claimable = share.pendingClaim;

        // Check vesting if applicable
        if (share.isVesting) {
            uint256 releasable = _calculateVestedAmount(share);
            claimable = releasable > share.released
                ? releasable - share.released
                : 0;
            require(claimable > 0, "Nothing vested yet");
        }

        share.claimedAmount += claimable;
        share.lastClaimedAt = block.timestamp;
        share.pendingClaim = 0;

        // Transfer tokens
        address token = address(0); // Native token
        IERC20(token).safeTransfer(msg.sender, claimable);

        emit Claimed(_shareId, msg.sender, claimable);
        return claimable;
    }

    function claimAll() external nonReentrant returns (uint256 totalClaimed) {
        uint256[] storage shareIds = recipientShareIds[msg.sender];
        require(shareIds.length > 0, "No shares");

        for (uint256 i = 0; i < shareIds.length; i++) {
            Share storage share = shares[shareIds[i]];
            if (share.isActive && share.pendingClaim > 0) {
                totalClaimed += this.claim(shareIds[i]);
            }
        }

        return totalClaimed;
    }

    function claimForToken(
        address _token
    ) external nonReentrant returns (uint256 totalClaimed) {
        uint256[] storage shareIds = recipientShareIds[msg.sender];

        for (uint256 i = 0; i < shareIds.length; i++) {
            Share storage share = shares[shareIds[i]];
            if (share.isActive && share.pendingClaim > 0) {
                totalClaimed += this.claim(shareIds[i]);
            }
        }

        return totalClaimed;
    }

    // ============ Streaming Payments ============

    function startStream(
        address _recipient,
        uint256 _flowRate
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        require(_recipient != address(0), "Invalid recipient");
        require(_flowRate > 0, "Invalid flow rate");

        // Update previous stream if exists
        if (streamingBalances[_recipient] > 0) {
            _updateStream(_recipient);
        }

        streamFlowRate = _flowRate;
        streamingBalances[_recipient] = block.timestamp;
        lastStreamUpdate[_recipient] = block.timestamp;

        emit StreamStarted(_recipient, _flowRate);
    }

    function stopStream(
        address _recipient
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        require(streamingBalances[_recipient] > 0, "No active stream");

        uint256 finalAmount = _calculateStreamAmount(_recipient);

        streamingBalances[_recipient] = 0;
        lastStreamUpdate[_recipient] = 0;

        emit StreamStopped(_recipient, finalAmount);
    }

    function updateStreamRate(
        address _recipient,
        uint256 _newFlowRate
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        require(streamingBalances[_recipient] > 0, "No active stream");
        require(_newFlowRate > 0, "Invalid flow rate");

        // Settle current stream
        _updateStream(_recipient);
        streamFlowRate = _newFlowRate;

        emit StreamUpdated(_recipient, _newFlowRate);
    }

    function _updateStream(address _recipient) internal {
        uint256 accrued = _calculateStreamAmount(_recipient);
        lastStreamUpdate[_recipient] = block.timestamp;

        // Credit to recipient
        uint256[] storage shareIds = recipientShareIds[_recipient];
        for (uint256 i = 0; i < shareIds.length; i++) {
            shares[shareIds[i]].pendingClaim += accrued / shareIds.length;
        }
    }

    function _calculateStreamAmount(
        address _recipient
    ) internal view returns (uint256) {
        if (streamingBalances[_recipient] == 0) return 0;
        uint256 timeDelta = block.timestamp - lastStreamUpdate[_recipient];
        return timeDelta * streamFlowRate;
    }

    // ============ Allocation Rules ============

    function createAllocationRule(
        bytes32 _category,
        uint256 _allocation,
        address _recipient,
        bool _useVesting,
        VestingSchedule calldata _vesting
    ) external onlyRole(ALLOCATION_MANAGER_ROLE) returns (uint256 ruleId) {
        require(
            _allocation > 0 && _allocation <= BPS_DENOMINATOR,
            "Invalid allocation"
        );

        ruleId = ruleCount++;

        allocationRules[ruleId] = AllocationRule({
            ruleId: ruleId,
            category: _category,
            allocation: _allocation,
            recipient: _recipient,
            isActive: true,
            minThreshold: 0,
            maxCap: type(uint256).max,
            useVesting: _useVesting,
            vestingSchedule: _vesting
        });

        categoryRecipients[_category].push(_recipient);

        // Create share for recipient
        this.createShare(_recipient, _allocation, _useVesting, _vesting);

        emit AllocationRuleCreated(ruleId, _category, _allocation);
        return ruleId;
    }

    function updateAllocationRule(
        uint256 _ruleId,
        uint256 _newAllocation
    ) external onlyRole(ALLOCATION_MANAGER_ROLE) {
        AllocationRule storage rule = allocationRules[_ruleId];
        require(rule.isActive, "Rule not active");

        rule.allocation = _newAllocation;

        // Update associated share
        uint256[] storage shareIds = recipientShareIds[rule.recipient];
        for (uint256 i = 0; i < shareIds.length; i++) {
            Share storage share = shares[shareIds[i]];
            if (share.recipient == rule.recipient) {
                share.allocation = _newAllocation;
                break;
            }
        }

        emit AllocationRuleUpdated(_ruleId, _newAllocation);
    }

    // ============ Revenue Sources ============

    function registerRevenueSource(
        address _source,
        bytes32 _category
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        RevenueSource storage source = revenueSources[_source];
        source.source = _source;
        source.category = _category;
        source.isWhitelisted = true;

        emit RevenueSourceRegistered(_source, _category);
    }

    function setSupportedToken(
        address _token,
        bool _supported
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[_token] = _supported;
    }

    // ============ Treasury Management ============

    function updateTreasury(
        address _newTreasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newTreasury != address(0), "Invalid treasury");

        uint256 balance = address(this).balance;
        treasury = _newTreasury;
        treasuryBalance = balance;

        emit TreasuryUpdated(_newTreasury, balance);
    }

    function withdrawToTreasury(
        uint256 _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(treasury != address(0), "No treasury");
        require(_amount <= address(this).balance, "Insufficient balance");

        (bool success, ) = treasury.call{value: _amount}("");
        require(success, "Transfer failed");

        treasuryBalance -= _amount;
    }

    // ============ Vesting Controls ============

    function revokeVesting(
        uint256 _shareId
    ) external onlyRole(ALLOCATION_MANAGER_ROLE) {
        Share storage share = shares[_shareId];
        require(share.isVesting, "Not a vesting share");
        require(share.vesting.revocable == 1, "Not revocable");

        uint256 vested = _calculateVestedAmount(share);
        uint256 unvested = share.totalReceived - vested;

        share.isVesting = false;
        share.vesting.released = vested;

        if (unvested > 0) {
            // Return to treasury
            treasuryBalance += unvested;
        }

        emit VestingRevoked(_shareId, unvested);
    }

    // ============ View Functions ============

    function getRecipientInfo(
        address _recipient
    )
        external
        view
        returns (
            uint256 totalAllocation,
            uint256 totalClaimed,
            uint256 pendingClaim,
            uint256[] memory shareIds
        )
    {
        uint256 total;
        uint256 claimed;
        uint256 pending;
        uint256[] storage ids = recipientShareIds[_recipient];

        for (uint256 i = 0; i < ids.length; i++) {
            Share storage share = shares[ids[i]];
            if (share.recipient == _recipient) {
                total += share.allocation;
                claimed += share.claimedAmount;
                pending += share.pendingClaim;
            }
        }

        return (total, claimed, pending, ids);
    }

    function getShareInfo(
        uint256 _shareId
    )
        external
        view
        returns (
            address recipient,
            uint256 allocation,
            uint256 claimedAmount,
            uint256 pendingClaim,
            uint256 totalReceived,
            bool isActive,
            bool isVesting
        )
    {
        Share storage share = shares[_shareId];
        return (
            share.recipient,
            share.allocation,
            share.claimedAmount,
            share.pendingClaim,
            share.totalReceived,
            share.isActive,
            share.isVesting
        );
    }

    function getVestingInfo(
        uint256 _shareId
    )
        external
        view
        returns (
            uint256 startTime,
            uint256 cliffDuration,
            uint256 duration,
            uint256 releasable,
            uint256 totalAmount,
            uint256 released
        )
    {
        Share storage share = shares[_shareId];
        require(share.isVesting, "Not a vesting share");

        VestingSchedule storage vesting = share.vesting;
        uint256 releasableAmount = _calculateVestedAmount(share);

        return (
            vesting.startTime,
            vesting.cliffDuration,
            vesting.duration,
            releasableAmount > vesting.released
                ? releasableAmount - vesting.released
                : 0,
            vesting.totalAmount,
            vesting.released
        );
    }

    function getDistributionInfo(
        uint256 _distributionId
    )
        external
        view
        returns (
            address token,
            uint256 totalAmount,
            uint256 distributedAmount,
            uint256 remainingAmount,
            DistributionType distType,
            bool isActive
        )
    {
        Distribution storage dist = distributions[_distributionId];
        return (
            dist.token,
            dist.totalAmount,
            dist.distributedAmount,
            dist.remainingAmount,
            dist.distType,
            dist.isActive
        );
    }

    function getAllocationRule(
        uint256 _ruleId
    )
        external
        view
        returns (
            bytes32 category,
            uint256 allocation,
            address recipient,
            bool isActive
        )
    {
        AllocationRule storage rule = allocationRules[_ruleId];
        return (rule.category, rule.allocation, rule.recipient, rule.isActive);
    }

    function getRevenueSource(
        address _source
    )
        external
        view
        returns (
            bytes32 category,
            bool isWhitelisted,
            uint256 totalRevenue,
            uint256 lastDistribution
        )
    {
        RevenueSource storage source = revenueSources[_source];
        return (
            source.category,
            source.isWhitelisted,
            source.totalRevenue,
            source.lastDistribution
        );
    }

    function getPendingClaims(
        address _recipient
    ) external view returns (uint256 total) {
        uint256[] storage ids = recipientShareIds[_recipient];
        for (uint256 i = 0; i < ids.length; i++) {
            Share storage share = shares[ids[i]];
            if (share.isActive) {
                total += share.pendingClaim;
            }
        }
    }

    function getTotalAllocation() external view returns (uint256) {
        return _totalAllocations();
    }

    // Receive ETH
    receive() external payable {}
}
