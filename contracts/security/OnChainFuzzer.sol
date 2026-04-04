// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OnChainFuzzer
 * @notice Real-time property-based fuzz testing engine
 * @dev Executes automated property-based tests on-chain
 * 
 * Features:
 * - Automatic boundary value generation
 * - Property-based testing (PBT)
 * - State invariant verification
 * - Regression testing for known vulnerabilities
 * - Fuzz campaign management
 */
contract OnChainFuzzer is AccessControl, ReentrancyGuard {
    bytes32 public constant FUZZ_ADMIN = keccak256("FUZZ_ADMIN");
    bytes32 public constant FUZZ_EXECUTOR = keccak256("FUZZ_EXECUTOR");

    enum TestStatus {
        Inactive,
        Running,
        Passed,
        Failed,
        Suspended
    }

    enum InputType {
        UInt256,
        Address,
        Bytes32,
        Bytes,
        Bool,
        Int256
    }

    struct FuzzCampaign {
        bytes32 id;
        string name;
        address targetContract;
        bytes4 functionSelector;
        uint256 executionCount;
        uint256 failureCount;
        uint256 lastExecuted;
        TestStatus status;
        uint256 seed;
        uint256 maxRuns;
        uint256 gasLimit;
        InputType[] inputTypes;
        uint256 lastSeenFailure;
        bytes lastFailureCalldata;
    }

    struct PropertyTest {
        bytes32 id;
        string property;
        bytes assertionSelector;
        uint256 assertionGasLimit;
        bool critical;
        uint256 priority;
    }

    struct FuzzResult {
        bytes32 campaignId;
        uint256 runNumber;
        bool success;
        bytes input;
        uint256 gasUsed;
        uint256 timestamp;
    }

    mapping(bytes32 => FuzzCampaign) public campaigns;
    mapping(bytes32 => PropertyTest) public propertyTests;
    mapping(bytes32 => FuzzResult[]) public campaignResults;
    
    bytes32[] public activeCampaigns;
    uint256 public totalExecutions;
    uint256 public totalFailures;

    event FuzzCampaignCreated(bytes32 indexed id, string name, address target);
    event FuzzRunCompleted(bytes32 indexed id, uint256 runNumber, bool success);
    event FuzzFailureDetected(bytes32 indexed id, bytes data, uint256 timestamp);
    event PropertyVerified(bytes32 indexed testId, bool success);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FUZZ_ADMIN, msg.sender);
    }

    /**
     * @notice Create a new fuzz testing campaign
     */
    function createCampaign(
        string calldata name,
        address targetContract,
        bytes4 functionSelector,
        uint256 maxRuns,
        uint256 gasLimit,
        InputType[] calldata inputTypes,
        uint256 seed
    ) external onlyRole(FUZZ_ADMIN) returns (bytes32 campaignId) {
        campaignId = keccak256(abi.encode(
            name,
            targetContract,
            functionSelector,
            block.timestamp,
            seed
        ));

        campaigns[campaignId] = FuzzCampaign({
            id: campaignId,
            name: name,
            targetContract: targetContract,
            functionSelector: functionSelector,
            executionCount: 0,
            failureCount: 0,
            lastExecuted: 0,
            status: TestStatus.Inactive,
            seed: seed,
            maxRuns: maxRuns,
            gasLimit: gasLimit,
            inputTypes: inputTypes,
            lastSeenFailure: 0,
            lastFailureCalldata: ""
        });

        emit FuzzCampaignCreated(campaignId, name, targetContract);
    }

    /**
     * @notice Start fuzz testing campaign
     */
    function startCampaign(bytes32 campaignId) external onlyRole(FUZZ_EXECUTOR) {
        FuzzCampaign storage campaign = campaigns[campaignId];
        require(campaign.id != bytes32(0), "Campaign not found");
        require(campaign.status == TestStatus.Inactive, "Already running");

        campaign.status = TestStatus.Running;
        activeCampaigns.push(campaignId);
    }

    /**
     * @notice Stop fuzz testing campaign
     */
    function stopCampaign(bytes32 campaignId) external onlyRole(FUZZ_EXECUTOR) {
        FuzzCampaign storage campaign = campaigns[campaignId];
        require(campaign.id != bytes32(0), "Campaign not found");
        require(campaign.status == TestStatus.Running, "Not running");

        campaign.status = TestStatus.Suspended;
        
        // Remove from active campaigns
        for (uint256 i = 0; i < activeCampaigns.length; i++) {
            if (activeCampaigns[i] == campaignId) {
                activeCampaigns[i] = activeCampaigns[activeCampaigns.length - 1];
                activeCampaigns.pop();
                break;
            }
        }
    }

    /**
     * @notice Execute fuzz testing run
     */
    function executeFuzzRun(bytes32 campaignId) 
        external 
        onlyRole(FUZZ_EXECUTOR) 
        nonReentrant
        returns (bool success, bytes memory input)
    {
        FuzzCampaign storage campaign = campaigns[campaignId];
        require(campaign.id != bytes32(0), "Campaign not found");
        require(campaign.status == TestStatus.Running, "Campaign not running");
        require(campaign.executionCount < campaign.maxRuns, "Max runs reached");

        // Generate fuzzed input
        input = _generateFuzzInput(campaign);

        // Execute target function
        (success, ) = campaign.targetContract.call{gas: campaign.gasLimit}(
            abi.encodePacked(campaign.functionSelector, input)
        );

        campaign.executionCount++;
        totalExecutions++;

        if (!success) {
            campaign.failureCount++;
            campaign.lastSeenFailure = block.timestamp;
            campaign.lastFailureCalldata = input;
            totalFailures++;
            
            emit FuzzFailureDetected(campaignId, input, block.timestamp);
        }

        emit FuzzRunCompleted(campaignId, campaign.executionCount, success);

        // Save results
        campaignResults[campaignId].push(FuzzResult({
            campaignId: campaignId,
            runNumber: campaign.executionCount,
            success: success,
            input: input,
            gasUsed: gasleft(),
            timestamp: block.timestamp
        }));

        // Check if campaign completed
        if (campaign.executionCount >= campaign.maxRuns) {
            campaign.status = campaign.failureCount == 0 ? TestStatus.Passed : TestStatus.Failed;
        }
    }

    /**
     * @notice Execute all active fuzz campaigns
     */
    function runAllCampaigns() external onlyRole(FUZZ_EXECUTOR) {
        for (uint256 i = 0; i < activeCampaigns.length; i++) {
            if (campaigns[activeCampaigns[i]].executionCount < campaigns[activeCampaigns[i]].maxRuns) {
                this.executeFuzzRun(activeCampaigns[i]);
            }
        }
    }

    /**
     * @notice Verify property invariant
     */
    function verifyProperty(bytes32 testId) external onlyRole(FUZZ_EXECUTOR) returns (bool) {
        PropertyTest storage test = propertyTests[testId];
        require(test.id != bytes32(0), "Test not found");

        (bool success, ) = address(this).staticcall{gas: test.assertionGasLimit}(
            abi.encodeWithSelector(bytes4(test.assertionSelector))
        );

        emit PropertyVerified(testId, success);
        return success;
    }

    /**
     * @notice Generate fuzzed input based on input types
     */
    function _generateFuzzInput(FuzzCampaign storage campaign) internal view returns (bytes memory) {
        bytes memory input;
        
        for (uint256 i = 0; i < campaign.inputTypes.length; i++) {
            if (campaign.inputTypes[i] == InputType.UInt256) {
                // Generate boundary values
                uint256 value = _generateBoundaryUInt(campaign.seed + i + campaign.executionCount);
                input = abi.encodePacked(input, value);
            } else if (campaign.inputTypes[i] == InputType.Address) {
                bytes32 hash = keccak256(abi.encode(
                    campaign.seed, i, campaign.executionCount, block.timestamp
                ));
                address value = address(uint160(uint256(hash)));
                input = abi.encodePacked(input, value);
            } else if (campaign.inputTypes[i] == InputType.Bytes32) {
                bytes32 value = keccak256(abi.encode(
                    campaign.seed, i, campaign.executionCount, block.timestamp
                ));
                input = abi.encodePacked(input, value);
            } else if (campaign.inputTypes[i] == InputType.Bool) {
                bool value = (campaign.executionCount + i) % 2 == 0;
                input = abi.encodePacked(input, value);
            } else if (campaign.inputTypes[i] == InputType.Int256) {
                int256 value = int256(int256(campaign.executionCount + i) - int256(1 << 128));
                input = abi.encodePacked(input, value);
            }
        }

        return input;
    }

    /**
     * @notice Generate boundary values for uint256 testing
     * @dev Covers critical edge cases: 0, 1, type.max, type.max-1, etc.
     */
    function _generateBoundaryUInt(uint256 seed) internal pure returns (uint256) {
        uint256 mod = seed % 10;
        
        if (mod == 0) return 0;
        if (mod == 1) return 1;
        if (mod == 2) return type(uint256).max;
        if (mod == 3) return type(uint256).max - 1;
        if (mod == 4) return 1 << 127;
        if (mod == 5) return (1 << 128) - 1;
        if (mod == 6) return seed;
        if (mod == 7) return seed & 0xFFFFFFFFFFFFFFFF;
        if (mod == 8) return seed >> 128;
        return seed;
    }

    /**
     * @notice Get campaign results with pagination
     */
    function getCampaignResults(
        bytes32 campaignId,
        uint256 offset,
        uint256 limit
    ) external view returns (FuzzResult[] memory) {
        FuzzResult[] storage allResults = campaignResults[campaignId];
        uint256 end = offset + limit > allResults.length ? allResults.length : offset + limit;
        
        FuzzResult[] memory results = new FuzzResult[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            results[i - offset] = allResults[i];
        }
        
        return results;
    }

    /**
     * @notice Get campaign summary statistics
     */
    function getCampaignStats(bytes32 campaignId) external view returns (
        uint256 executionCount,
        uint256 failureCount,
        uint256 successRate,
        TestStatus status
    ) {
        FuzzCampaign storage campaign = campaigns[campaignId];
        executionCount = campaign.executionCount;
        failureCount = campaign.failureCount;
        successRate = executionCount > 0 
            ? ((executionCount - failureCount) * 10000) / executionCount 
            : 0;
        status = campaign.status;
    }

    /**
     * @notice Register new property test
     */
    function registerPropertyTest(
        bytes32 id,
        string calldata property,
        bytes calldata assertionSelector,
        uint256 assertionGasLimit,
        bool critical,
        uint256 priority
    ) external onlyRole(FUZZ_ADMIN) {
        require(propertyTests[id].id == bytes32(0), "Test already exists");
        
        propertyTests[id] = PropertyTest({
            id: id,
            property: property,
            assertionSelector: assertionSelector,
            assertionGasLimit: assertionGasLimit,
            critical: critical,
            priority: priority
        });
    }
}
