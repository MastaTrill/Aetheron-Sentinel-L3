const { ActionProvider, CreateAction } = require("@coinbase/agentkit");
const { z } = require("zod");
const { ethers } = require("ethers");

/**
 * Custom Action Provider for the Sentinel L3 Interceptor.
 * Allows the Agent to trigger emergency pauses or update risk parameters.
 */
class SentinelActionProvider extends ActionProvider {
    constructor(interceptorAddress) {
        super("sentinel", []);
        this.interceptorAddress = interceptorAddress;
    }

    @CreateAction({
        name: "trigger_mitigation",
        description: "Triggers an emergency pause on a target contract via the Sentinel Interceptor.",
        schema: z.object({
            txHash: z.string().describe("The transaction hash of the detected anomaly"),
            reason: z.string().min(10).describe("The detailed reason for the emergency pause (min 10 chars)")
        }),
    })
    async triggerMitigation(walletProvider, args) {
        try {
            // Logic-level validation: Restrict based on argument content
            const restrictedKeywords = ["test", "demo", "ignore"];
            if (restrictedKeywords.some(word => args.reason.toLowerCase().includes(word))) {
                return `Action blocked: Reason contains restricted 'test' keywords. Mitigation requires a valid production threat description.`;
            }

            const reasonId = ethers.id(args.txHash);

            // AgentKit WalletProviders can execute arbitrary contract calls
            const txHash = await walletProvider.sendTransaction({
                to: this.interceptorAddress,
                data: new ethers.Interface([
                    "function triggerEmergencyPause(bytes32 reasonId)"
                ]).encodeFunctionData("triggerEmergencyPause", [reasonId]),
            });

            return `Successfully triggered mitigation for ${args.txHash}. Transaction: ${txHash}`;
        } catch (error) {
            return `Failed to trigger mitigation: ${error.message}`;
        }
    }

    @CreateAction({
        name: "update_risk_threshold",
        description: "Updates the severity threshold for the Sentinel Interceptor. Highly sensitive.",
        schema: z.object({
            newThreshold: z.number().min(1).max(10).describe("The new risk score threshold (1-10)"),
            confirmHighSensitivity: z.boolean().describe("Must be true to set threshold above 9 or below 3")
        }),
    })
    async updateThreshold(walletProvider, args) {
        try {
            // Runtime check: Ensure sensitivity confirmation for extreme values
            if ((args.newThreshold < 3 || args.newThreshold > 9) && !args.confirmHighSensitivity) {
                return "Action blocked: Changing threshold to extreme values (<3 or >9) requires 'confirmHighSensitivity' to be set to true.";
            }

            // Example sensitive operation
            const txHash = await walletProvider.sendTransaction({
                to: this.interceptorAddress,
                data: new ethers.Interface([
                    "function setThreshold(uint256 _threshold)"
                ]).encodeFunctionData("setThreshold", [BigInt(args.newThreshold)]),
            });

            return `Successfully updated risk threshold to ${args.newThreshold}. Transaction: ${txHash}`;
        } catch (error) {
            return `Failed to update threshold: ${error.message}`;
        }
    }

    supportsNetwork(network) {
        return network.protocolFamily === "evm";
    }
}

module.exports = { SentinelActionProvider };