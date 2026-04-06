// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title KeeperNetwork
 * @notice Automated task execution (compound, rebalance) by incentivized keepers
 * @dev Task registry, keeper bonding, and automated execution incentives
 */
contract KeeperNetwork is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant TASK_REGISTRAR_ROLE =
        keccak256("TASK_REGISTRAR_ROLE");
    bytes32 public constant KEEPER_ADMIN_ROLE = keccak256("KEEPER_ADMIN_ROLE");

    // Structs
    struct Keeper {
        address keeperAddress;
        uint256 bondedAmount;
        uint256 earnedRewards;
        uint256 totalExecutions;
        uint256 successfulExecutions;
        uint256 failedExecutions;
        uint256 lastExecution;
        uint256 registeredAt;
        bool isActive;
        bool isSlashed;
        uint256 reputation;
        KeeperTier tier;
    }

    enum KeeperTier {
        Bronze,
        Silver,
        Gold,
        Platinum
    }
    enum TaskType {
        Custom,
        Compound,
        Rebalance,
        Liquidate,
        Swap,
        Harvest
    }
    enum TaskStatus {
        Pending,
        Executing,
        Completed,
        Failed,
        Cancelled,
        Expired
    }
    enum Priority {
        Low,
        Medium,
        High,
        Critical
    }

    struct Task {
        uint256 taskId;
        address caller;
        address target;
        bytes callData;
        uint256 value;
        uint256 gasLimit;
        uint256 gasPrice;
        uint256 reward;
        uint256 fee;
        uint256 maxBaseFee;
        uint256 executeBefore;
        uint256 createdAt;
        TaskType taskType;
        TaskStatus status;
        Priority priority;
        uint256 minKeeperTier;
        bool requireBonded;
        uint256 anticipatoryBounty;
        bytes32 taskHash;
    }

    struct TaskExecution {
        uint256 taskId;
        address keeper;
        uint256 executionTime;
        uint256 gasUsed;
        uint256 gasCost;
        uint256 reward;
        uint256 fee;
        bool success;
        bytes returnData;
    }

    struct KeeperBonds {
        uint256 minBond;
        uint256 slashPercent;
        uint256 unbondPeriod;
    }

    // State
    IERC20 public immutable BOND_TOKEN;
    uint256 public totalBonded;
    uint256 public taskCount;
    uint256 public executionCount;
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Mappings
    mapping(address => Keeper) public keepers;
    mapping(address => uint256) public keeperCount; // Count of keepers per address
    mapping(uint256 => Task) public tasks;
    mapping(bytes32 => uint256[]) public taskExecutions; // taskId => executions
    mapping(address => uint256[]) public keeperTasks; // keeper => taskIds they've executed
    mapping(bytes32 => address) public pendingTasks; // taskHash => keeper assigned

    // Configuration
    KeeperBonds public bonds =
        KeeperBonds({
            minBond: 100e18,
            slashPercent: 1000, // 10%
            unbondPeriod: 14 days
        });

    // Keeper tiers - stored as individual mappings
    mapping(KeeperTier => uint256) public tierRequirements;

    // Rewards
    uint256 public baseRewardBps = 50; // 0.5%
    uint256 public priorityMultiplier = 200; // 2x for critical
    uint256 public keeperProfitMargin = 2000; // 20% profit margin target

    // Registry
    address[] public registeredKeepers;
    mapping(address => uint256) public keeperIndex;

    // Events
    event KeeperRegistered(
        address indexed keeper,
        uint256 bondAmount,
        KeeperTier tier
    );
    event KeeperActivated(address indexed keeper);
    event KeeperDeactivated(address indexed keeper, uint256 unbondAmount);
    event KeeperSlashed(
        address indexed keeper,
        uint256 slashAmount,
        string reason
    );
    event KeeperBonded(address indexed keeper, uint256 amount);
    event KeeperUnbonding(
        address indexed keeper,
        uint256 amount,
        uint256 unlockTime
    );
    event KeeperBondWithdrawn(address indexed keeper, uint256 amount);
    event TaskCreated(
        uint256 indexed taskId,
        address indexed caller,
        address target,
        TaskType taskType,
        uint256 reward
    );
    event TaskAssigned(uint256 indexed taskId, address indexed keeper);
    event TaskExecuted(
        uint256 indexed taskId,
        address indexed keeper,
        bool success,
        uint256 reward,
        uint256 gasCost
    );
    event TaskCancelled(uint256 indexed taskId, address indexed caller);
    event TaskExpired(uint256 indexed taskId);
    event RewardClaimed(address indexed keeper, uint256 amount);
    event KeeperTierUpgraded(address indexed keeper, KeeperTier newTier);
    event ConfigUpdated(uint256 baseRewardBps, uint256 priorityMultiplier);

    constructor(address _bondToken) {
        require(_bondToken != address(0), "Invalid token");
        BOND_TOKEN = IERC20(_bondToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TASK_REGISTRAR_ROLE, msg.sender);
        _grantRole(KEEPER_ADMIN_ROLE, msg.sender);
        
        // Set tier requirements
        tierRequirements[KeeperTier.Bronze] = 100e18;
        tierRequirements[KeeperTier.Silver] = 500e18;
        tierRequirements[KeeperTier.Gold] = 2000e18;
        tierRequirements[KeeperTier.Platinum] = 10000e18;
    }

    // ============ Keeper Registration ============

    function registerKeeper(
        uint256 _bondAmount
    ) external nonReentrant returns (bool success) {
        require(_bondAmount >= bonds.minBond, "Bond too low");
        require(!keepers[msg.sender].isActive, "Already registered");

        Keeper storage keeper = keepers[msg.sender];
        keeper.keeperAddress = msg.sender;
        keeper.bondedAmount = _bondAmount;
        keeper.registeredAt = block.timestamp;
        keeper.isActive = false; // Must be activated after bonding
        keeper.tier = _getTierForBond(_bondAmount);
        keeper.reputation = 100; // Start with max reputation

        BOND_TOKEN.safeTransferFrom(msg.sender, address(this), _bondAmount);
        totalBonded += _bondAmount;

        registeredKeepers.push(msg.sender);
        keeperIndex[msg.sender] = registeredKeepers.length - 1;

        emit KeeperRegistered(msg.sender, _bondAmount, keeper.tier);
        return true;
    }

    function _getTierForBond(uint256 _bond) internal view returns (KeeperTier) {
        if (_bond >= tierRequirements[KeeperTier.Platinum])
            return KeeperTier.Platinum;
        if (_bond >= tierRequirements[KeeperTier.Gold]) return KeeperTier.Gold;
        if (_bond >= tierRequirements[KeeperTier.Silver])
            return KeeperTier.Silver;
        return KeeperTier.Bronze;
    }

    function activateKeeper() external {
        Keeper storage keeper = keepers[msg.sender];
        require(keeper.keeperAddress == msg.sender, "Not registered");
        require(!keeper.isActive, "Already active");
        require(keeper.bondedAmount >= bonds.minBond, "Insufficient bond");

        keeper.isActive = true;

        emit KeeperActivated(msg.sender);
    }

    function deactivateKeeper() external nonReentrant {
        Keeper storage keeper = keepers[msg.sender];
        require(keeper.isActive, "Not active");
        require(
            keeper.totalExecutions > 0 ||
                block.timestamp - keeper.registeredAt > 24 hours,
            "Cannot unbond yet"
        );

        keeper.isActive = false;

        // Start unbonding period
        BOND_TOKEN.safeTransfer(msg.sender, keeper.bondedAmount);
        totalBonded -= keeper.bondedAmount;

        emit KeeperDeactivated(msg.sender, keeper.bondedAmount);
    }

    function bondExtra(uint256 _amount) external nonReentrant {
        Keeper storage keeper = keepers[msg.sender];
        require(keeper.keeperAddress == msg.sender, "Not registered");

        BOND_TOKEN.safeTransferFrom(msg.sender, address(this), _amount);
        keeper.bondedAmount += _amount;
        totalBonded += _amount;

        // Check for tier upgrade
        KeeperTier newTier = _getTierForBond(keeper.bondedAmount);
        if (newTier > keeper.tier) {
            keeper.tier = newTier;
            emit KeeperTierUpgraded(msg.sender, newTier);
        }

        emit KeeperBonded(msg.sender, _amount);
    }

    // ============ Task Management ============

    function createTask(
        address _target,
        bytes calldata _callData,
        uint256 _value,
        uint256 _gasLimit,
        uint256 _reward,
        uint256 _executeBefore,
        TaskType _taskType,
        Priority _priority,
        KeeperTier _minTier,
        bool _requireBonded
    ) external payable nonReentrant returns (uint256 taskId) {
        require(_target != address(0), "Invalid target");
        require(_executeBefore > block.timestamp, "Invalid deadline");
        require(_reward > 0, "Invalid reward");

        taskId = taskCount++;

        uint256 fee = (_reward * baseRewardBps) / BPS_DENOMINATOR;
        if (_priority == Priority.Critical) {
            fee = (fee * priorityMultiplier) / BPS_DENOMINATOR;
        }

        tasks[taskId] = Task({
            taskId: taskId,
            caller: msg.sender,
            target: _target,
            callData: _callData,
            value: _value,
            gasLimit: _gasLimit,
            gasPrice: 0,
            reward: _reward,
            fee: fee,
            maxBaseFee: 0,
            executeBefore: _executeBefore,
            createdAt: block.timestamp,
            taskType: _taskType,
            status: TaskStatus.Pending,
            priority: _priority,
            minKeeperTier: uint256(_minTier),
            requireBonded: _requireBonded,
            anticipatoryBounty: 0,
            taskHash: keccak256(
                abi.encode(_target, _callData, _value, _executeBefore)
            )
        });

        // Collect reward + fee
        uint256 totalPayment = _reward + fee;
        if (msg.value < totalPayment) {
            // Accept ETH for gas
            tasks[taskId].gasPrice = tx.gasprice;
        }

        emit TaskCreated(taskId, msg.sender, _target, _taskType, _reward);
        return taskId;
    }

    function createCompoundTask(
        address _yieldPool,
        bytes calldata _callData,
        uint256 _executeBefore,
        Priority _priority
    ) external payable returns (uint256 taskId) {
        return
            this.createTask(
                _yieldPool,
                _callData,
                0,
                500000,
                0.01 ether,
                _executeBefore,
                TaskType.Compound,
                _priority,
                KeeperTier.Silver,
                true
            );
    }

    function createRebalanceTask(
        address _sourceBridge,
        address _destBridge,
        uint256 _amount,
        uint256 _executeBefore,
        Priority _priority
    ) external payable returns (uint256 taskId) {
        bytes memory callData = abi.encodeWithSignature(
            "executeRebalance(address,address,uint256)",
            _sourceBridge,
            _destBridge,
            _amount
        );

        return
            this.createTask(
                address(this),
                callData,
                0,
                300000,
                0.02 ether,
                _executeBefore,
                TaskType.Rebalance,
                _priority,
                KeeperTier.Gold,
                true
            );
    }

    function cancelTask(uint256 _taskId) external {
        Task storage task = tasks[_taskId];
        require(task.caller == msg.sender, "Not the caller");
        require(task.status == TaskStatus.Pending, "Cannot cancel");

        task.status = TaskStatus.Cancelled;

        // Refund reward
        if (task.reward > 0) {
            payable(msg.sender).transfer(task.reward);
        }

        emit TaskCancelled(_taskId, msg.sender);
    }

    // ============ Task Execution ============

    function executeTask(
        uint256 _taskId
    ) external nonReentrant returns (bool success) {
        Task storage task = tasks[_taskId];
        Keeper storage keeper = keepers[msg.sender];

        // Validate keeper
        require(keeper.isActive, "Keeper not active");
        require(uint256(keeper.tier) >= task.minKeeperTier, "Insufficient tier");
        if (task.requireBonded) {
            require(keeper.bondedAmount >= bonds.minBond, "Insufficient bond");
        }

        // Validate task
        require(task.status == TaskStatus.Pending, "Task not pending");
        require(block.timestamp <= task.executeBefore, "Task expired");
        require(pendingTasks[task.taskHash] == address(0), "Already assigned");

        // Mark as executing
        task.status = TaskStatus.Executing;
        pendingTasks[task.taskHash] = msg.sender;

        uint256 gasStart = gasleft();

        // Execute
        (success, ) = task.target.call{value: task.value}(task.callData);

        uint256 gasUsed = gasStart - gasleft();

        // Calculate rewards
        uint256 gasCost = gasUsed * tx.gasprice;
        uint256 reward = task.reward + task.fee;

        if (success) {
            // Pay keeper
            keeper.earnedRewards += reward;
            keeper.successfulExecutions++;
            keeper.lastExecution = block.timestamp;
            keeper.reputation = _calculateReputation(keeper);

            task.status = TaskStatus.Completed;
        } else {
            keeper.failedExecutions++;
            keeper.reputation = keeper.reputation > 10
                ? keeper.reputation - 10
                : 0;

            task.status = TaskStatus.Failed;

            // Slash if bonded
            if (keeper.bondedAmount > 0) {
                uint256 slashAmount = (keeper.bondedAmount *
                    bonds.slashPercent) / BPS_DENOMINATOR;
                keeper.bondedAmount -= slashAmount;
                totalBonded -= slashAmount;
                emit KeeperSlashed(
                    msg.sender,
                    slashAmount,
                    "Failed task execution"
                );
            }
        }

        keeper.totalExecutions++;

        // Record execution
        uint256 execId = executionCount++;
        taskExecutions[bytes32(_taskId)].push(execId);
        keeperTasks[msg.sender].push(_taskId);

        delete pendingTasks[task.taskHash];

        emit TaskExecuted(_taskId, msg.sender, success, reward, gasCost);

        return success;
    }

    function _calculateReputation(
        Keeper storage _keeper
    ) internal view returns (uint256) {
        if (_keeper.totalExecutions == 0) return 100;

        uint256 successRate = (_keeper.successfulExecutions * 100) /
            _keeper.totalExecutions;
        uint256 baseReputation = successRate;

        // Adjust for tier
        uint256 tierBonus = uint256(_keeper.tier) * 5;

        return
            baseReputation + tierBonus > 100 ? 100 : baseReputation + tierBonus;
    }

    // ============ Keeper Selection ============

    function selectKeeper(
        uint256 _taskId
    ) external view returns (address keeper) {
        Task storage task = tasks[_taskId];
        require(task.status == TaskStatus.Pending, "Task not pending");

        // Find best keeper based on:
        // 1. Reputation
        // 2. Availability (recent executions)
        // 3. Tier
        // 4. Bond amount

        address bestKeeper;
        uint256 bestScore;

        for (uint256 i = 0; i < registeredKeepers.length; i++) {
            Keeper storage keeper = keepers[registeredKeepers[i]];

            if (!keeper.isActive) continue;
            if (uint256(keeper.tier) < task.minKeeperTier) continue;
            if (keeper.bondedAmount < bonds.minBond) continue;

            // Check if keeper is available (not executing too frequently)
            if (
                keeper.totalExecutions > 0 &&
                block.timestamp - keeper.lastExecution < 1 minutes
            ) {
                continue;
            }

            // Calculate score
            uint256 score = keeper.reputation *
                10 +
                uint256(keeper.tier) *
                5 +
                keeper.bondedAmount /
                1e18;

            if (score > bestScore) {
                bestScore = score;
                bestKeeper = registeredKeepers[i];
            }
        }

        return bestKeeper;
    }

    // ============ Rewards ============

    function claimRewards() external nonReentrant {
        Keeper storage keeper = keepers[msg.sender];
        require(keeper.earnedRewards > 0, "No rewards to claim");

        uint256 reward = keeper.earnedRewards;
        keeper.earnedRewards = 0;

        BOND_TOKEN.safeTransfer(msg.sender, reward);

        emit RewardClaimed(msg.sender, reward);
    }

    // ============ Slash Management ============

    function slashKeeper(
        address _keeper,
        uint256 _amount,
        string calldata _reason
    ) external onlyRole(KEEPER_ADMIN_ROLE) {
        Keeper storage keeper = keepers[_keeper];
        require(keeper.bondedAmount >= _amount, "Insufficient bond");

        keeper.bondedAmount -= _amount;
        totalBonded -= _amount;

        emit KeeperSlashed(_keeper, _amount, _reason);
    }

    // ============ Admin Functions ============

    function updateBondConfig(
        uint256 _minBond,
        uint256 _slashPercent,
        uint256 _unbondPeriod
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bonds.minBond = _minBond;
        bonds.slashPercent = _slashPercent;
        bonds.unbondPeriod = _unbondPeriod;
    }

    function updateTierRequirements(
        uint256 _bronze,
        uint256 _silver,
        uint256 _gold,
        uint256 _platinum
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tierRequirements[KeeperTier.Bronze] = _bronze;
        tierRequirements[KeeperTier.Silver] = _silver;
        tierRequirements[KeeperTier.Gold] = _gold;
        tierRequirements[KeeperTier.Platinum] = _platinum;
    }

    function updateRewards(
        uint256 _baseRewardBps,
        uint256 _priorityMultiplier_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseRewardBps = _baseRewardBps;
        priorityMultiplier = _priorityMultiplier_;
        emit ConfigUpdated(_baseRewardBps, _priorityMultiplier_);
    }

    // ============ View Functions ============

    function getKeeperInfo(
        address _keeper
    )
        external
        view
        returns (
            uint256 bondedAmount,
            uint256 earnedRewards,
            uint256 totalExecutions,
            uint256 successfulExecutions,
            bool isActive,
            KeeperTier tier,
            uint256 reputation
        )
    {
        Keeper storage keeper = keepers[_keeper];
        return (
            keeper.bondedAmount,
            keeper.earnedRewards,
            keeper.totalExecutions,
            keeper.successfulExecutions,
            keeper.isActive,
            keeper.tier,
            keeper.reputation
        );
    }

    function getTaskInfo(
        uint256 _taskId
    )
        external
        view
        returns (
            address caller,
            address target,
            uint256 reward,
            uint256 fee,
            uint256 executeBefore,
            TaskType taskType,
            TaskStatus status,
            Priority priority
        )
    {
        Task storage task = tasks[_taskId];
        return (
            task.caller,
            task.target,
            task.reward,
            task.fee,
            task.executeBefore,
            task.taskType,
            task.status,
            task.priority
        );
    }

    function getKeeperExecutions(
        address _keeper,
        uint256 _count
    ) external view returns (uint256[] memory taskIds) {
        uint256[] storage allTasks = keeperTasks[_keeper];
        uint256 start = allTasks.length > _count ? allTasks.length - _count : 0;
        uint256 length = allTasks.length > _count ? _count : allTasks.length;

        taskIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            taskIds[i] = allTasks[start + i];
        }

        return taskIds;
    }

    function getPendingTasks(
        Priority _minPriority,
        KeeperTier _minTier
    ) external view returns (uint256[] memory taskIds) {
        uint256 count;
        for (uint256 i = 0; i < taskCount; i++) {
            if (
                tasks[i].status == TaskStatus.Pending &&
                tasks[i].priority >= _minPriority &&
                KeeperTier(tasks[i].minKeeperTier) <= _minTier
            ) {
                count++;
            }
        }

        taskIds = new uint256[](count);
        uint256 idx;
        for (uint256 i = 0; i < taskCount; i++) {
            if (
                tasks[i].status == TaskStatus.Pending &&
                tasks[i].priority >= _minPriority &&
                KeeperTier(tasks[i].minKeeperTier) <= _minTier
            ) {
                taskIds[idx++] = i;
            }
        }

        return taskIds;
    }

    function getActiveKeeperCount() external view returns (uint256) {
        uint256 count;
        for (uint256 i = 0; i < registeredKeepers.length; i++) {
            if (keepers[registeredKeepers[i]].isActive) {
                count++;
            }
        }
        return count;
    }

    function getKeeperRanking()
        external
        view
        returns (address[] memory keepers_, uint256[] memory scores)
    {
        address[] memory allKeepers = registeredKeepers;
        scores = new uint256[](allKeepers.length);

        for (uint256 i = 0; i < allKeepers.length; i++) {
            Keeper storage keeper = keepers[allKeepers[i]];
            scores[i] =
                keeper.reputation *
                100 +
                uint256(keeper.tier) *
                50 +
                keeper.totalExecutions;
        }

        // Sort by score (simplified bubble sort)
        for (uint256 i = 0; i < allKeepers.length - 1; i++) {
            for (uint256 j = 0; j < allKeepers.length - i - 1; j++) {
                if (scores[j] < scores[j + 1]) {
                    (scores[j], scores[j + 1]) = (scores[j + 1], scores[j]);
                    (allKeepers[j], allKeepers[j + 1]) = (
                        allKeepers[j + 1],
                        allKeepers[j]
                    );
                }
            }
        }

        return (allKeepers, scores);
    }

    function getNetworkStats()
        external
        view
        returns (
            uint256 totalBonded,
            uint256 activeKeepers,
            uint256 pendingTasks,
            uint256 totalExecutions,
            uint256 totalRewards
        )
    {
        uint256 active;
        uint256 pending;
        uint256 executions;
        uint256 rewards;

        for (uint256 i = 0; i < registeredKeepers.length; i++) {
            Keeper storage keeper = keepers[registeredKeepers[i]];
            if (keeper.isActive) active++;
            rewards += keeper.earnedRewards;
        }

        for (uint256 i = 0; i < taskCount; i++) {
            if (tasks[i].status == TaskStatus.Pending) pending++;
            executions += taskExecutions[bytes32(tasks[i].taskId)].length;
        }

        return (totalBonded, active, pending, executions, rewards);
    }
}
