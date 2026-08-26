// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../../contracts/sentinel/SentinelAgentPolicy.sol";

/**
 * @title DeploySentinelAgentPolicy
 * @notice Foundry deploy script for SentinelAgentPolicy.
 *
 * Usage (Base Sepolia):
 *   forge script script/deploy/005_SentinelAgentPolicy.s.sol \
 *     --rpc-url $BASE_TESTNET_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY   — ephemeral deployer (will not retain admin rights)
 *   SENTINEL_OWNER         — Safe or timelock that will receive ownership
 *   POLICY_MIN_DELAY_HOURS — timelock delay in hours (default: 48)
 *
 * Safety:
 *   - Ownership is immediately transferred to SENTINEL_OWNER.
 *   - The deployer key retains no roles after the script.
 */
contract DeploySentinelAgentPolicy is Script {
    function run() external {
        address owner = vm.envAddress("SENTINEL_OWNER");
        require(owner != address(0), "SENTINEL_OWNER must be set");

        uint256 minDelayHours = vm.envOr("POLICY_MIN_DELAY_HOURS", uint256(48));
        uint256 minDelay = minDelayHours * 1 hours;
        require(
            minDelay >= 1 hours,
            "POLICY_MIN_DELAY_HOURS must produce a delay >= 1 hour"
        );

        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        require(deployer != owner, "Deployer must differ from SENTINEL_OWNER");

        vm.startBroadcast();

        // Deploy with the deployer as the initial owner.
        SentinelAgentPolicy policyContract = new SentinelAgentPolicy(deployer, minDelay);

        // Immediately transfer ownership to the governance address.
        policyContract.transferOwnership(owner);

        // Verify.
        require(policyContract.owner() == owner, "Ownership transfer failed");
        require(!policyContract.hasRole(bytes32(0), deployer), "Deployer retained admin role");

        vm.stopBroadcast();

        console.log("SentinelAgentPolicy deployed at:", address(policyContract));
        console.log("  Owner (Safe/timelock):         ", owner);
        console.log("  Min delay (seconds):           ", minDelay);
    }
}
