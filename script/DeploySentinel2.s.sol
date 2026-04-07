// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {SentinelInterceptor} from "../contracts/SentinelInterceptor.sol";
import {AetheronBridge} from "../contracts/AetheronBridge.sol";
import {QuantumResistantVault} from "../contracts/quantum/QuantumResistantVault.sol";

contract DeploySentinel2 is Script {
    uint256 internal constant MIN_GUARDIAN_THRESHOLD = 3;

    struct DeploymentResult {
        address sentinel;
        address bridge;
        address vault;
    }

    function run() external returns (DeploymentResult memory result) {
        uint256 deployerPrivateKey = _readPrivateKey();
        address deployer = vm.addr(deployerPrivateKey);

        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        address relayer = vm.envOr("RELAYER_ADDRESS", deployer);
        address oracle = vm.envOr("ORACLE_ADDRESS", deployer);
        (address[] memory guardians, uint256 guardianThreshold) = _readGuardians();
        uint256[] memory supportedChains = _readSupportedChains();

        vm.startBroadcast(deployerPrivateKey);

        // Break the constructor cycle safely by deploying the bridge with a
        // temporary sentinel address first, then wiring the real contracts.
        AetheronBridge bridge = new AetheronBridge(deployer, treasury, deployer);
        SentinelInterceptor sentinel = new SentinelInterceptor(address(bridge), deployer);
        QuantumResistantVault vault = new QuantumResistantVault(guardians, guardianThreshold);

        bridge.setSentinel(address(sentinel));
        bridge.grantRole(bridge.SENTINEL_ROLE(), address(sentinel));
        sentinel.grantRole(sentinel.SENTINEL_ROLE(), address(bridge));

        if (relayer != deployer) {
            bridge.grantRole(bridge.RELAYER_ROLE(), relayer);
        }

        if (oracle != deployer) {
            sentinel.grantRole(sentinel.ORACLE_ROLE(), oracle);
        }

        for (uint256 i = 0; i < supportedChains.length; i++) {
            bridge.setSupportedChain(supportedChains[i], true);
        }

        vm.stopBroadcast();

        result = DeploymentResult({
            sentinel: address(sentinel),
            bridge: address(bridge),
            vault: address(vault)
        });

        console2.log("Deployment complete");
        console2.log("Deployer:", deployer);
        console2.log("SentinelInterceptor:", result.sentinel);
        console2.log("AetheronBridge:", result.bridge);
        console2.log("QuantumResistantVault:", result.vault);
        console2.log("Treasury:", treasury);
        console2.log("Relayer:", relayer);
        console2.log("Oracle:", oracle);
    }

    function _readPrivateKey() internal view returns (uint256) {
        if (vm.envExists("PRIVATE_KEY")) {
            return vm.envUint("PRIVATE_KEY");
        }

        return vm.envUint("DEPLOYER_PRIVATE_KEY");
    }

    function _readGuardians() internal view returns (address[] memory guardians, uint256 threshold) {
        require(vm.envExists("GUARDIAN_1"), "GUARDIAN_1 is required");
        require(vm.envExists("GUARDIAN_2"), "GUARDIAN_2 is required");
        require(vm.envExists("GUARDIAN_3"), "GUARDIAN_3 is required");

        address[] memory configured = new address[](5);
        uint256 guardianCount = 3;

        configured[0] = vm.envAddress("GUARDIAN_1");
        configured[1] = vm.envAddress("GUARDIAN_2");
        configured[2] = vm.envAddress("GUARDIAN_3");

        if (vm.envExists("GUARDIAN_4")) {
            configured[guardianCount++] = vm.envAddress("GUARDIAN_4");
        }

        if (vm.envExists("GUARDIAN_5")) {
            configured[guardianCount++] = vm.envAddress("GUARDIAN_5");
        }

        guardians = new address[](guardianCount);
        for (uint256 i = 0; i < guardianCount; i++) {
            guardians[i] = configured[i];
        }

        for (uint256 i = 0; i < guardians.length; i++) {
            for (uint256 j = i + 1; j < guardians.length; j++) {
                require(guardians[i] != guardians[j], "guardian addresses must be unique");
            }
        }

        threshold = vm.envOr("GUARDIAN_THRESHOLD", uint256(3));
        require(
            threshold >= MIN_GUARDIAN_THRESHOLD && threshold <= guardians.length,
            "invalid guardian threshold"
        );
    }

    function _readSupportedChains() internal view returns (uint256[] memory supportedChains) {
        if (vm.envExists("SUPPORTED_CHAINS")) {
            return vm.envUint("SUPPORTED_CHAINS", ",");
        }

        supportedChains = new uint256[](3);
        supportedChains[0] = 1;
        supportedChains[1] = 10;
        supportedChains[2] = 42161;
    }
}
