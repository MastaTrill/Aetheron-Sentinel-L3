// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBridge
 * @notice Interface for the Aetheron Bridge
 */
interface IBridge {
    /// @notice Lock tokens to bridge to another chain
    /// @param token Address of the token to bridge
    /// @param amount Amount to lock
    /// @param destinationChain Target chain ID
    /// @param recipient Recipient address on destination chain
    function bridge(
        address token,
        uint256 amount,
        uint256 destinationChain,
        address recipient
    ) external payable returns (bytes32 transferId);

    /// @notice Emergency pause all bridge operations
    function emergencyPause() external;

    /// @notice Resume bridge operations after a pause
    function resume() external;

    /// @notice Get current bridge status
    function isPaused() external view returns (bool);
}
