const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config(); // Load environment variables
const { CdpWalletProvider } = require("@coinbase/agentkit");

/**
 * Initializes an ethers.js Wallet from either a keystore file or a raw private key.
 * Prioritizes keystore for enhanced security.
 * @param {ethers.JsonRpcProvider} provider The RPC provider.
 * @returns {Promise<ethers.Wallet>} The initialized wallet.
 */
async function initializeWallet(provider) {
    const cdpKeyName = process.env.CDP_API_KEY_NAME;
    const cdpKeyPrivate = process.env.CDP_API_KEY_PRIVATE_KEY;
    const keystorePath = process.env.KEYSTORE_PATH;
    const keystorePassword = process.env.KEYSTORE_PASSWORD;
    const rawPrivateKey = process.env.OWNER_PRIVATE_KEY;

    if (cdpKeyName && cdpKeyPrivate) {
        console.log('🔐 Using CDP MPC Wallet for propagation...');
        const cdpWallet = await CdpWalletProvider.configureWithWallet({
            apiKeyName: cdpKeyName,
            apiKeyPrivateKey: cdpKeyPrivate?.replace(/\\n/g, '\n'),
            networkId: "base-mainnet", // Assuming base-mainnet for propagation
        });
        return cdpWallet;
    } else if (keystorePath && keystorePassword && fs.existsSync(keystorePath)) {
        console.log('🔐 Loading wallet from encrypted keystore...');
        const json = fs.readFileSync(keystorePath, 'utf8');
        const wallet = await ethers.Wallet.fromEncryptedJson(json, keystorePassword);
        return wallet.connect(provider);
    } else if (rawPrivateKey && rawPrivateKey.startsWith('0x')) {
        console.warn('⚠️ Warning: Using raw private key from environment. Consider using a keystore.');
        return new ethers.Wallet(rawPrivateKey, provider);
    } else {
        throw new Error('No valid wallet configuration found (KEYSTORE_PATH or OWNER_PRIVATE_KEY).');
    }
}

/**
 * Uses AetheronBridge to send a security alert across LayerZero
 */
async function propagateAlert(targetChainId, severity) {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    const wallet = await initializeWallet(provider);

    const bridgeAddress = process.env.BRIDGE_ADDRESS;
    const bridgeInterface = new ethers.Interface(['function sendSecurityAlert(uint16 _dstChainId, uint8 _severity) external payable']);

    console.log(`📡 Propagating Security Alert (Severity ${severity}) to Chain ${targetChainId}...`);

    // Requirement: In production, call AetheronBridge.estimateAlertFee() if available
    const alertFee = process.env.PROPAGATION_FEE_WEI || ethers.parseEther('0.02');

    try {
        let tx;
        const data = bridgeInterface.encodeFunctionData("sendSecurityAlert", [targetChainId, severity]);

        // Fetch dynamic gas data to ensure priority during network congestion
        const feeData = await provider.getFeeData();

        if (wallet.sendTransaction) { // Check if it's a CdpWalletProvider or similar signer
            tx = await wallet.sendTransaction({
                to: bridgeAddress,
                data: data,
                value: alertFee,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n // Priority for security alerts
            });
        } else { // Fallback to ethers.Wallet as a signer for a Contract instance
            const bridgeContract = new ethers.Contract(bridgeAddress, bridgeInterface, wallet);
            tx = await bridgeContract.sendSecurityAlert(targetChainId, severity, { value: ethers.parseEther('0.01') });
        }
        await tx.wait();
        console.log(`✅ Alert sent: ${tx.hash}`);
    } catch (error) {
        console.error('Propagation failed:', error.message);
    }
}

module.exports = { propagateAlert };