// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/PublicResolver.sol";

/**
 * @title SentinelENSManager
 * @notice ENS integration for human-readable Sentinel identities
 * Provides decentralized naming for contracts and users
 */
contract SentinelENSManager {
    ENS public immutable ens;
    PublicResolver public immutable resolver;

    // Sentinel subdomains
    bytes32 constant SENTINEL_NODE = keccak256(abi.encodePacked(bytes32(0), keccak256("sentinel")));

    // Contract mappings
    mapping(bytes32 => address) public contractNodes;
    mapping(address => bytes32) public contractToNode;

    event ENSNameRegistered(bytes32 indexed node, address indexed owner, string name);
    event ContractRegistered(address indexed contractAddr, bytes32 indexed node, string name);

    constructor(address _ens, address _resolver) {
        ens = ENS(_ens);
        resolver = PublicResolver(_resolver);
    }

    /**
     * @notice Register a Sentinel contract with ENS
     */
    function registerContract(
        address contractAddr,
        string calldata name,
        address owner
    ) external {
        bytes32 label = keccak256(abi.encodePacked(name));
        bytes32 node = keccak256(abi.encodePacked(SENTINEL_NODE, label));

        // Set ownership
        ens.setSubnodeOwner(SENTINEL_NODE, label, address(this));
        ens.setOwner(node, owner);

        // Set resolver
        ens.setResolver(node, address(resolver));

        // Set address record
        resolver.setAddr(node, contractAddr);

        // Store mapping
        contractNodes[node] = contractAddr;
        contractToNode[contractAddr] = node;

        emit ContractRegistered(contractAddr, node, name);
        emit ENSNameRegistered(node, owner, string(abi.encodePacked(name, ".sentinel.eth")));
    }

    /**
     * @notice Get contract address by ENS name
     */
    function resolveContract(string calldata name) external view returns (address) {
        bytes32 label = keccak256(abi.encodePacked(name));
        bytes32 node = keccak256(abi.encodePacked(SENTINEL_NODE, label));
        return resolver.addr(node);
    }

    /**
     * @notice Update contract address for existing ENS name
     */
    function updateContractAddress(bytes32 node, address newAddr) external {
        require(ens.owner(node) == msg.sender, "Not authorized");
        resolver.setAddr(node, newAddr);
        contractNodes[node] = newAddr;
    }

    /**
     * @notice Get full ENS name for contract
     */
    function getContractENS(address contractAddr) external view returns (string memory) {
        bytes32 node = contractToNode[contractAddr];
        if (node == bytes32(0)) return "";

        // This would require reverse resolution
        // For simplicity, return placeholder
        return "contract.sentinel.eth";
    }
}