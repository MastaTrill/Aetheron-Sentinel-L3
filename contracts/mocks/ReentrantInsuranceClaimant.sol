// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISentinelInsuranceProtocol {
    function purchaseInsurance(
        address coveredContract,
        uint256 coverageAmount,
        uint8 insuranceType,
        uint256 coveragePeriod
    ) external payable returns (uint256);

    function submitClaim(
        uint256 policyId,
        bytes32 incidentHash,
        bytes calldata evidence
    ) external returns (uint256);

    function processClaim(uint256 claimId, bool approve) external;
}

contract ReentrantInsuranceClaimant {
    ISentinelInsuranceProtocol public protocol;
    uint256 public activeClaimId;
    bool public reentrySucceeded;
    bool private attempted;

    function setProtocol(address protocolAddress) external {
        require(address(protocol) == address(0), "Protocol already set");
        protocol = ISentinelInsuranceProtocol(protocolAddress);
    }

    function purchase(
        address coveredContract,
        uint256 coverageAmount,
        uint256 coveragePeriod
    ) external payable returns (uint256) {
        return protocol.purchaseInsurance{value: msg.value}(
            coveredContract,
            coverageAmount,
            0,
            coveragePeriod
        );
    }

    function submit(
        uint256 policyId,
        bytes32 incidentHash
    ) external returns (uint256) {
        return protocol.submitClaim(policyId, incidentHash, hex"01");
    }

    function process(uint256 claimId) external {
        activeClaimId = claimId;
        protocol.processClaim(claimId, true);
    }

    receive() external payable {
        if (!attempted) {
            attempted = true;
            try protocol.processClaim(activeClaimId, true) {
                reentrySucceeded = true;
            } catch {}
        }
    }
}
