import { ActionProvider } from '@coinbase/agentkit';
import { z } from 'zod';
import { ethers } from 'ethers';

class SentinelActionProvider extends ActionProvider {
  constructor(interceptorAddress) {
    super('sentinel');
    this.interceptorAddress = interceptorAddress;
  }

  async triggerMitigation(walletProvider, args) {
    try {
      const restrictedKeywords = ['test', 'demo', 'ignore'];
      if (restrictedKeywords.some(word => args.reason.toLowerCase().includes(word))) {
        return `Action blocked: Reason contains restricted 'test' keywords. Mitigation requires a valid production threat description.`;
      }

      const reasonId = ethers.id(args.txHash);

      const txHash = await walletProvider.sendTransaction({
        to: this.interceptorAddress,
        data: new ethers.Interface([
          'function triggerEmergencyPause(bytes32 reasonId)',
        ]).encodeFunctionData('triggerEmergencyPause', [reasonId]),
      });

      return `Successfully triggered mitigation for ${args.txHash}. Transaction: ${txHash}`;
    } catch (error) {
      return `Failed to trigger mitigation: ${error.message}`;
    }
  }

  async updateThreshold(walletProvider, args) {
    try {
      if ((args.newThreshold < 3 || args.newThreshold > 9) && !args.confirmHighSensitivity) {
        return "Action blocked: Changing threshold to extreme values (<3 or >9) requires 'confirmHighSensitivity' to be set to true.";
      }

      const txHash = await walletProvider.sendTransaction({
        to: this.interceptorAddress,
        data: new ethers.Interface([
          'function setThreshold(uint256 _threshold)',
        ]).encodeFunctionData('setThreshold', [BigInt(args.newThreshold)]),
      });

      return `Successfully updated risk threshold to ${args.newThreshold}. Transaction: ${txHash}`;
    } catch (error) {
      return `Failed to update threshold: ${error.message}`;
    }
  }

  supportsNetwork(network) {
    return network.protocolFamily === 'evm';
  }
}

export { SentinelActionProvider };
