// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SentinelFixedSupply } from "./SentinelFixedSupply.sol";

/// @notice Draft Airlock-facing factory; not allowlisted or deployed.
/// @dev Must be reviewed for Airlock create flow, deterministic address semantics,
///      factory permissions, token feature compatibility, and Base v4 integration.
contract SentinelFixedSupplyFactory {
    address public immutable AIRLOCK;
    error OnlyAirlock();
    error InvalidAirlock();
    error UnexpectedTokenData();

    constructor(address airlock) {
        if (airlock == address(0)) revert InvalidAirlock();
        AIRLOCK = airlock;
    }

    function create(
        uint256 initialSupply,
        address recipient,
        address, // owner ignored: no privileged token administration
        bytes32 salt,
        bytes calldata tokenData
    ) external returns (address asset) {
        if (msg.sender != AIRLOCK) revert OnlyAirlock();
        if (initialSupply != 1_000_000_000 ether || tokenData.length != 0) {
            revert UnexpectedTokenData();
        }
        asset = address(new SentinelFixedSupply{salt: salt}(recipient));
    }
}
