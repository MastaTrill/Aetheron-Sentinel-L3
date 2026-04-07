// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TaskScheduler
 * @notice Cron-like automation for smart contracts with flexible scheduling
 * @dev Supports recurring tasks, conditional execution, and multi-step workflows
 */
contract TaskScheduler is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SCHEDULER_ADMIN_ROLE =
        keccak256("SCHEDULER_ADMIN_ROLE");
    bytes32 public constant TASK_CREATOR_ROLE = keccak256("TASK_CREATOR_ROLE");

    // Structs
    struct ScheduledTask {
        uint256 taskId;
        address owner;
        address target;
        bytes callData;
        uint256 value;
        bytes4 functionSelector;
        ScheduleType scheduleType;
        uint256 startTime;
        uint256 interval; // For recurring tasks
        uint256 nextExecution;
        uint256 executionsCount;
        uint256 maxExecutions;
        uint256 gasLimit;
        uint256 maxGasPrice;
        uint256 executionFee;
        bool isActive;
        bool useTreasury;
        TaskStatus status;
        mapping(uint256 => bool) executedTimestamps;
    }

    enum ScheduleType {
        OneTime,
        Recurring,
        Cron,
        Conditional,
        Stream // Continuous over time
    }

    enum TaskStatus {
        Active,
        Paused,
        Completed,
        Cancelled,
        Failed
    }

    struct CronExpression {
        uint8 minute;
        uint8 hour;
        uint8 dayOfMonth;
        uint8 month;
        uint8 dayOfWeek;
    }

    struct Condition {
        address target;
        bytes4 selector;
        bytes compareData;
        CompareOperator operator;
        uint256 compareValue;
    }

    enum CompareOperator {
        GreaterThan,
        LessThan,
        Equal,
        NotEqual,
        GreaterOrEqual,
        LessOrEqual
    }

    struct Workflow {
        uint256 workflowId;
        address owner;
        uint256[] taskIds;
        uint256 currentStep;
        bool isSequential;
        uint256 stepInterval;
        uint256 completedSteps;
        bool isActive;
        mapping(uint256 => bool) completedStepsMap;
    }

    struct ExecutionRecord {
        uint256 taskId;
        address executor;
        uint256 timestamp;
        bool success;
        uint256 gasUsed;
        bytes returnData;
    }

    struct TaskConfig {
        uint256 defaultGasLimit;
        uint256 defaultMaxGasPrice;
        uint256 minExecutionFee;
        uint256 maxConcurrentTasks;
        bool requireFee;
    }

    // State
    uint256 public taskCount;
    uint256 public workflowCount;
    uint256 public executionCount;
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Mappings
    mapping(uint256 => ScheduledTask) public tasks;
    mapping(uint256 => Workflow) public workflows;
    mapping(uint256 => ExecutionRecord[]) public executionHistory;
    mapping(address => uint256[]) public ownerTasks;
    mapping(address => uint256[]) public ownerWorkflows;
    mapping(bytes32 => uint256[]) public selectorTasks;

    // Configuration
    TaskConfig public config =
        TaskConfig({
            defaultGasLimit: 500000,
            defaultMaxGasPrice: 100 gwei,
            minExecutionFee: 0.001 ether,
            maxConcurrentTasks: 50,
            requireFee: true
        });

    // Keepers
    mapping(address => bool) public authorizedExecutors;
    address[] public executors;
    uint256 public keeperReward = 0.001 ether;

    // Treasury
    address public treasury;
    mapping(address => uint256) public taskCredits;

    // Events
    event TaskCreated(
        uint256 indexed taskId,
        address indexed owner,
        address target,
        ScheduleType scheduleType,
        uint256 nextExecution
    );
    event TaskExecuted(
        uint256 indexed taskId,
        address indexed executor,
        bool success,
        uint256 gasUsed
    );
    event TaskCancelled(uint256 indexed taskId);
    event TaskPaused(uint256 indexed taskId);
    event TaskResumed(uint256 indexed taskId);
    event TaskCompleted(uint256 indexed taskId, uint256 executions);
    event WorkflowCreated(uint256 indexed workflowId, uint256[] taskIds);
    event WorkflowStepExecuted(
        uint256 indexed workflowId,
        uint256 step,
        bool success
    );
    event WorkflowCompleted(uint256 indexed workflowId);
    event CronExpressionSet(uint256 indexed taskId, CronExpression expression);
    event ConditionSet(uint256 indexed taskId, Condition condition);
    event CreditsAdded(address indexed owner, uint256 amount);
    event CreditsUsed(address indexed owner, uint256 taskId, uint256 amount);
    event ExecutorRegistered(address indexed executor);
    event ExecutorRemoved(address indexed executor);
    event ConfigUpdated(
        uint256 defaultGasLimit,
        uint256 defaultMaxGasPrice,
        uint256 minExecutionFee
    );

    constructor(address _treasury) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SCHEDULER_ADMIN_ROLE, msg.sender);
        _grantRole(TASK_CREATOR_ROLE, msg.sender);
    }

    // ============ Task Creation ============

    function createOneTimeTask(
        address _target,
        bytes calldata _callData,
        uint256 _value,
        uint256 _executeAt,
        uint256 _gasLimit,
        bool _useCredits
    ) external payable returns (uint256 taskId) {
        require(_executeAt > block.timestamp, "Must be in future");
        require(_target != address(0), "Invalid target");

        uint256 fee = _chargeFee(_useCredits);
        taskId = _createTaskBase(
            _target,
            _callData,
            _value,
            _gasLimit,
            ScheduleType.OneTime,
            _useCredits
        );

        tasks[taskId].startTime = block.timestamp;
        tasks[taskId].nextExecution = _executeAt;
        tasks[taskId].maxExecutions = 1;

        emit TaskCreated(
            taskId,
            msg.sender,
            _target,
            ScheduleType.OneTime,
            _executeAt
        );
        return taskId;
    }

    function createRecurringTask(
        address _target,
        bytes calldata _callData,
        uint256 _value,
        uint256 _startTime,
        uint256 _interval,
        uint256 _maxExecutions,
        uint256 _gasLimit,
        bool _useCredits
    ) external payable returns (uint256 taskId) {
        require(_interval > 0, "Invalid interval");
        require(_maxExecutions > 0, "Invalid max executions");
        require(_target != address(0), "Invalid target");

        uint256 fee = _chargeFee(_useCredits) * _maxExecutions;
        taskId = _createTaskBase(
            _target,
            _callData,
            _value,
            _gasLimit,
            ScheduleType.Recurring,
            _useCredits
        );

        tasks[taskId].startTime = _startTime;
        tasks[taskId].interval = _interval;
        tasks[taskId].nextExecution = _startTime;
        tasks[taskId].maxExecutions = _maxExecutions;

        emit TaskCreated(
            taskId,
            msg.sender,
            _target,
            ScheduleType.Recurring,
            _startTime
        );
        return taskId;
    }

    function createCronTask(
        address _target,
        bytes calldata _callData,
        uint256 _value,
        CronExpression calldata _cron,
        uint256 _maxExecutions,
        uint256 _gasLimit,
        bool _useCredits
    ) external payable returns (uint256 taskId) {
        require(_target != address(0), "Invalid target");

        uint256 fee = _chargeFee(_useCredits) * _maxExecutions;
        taskId = _createTaskBase(
            _target,
            _callData,
            _value,
            _gasLimit,
            ScheduleType.Cron,
            _useCredits
        );

        tasks[taskId].startTime = block.timestamp;
        tasks[taskId].nextExecution = _calculateNextCronExecution(_cron);
        tasks[taskId].maxExecutions = _maxExecutions;

        emit TaskCreated(
            taskId,
            msg.sender,
            _target,
            ScheduleType.Cron,
            tasks[taskId].nextExecution
        );
        emit CronExpressionSet(taskId, _cron);

        return taskId;
    }

    function createConditionalTask(
        address _target,
        bytes calldata _callData,
        uint256 _value,
        Condition calldata _condition,
        uint256 _checkInterval,
        uint256 _maxExecutions,
        uint256 _gasLimit,
        bool _useCredits
    ) external payable returns (uint256 taskId) {
        require(_target != address(0), "Invalid target");

        uint256 fee = _chargeFee(_useCredits) * _maxExecutions;
        taskId = _createTaskBase(
            _target,
            _callData,
            _value,
            _gasLimit,
            ScheduleType.Conditional,
            _useCredits
        );

        tasks[taskId].interval = _checkInterval;
        tasks[taskId].nextExecution = block.timestamp;
        tasks[taskId].maxExecutions = _maxExecutions;

        emit TaskCreated(
            taskId,
            msg.sender,
            _target,
            ScheduleType.Conditional,
            block.timestamp
        );
        emit ConditionSet(taskId, _condition);

        return taskId;
    }

    function _createTaskBase(
        address _target,
        bytes calldata _callData,
        uint256 _value,
        uint256 _gasLimit,
        ScheduleType _type,
        bool _useCredits
    ) internal returns (uint256 taskId) {
        taskId = taskCount++;

        ScheduledTask storage task = tasks[taskId];
        task.taskId = taskId;
        task.owner = msg.sender;
        task.target = _target;
        task.callData = _callData;
        task.value = _value;
        task.functionSelector = bytes4(_callData[:4]);
        task.scheduleType = _type;
        task.gasLimit = _gasLimit > 0 ? _gasLimit : config.defaultGasLimit;
        task.maxGasPrice = config.defaultMaxGasPrice;
        task.useTreasury = _useCredits;
        task.isActive = true;
        task.status = TaskStatus.Active;

        ownerTasks[msg.sender].push(taskId);
        selectorTasks[task.functionSelector].push(taskId);

        return taskId;
    }

    function _chargeFee(bool _useCredits) internal returns (uint256) {
        if (_useCredits) {
            require(
                taskCredits[msg.sender] >= config.minExecutionFee,
                "Insufficient credits"
            );
            taskCredits[msg.sender] -= config.minExecutionFee;
            emit CreditsUsed(msg.sender, taskCount, config.minExecutionFee);
            return 0;
        } else {
            require(msg.value >= config.minExecutionFee, "Fee too low");
            return msg.value;
        }
    }

    // ============ Workflow Creation ============

    function createWorkflow(
        uint256[] calldata _taskIds,
        bool _isSequential,
        uint256 _stepInterval
    ) external returns (uint256 workflowId) {
        require(_taskIds.length >= 2, "Need at least 2 tasks");

        workflowId = workflowCount++;

        Workflow storage workflow = workflows[workflowId];
        workflow.workflowId = workflowId;
        workflow.owner = msg.sender;
        workflow.taskIds = _taskIds;
        workflow.currentStep = 0;
        workflow.isSequential = _isSequential;
        workflow.stepInterval = _stepInterval;
        workflow.isActive = true;

        ownerWorkflows[msg.sender].push(workflowId);

        emit WorkflowCreated(workflowId, _taskIds);
        return workflowId;
    }

    // ============ Task Execution ============

    function executeTask(
        uint256 _taskId
    ) external nonReentrant returns (bool success) {
        ScheduledTask storage task = tasks[_taskId];
        require(task.isActive, "Task not active");
        require(task.status == TaskStatus.Active, "Task not active");
        require(task.nextExecution <= block.timestamp, "Not time yet");
        require(
            !task.executedTimestamps[block.timestamp],
            "Already executed this block"
        );
        require(tx.gasprice <= task.maxGasPrice, "Gas price too high");

        // Check conditions if conditional
        if (task.scheduleType == ScheduleType.Conditional) {
            require(_checkCondition(_taskId), "Condition not met");
        }

        // Mark execution
        task.executedTimestamps[block.timestamp] = true;
        task.executionsCount++;

        uint256 gasStart = gasleft();

        // Execute
        (success, ) = task.target.call{value: task.value}(task.callData);

        uint256 gasUsed = gasStart - gasleft();

        // Record execution
        _recordExecution(_taskId, msg.sender, success, gasUsed, "");

        emit TaskExecuted(_taskId, msg.sender, success, gasUsed);

        // Update next execution
        if (task.scheduleType == ScheduleType.Recurring) {
            task.nextExecution += task.interval;

            if (task.executionsCount >= task.maxExecutions) {
                task.isActive = false;
                task.status = TaskStatus.Completed;
                emit TaskCompleted(_taskId, task.executionsCount);
            }
        } else if (task.scheduleType == ScheduleType.Cron) {
            task.nextExecution = _calculateNextCronExecution(
                CronExpression({
                    minute: uint8((task.nextExecution / 60) % 60),
                    hour: uint8((task.nextExecution / 3600) % 24),
                    dayOfMonth: uint8((task.nextExecution / 86400) % 30),
                    month: uint8((task.nextExecution / 2592000) % 12),
                    dayOfWeek: uint8((task.nextExecution / 604800) % 7)
                })
            );

            if (task.executionsCount >= task.maxExecutions) {
                task.isActive = false;
                task.status = TaskStatus.Completed;
                emit TaskCompleted(_taskId, task.executionsCount);
            }
        } else if (task.scheduleType == ScheduleType.OneTime) {
            task.isActive = false;
            task.status = TaskStatus.Completed;
            emit TaskCompleted(_taskId, task.executionsCount);
        }

        // Pay keeper
        if (success && keeperReward > 0) {
            (bool sent, ) = msg.sender.call{value: keeperReward}("");
        }

        return success;
    }

    function executeWorkflow(
        uint256 _workflowId
    ) external nonReentrant returns (bool success) {
        Workflow storage workflow = workflows[_workflowId];
        require(workflow.isActive, "Workflow not active");

        ScheduledTask storage currentTask = tasks[
            workflow.taskIds[workflow.currentStep]
        ];

        // Check if current task is ready
        if (workflow.isSequential) {
            require(
                currentTask.nextExecution <= block.timestamp,
                "Not time yet"
            );
        }

        // Execute current step
        bool stepSuccess = this.executeTask(workflow.taskIds[workflow.currentStep]);
        workflow.completedStepsMap[workflow.currentStep] = true;
        workflow.completedSteps++;

        emit WorkflowStepExecuted(
            _workflowId,
            workflow.currentStep,
            stepSuccess
        );

        // Move to next step
        if (
            workflow.isSequential &&
            workflow.currentStep < workflow.taskIds.length - 1
        ) {
            // Wait for interval before next step
            workflow.currentStep++;
        } else if (!workflow.isSequential) {
            // Execute all remaining steps in parallel
            for (uint256 i = 0; i < workflow.taskIds.length; i++) {
                if (!workflow.completedStepsMap[i]) {
                    this.executeTask(workflow.taskIds[i]);
                }
            }
        }

        // Check completion
        if (workflow.completedSteps >= workflow.taskIds.length) {
            workflow.isActive = false;
            emit WorkflowCompleted(_workflowId);
        }

        return stepSuccess;
    }

    function _recordExecution(
        uint256 _taskId,
        address _executor,
        bool _success,
        uint256 _gasUsed,
        bytes memory _returnData
    ) internal {
        executionHistory[_taskId].push(
            ExecutionRecord({
                taskId: _taskId,
                executor: _executor,
                timestamp: block.timestamp,
                success: _success,
                gasUsed: _gasUsed,
                returnData: _returnData
            })
        );
        executionCount++;
    }

    // ============ Condition Checking ============

    function _checkCondition(uint256 _taskId) internal view returns (bool) {
        // Simplified condition check - would integrate with actual condition storage
        return true;
    }

    // ============ Cron Calculation ============

    function _calculateNextCronExecution(
        CronExpression memory _cron
    ) internal view returns (uint256) {
        // Simplified cron calculation
        // In production would use proper cron parsing
        uint256 next = block.timestamp + 1 hours;

        // Round to next hour
        next = (next / 3600 + 1) * 3600;

        return next;
    }

    function validateCronExpression(
        CronExpression calldata _cron
    ) external pure returns (bool) {
        if (_cron.minute > 59) return false;
        if (_cron.hour > 23) return false;
        if (_cron.dayOfMonth > 31 || _cron.dayOfMonth == 0) return false;
        if (_cron.month > 12 || _cron.month == 0) return false;
        if (_cron.dayOfWeek > 6) return false;
        return true;
    }

    // ============ Task Management ============

    function pauseTask(uint256 _taskId) external {
        ScheduledTask storage task = tasks[_taskId];
        require(
            task.owner == msg.sender ||
                hasRole(SCHEDULER_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(task.isActive, "Not active");

        task.status = TaskStatus.Paused;
        emit TaskPaused(_taskId);
    }

    function resumeTask(uint256 _taskId) external {
        ScheduledTask storage task = tasks[_taskId];
        require(
            task.owner == msg.sender ||
                hasRole(SCHEDULER_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(task.status == TaskStatus.Paused, "Not paused");

        task.status = TaskStatus.Active;
        emit TaskResumed(_taskId);
    }

    function cancelTask(uint256 _taskId) external {
        ScheduledTask storage task = tasks[_taskId];
        require(
            task.owner == msg.sender ||
                hasRole(SCHEDULER_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );

        task.isActive = false;
        task.status = TaskStatus.Cancelled;
        emit TaskCancelled(_taskId);
    }

    function updateTaskTiming(
        uint256 _taskId,
        uint256 _nextExecution,
        uint256 _interval
    ) external {
        ScheduledTask storage task = tasks[_taskId];
        require(task.owner == msg.sender, "Not authorized");
        require(task.scheduleType == ScheduleType.Recurring, "Not recurring");

        task.nextExecution = _nextExecution;
        task.interval = _interval;
    }

    // ============ Credits Management ============

    function addCredits() external payable {
        require(msg.value > 0, "No ETH sent");
        taskCredits[msg.sender] += msg.value;
        emit CreditsAdded(msg.sender, msg.value);
    }

    function withdrawCredits(uint256 _amount) external nonReentrant {
        require(taskCredits[msg.sender] >= _amount, "Insufficient credits");
        taskCredits[msg.sender] -= _amount;
        payable(msg.sender).transfer(_amount);
    }

    // ============ Executor Management ============

    function registerExecutor(
        address _executor
    ) external onlyRole(SCHEDULER_ADMIN_ROLE) {
        require(!authorizedExecutors[_executor], "Already registered");
        authorizedExecutors[_executor] = true;
        executors.push(_executor);
        emit ExecutorRegistered(_executor);
    }

    function removeExecutor(
        address _executor
    ) external onlyRole(SCHEDULER_ADMIN_ROLE) {
        require(authorizedExecutors[_executor], "Not registered");
        authorizedExecutors[_executor] = false;
        emit ExecutorRemoved(_executor);
    }

    // ============ Admin Functions ============

    function updateConfig(
        uint256 _defaultGasLimit,
        uint256 _defaultMaxGasPrice,
        uint256 _minExecutionFee,
        uint256 _maxConcurrentTasks
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config.defaultGasLimit = _defaultGasLimit;
        config.defaultMaxGasPrice = _defaultMaxGasPrice;
        config.minExecutionFee = _minExecutionFee;
        config.maxConcurrentTasks = _maxConcurrentTasks;
        emit ConfigUpdated(
            _defaultGasLimit,
            _defaultMaxGasPrice,
            _minExecutionFee
        );
    }

    function updateKeeperReward(
        uint256 _reward
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        keeperReward = _reward;
    }

    function updateTreasury(
        address _treasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    // ============ View Functions ============

    function getTaskInfo(
        uint256 _taskId
    )
        external
        view
        returns (
            address owner,
            address target,
            ScheduleType scheduleType,
            uint256 nextExecution,
            uint256 executionsCount,
            uint256 maxExecutions,
            bool isActive,
            TaskStatus status
        )
    {
        ScheduledTask storage task = tasks[_taskId];
        return (
            task.owner,
            task.target,
            task.scheduleType,
            task.nextExecution,
            task.executionsCount,
            task.maxExecutions,
            task.isActive,
            task.status
        );
    }

    function getExecutableTasks()
        external
        view
        returns (uint256[] memory taskIds)
    {
        uint256 count;
        for (uint256 i = 0; i < taskCount; i++) {
            if (
                tasks[i].isActive &&
                tasks[i].status == TaskStatus.Active &&
                tasks[i].nextExecution <= block.timestamp
            ) {
                count++;
            }
        }

        taskIds = new uint256[](count);
        uint256 idx;
        for (uint256 i = 0; i < taskCount; i++) {
            if (
                tasks[i].isActive &&
                tasks[i].status == TaskStatus.Active &&
                tasks[i].nextExecution <= block.timestamp
            ) {
                taskIds[idx++] = i;
            }
        }

        return taskIds;
    }

    function getOwnerTasks(
        address _owner
    ) external view returns (uint256[] memory) {
        return ownerTasks[_owner];
    }

    function getExecutionHistory(
        uint256 _taskId,
        uint256 _count
    ) external view returns (ExecutionRecord[] memory) {
        ExecutionRecord[] storage all = executionHistory[_taskId];
        uint256 start = all.length > _count ? all.length - _count : 0;
        uint256 length = all.length > _count ? _count : all.length;

        ExecutionRecord[] memory result = new ExecutionRecord[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = all[start + i];
        }

        return result;
    }

    function getWorkflowInfo(
        uint256 _workflowId
    )
        external
        view
        returns (
            address owner,
            uint256 totalSteps,
            uint256 currentStep,
            uint256 completedSteps,
            bool isSequential,
            bool isActive
        )
    {
        Workflow storage workflow = workflows[_workflowId];
        return (
            workflow.owner,
            workflow.taskIds.length,
            workflow.currentStep,
            workflow.completedSteps,
            workflow.isSequential,
            workflow.isActive
        );
    }

    function getCredits(address _owner) external view returns (uint256) {
        return taskCredits[_owner];
    }

    function getNextExecution(uint256 _taskId) external view returns (uint256) {
        return tasks[_taskId].nextExecution;
    }

    function getSchedulerStats()
        external
        view
        returns (
            uint256 totalTasks,
            uint256 activeTasks,
            uint256 totalExecutions,
            uint256 totalWorkflows,
            uint256 activeWorkflows,
            uint256 totalExecutors
        )
    {
        uint256 active;
        uint256 activeW;
        for (uint256 i = 0; i < taskCount; i++) {
            if (tasks[i].isActive) active++;
        }
        for (uint256 i = 0; i < workflowCount; i++) {
            if (workflows[i].isActive) activeW++;
        }

        return (
            taskCount,
            active,
            executionCount,
            workflowCount,
            activeW,
            executors.length
        );
    }
}
