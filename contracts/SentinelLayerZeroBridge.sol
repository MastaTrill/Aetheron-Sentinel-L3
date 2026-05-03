// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@layerzerolabs/solidity-examples/contracts/lzApp/LzApp.sol";

/**
 * @title SentinelLayerZeroBridge
 * @notice Cross-chain security coordination using LayerZero
 * Enables Sentinel L3 to communicate security events across chains
 */
contract SentinelLayerZeroBridge is LzApp {
    // LayerZero endpoint
    ILayerZeroEndpoint public immutable lzEndpoint;

    // Chain ID mappings for LayerZero
    mapping(uint16 => bytes) public chainIdToAddress;

    // Security event structure
    struct SecurityEvent {
        uint256 eventId;
        uint16 srcChainId;
        address reporter;
        uint256 severity;
        bytes data;
        uint256 timestamp;
    }

    SecurityEvent[] public securityEvents;
    uint256 public nextEventId;

    event SecurityEventReceived(uint256 eventId, uint16 srcChainId, address reporter, uint256 severity);
    event SecurityEventSent(uint256 eventId, uint16 dstChainId, address dstAddress);

    constructor(address _lzEndpoint) LzApp(_lzEndpoint) {
        lzEndpoint = ILayerZeroEndpoint(_lzEndpoint);
    }

    /**
     * @notice Send security event to another chain
     */
    function sendSecurityEvent(
        uint16 _dstChainId,
        uint256 _severity,
        bytes calldata _data,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable {
        bytes memory dstAddress = chainIdToAddress[_dstChainId];
        require(dstAddress.length > 0, "Destination not configured");

        uint256 eventId = nextEventId++;
        securityEvents.push(SecurityEvent({
            eventId: eventId,
            srcChainId: lzEndpoint.getChainId(),
            reporter: msg.sender,
            severity: _severity,
            data: _data,
            timestamp: block.timestamp
        }));

        bytes memory payload = abi.encode(eventId, _severity, _data, msg.sender);

        _lzSend(
            _dstChainId,
            payload,
            _refundAddress,
            _zroPaymentAddress,
            _adapterParams,
            msg.value
        );

        emit SecurityEventSent(eventId, _dstChainId, address(uint160(bytes20(dstAddress))));
    }

    /**
     * @notice Receive security event from another chain
     */
    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal override {
        (uint256 eventId, uint256 severity, bytes memory data, address reporter) =
            abi.decode(_payload, (uint256, uint256, bytes, address));

        securityEvents.push(SecurityEvent({
            eventId: eventId,
            srcChainId: _srcChainId,
            reporter: reporter,
            severity: severity,
            data: data,
            timestamp: block.timestamp
        }));

        emit SecurityEventReceived(eventId, _srcChainId, reporter, severity);

        // Trigger local Sentinel response based on severity
        _handleSecurityEvent(severity, data);
    }

    /**
     * @notice Configure destination chain addresses
     */
    function setChainAddress(uint16 _chainId, bytes calldata _address) external onlyOwner {
        chainIdToAddress[_chainId] = _address;
    }

    /**
     * @notice Handle incoming security events
     */
    function _handleSecurityEvent(uint256 _severity, bytes memory _data) internal {
        // Implement Sentinel response logic
        // - Update local security metrics
        // - Trigger automated responses
        // - Alert monitoring systems
    }

    /**
     * @notice Estimate fees for cross-chain message
     */
    function estimateFees(
        uint16 _dstChainId,
        bytes calldata _payload,
        bytes calldata _adapterParams
    ) external view returns (uint256) {
        return lzEndpoint.estimateFees(_dstChainId, address(this), _payload, false, _adapterParams);
    }
}