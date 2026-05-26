#!/usr/bin/env node

/**
 * Sentinel Core Engine
 * Orchestrates monitoring, AI inference, and on-chain mitigation
 */

const { ethers } = require('ethers');
const hivemind = require('./hivemind-integration');
const ipfs = require('./ipfs-integration');
const { createClient } = require('../src/lib/supabase/server');
const { CdpWalletProvider } = require("@coinbase/agentkit");
const config = require('./config');
const fs = require('fs');
const express = require('express');

class SentinelEngine {
    constructor(params) {
        this.rpcUrl = config.BASE_RPC_URL;
        this.setupProvider();
        this.interceptorAddress = params.interceptorAddress;
        this.monitorAddress = params.monitorAddress;
        this.threshold = params.severityThreshold || 8;
        this.supabase = null;
        this.chainId = null;
        this.walletProvider = null;
        this.lastHeartbeat = Date.now();
    }

    setupProvider() {
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

        // Handle provider stalls/disconnects
        this.provider.on('error', (e) => {
            console.error('🚨 Provider Error Detected:', e);
            setTimeout(() => this.setupProvider(), 5000);
        });
    }

    startHealthCheck() {
        const app = express();
        const port = process.env.HEALTH_CHECK_PORT || 3005;

        app.get('/health', (req, res) => {
            const now = Date.now();
            // If no event seen or heartbeat recorded in 5 minutes, mark as unhealthy
            const isStalled = (now - this.lastHeartbeat) > 300000;

            res.status(isStalled ? 503 : 200).json({
                status: isStalled ? 'stalled' : 'active',
                chainId: this.chainId,
                lastHeartbeat: new Date(this.lastHeartbeat).toISOString()
            });
        });

        app.listen(port, () => console.log(`RT Health Check active on port ${port}`));
    }

    async initializeWallet() {
        const cdpKeyName = config.CDP_API_KEY_NAME;
        const cdpKeyPrivate = config.CDP_API_KEY_PRIVATE_KEY;
        const keystorePath = process.env.KEYSTORE_PATH; // Optional fallback
        const keystorePassword = process.env.KEYSTORE_PASSWORD; // Optional fallback
        const rawPrivateKey = process.env.OWNER_PRIVATE_KEY;

        if (cdpKeyName && cdpKeyPrivate) {
            console.log('🔐 Initializing Coinbase CDP MPC Wallet (AgentKit)...');
            this.walletProvider = await CdpWalletProvider.configureWithWallet({
                apiKeyName: cdpKeyName,
                apiKeyPrivateKey: cdpKeyPrivate.replace(/\\n/g, '\n'),
                networkId: "base-mainnet",
            });
            // AgentKit providers can act as signers or we can wrap them
            this.wallet = this.walletProvider;
        } else if (keystorePath && keystorePassword && fs.existsSync(keystorePath)) {
            console.log('🔐 Loading wallet from encrypted keystore...');
            const json = fs.readFileSync(keystorePath, 'utf8');
            this.wallet = await ethers.Wallet.fromEncryptedJson(json, keystorePassword);
            this.wallet = this.wallet.connect(this.provider);
        } else if (rawPrivateKey) {
            console.warn('⚠️ Warning: Using raw private key from environment. Consider using a keystore.');
            this.wallet = new ethers.Wallet(rawPrivateKey, this.provider);
        } else {
            throw new Error('No valid wallet configuration found (CDP, KEYSTORE, or OWNER_PRIVATE_KEY).');
        }

        const address = this.walletProvider ? await this.walletProvider.getAddress() : await this.wallet.getAddress();
        console.log(`📡 Agent Wallet initialized: ${address}`);
    }

    async start() {
        console.log('🚀 Sentinel Engine starting...');
        this.supabase = await createClient();
        await this.initializeWallet();
        this.startHealthCheck();

        const network = await this.provider.getNetwork();
        this.chainId = network.chainId.toString();

        // 1. Listen for Anomaly events from the Monitor contract
        const monitorContract = new ethers.Contract(
            this.monitorAddress,
            [
                'event DataTracked(uint256 indexed chainId, bytes data)',
                'event TransactionObserved(uint256 indexed chainId, address indexed sender, address indexed target, uint256 value, bytes data, string context, uint256 timestamp)'
            ],
            this.provider
        );

        monitorContract.on('DataTracked', async (chainId, data, event) => {
            this.lastHeartbeat = Date.now();
            console.log(`[Chain ${chainId}] New transaction data tracked. Analyzing...`);
            await this.processTransaction({ rawBytes: data, context: 'DATA_TRACKED' }, event.log.transactionHash);
        });

        monitorContract.on('TransactionObserved', async (chainId, sender, target, value, data, context, timestamp, event) => {
            this.lastHeartbeat = Date.now();
            console.log(`[Chain ${chainId}] Observed transaction from ${sender} to ${target}. Analyzing...`);
            await this.processTransaction({
                sender,
                target,
                value: ethers.formatEther(value),
                data,
                context
            }, event.log.transactionHash);
        });
    }

    async processTransaction(metadata, txHash) {
        try {
            // 2. Run AI Inference via Hivemind
            const analysis = await hivemind.runInference(metadata);

            console.log(`AI Analysis for ${txHash}: Score ${analysis.riskScore}/10`);

            // Log to Supabase for Dashboard visibility
            await this.supabase.from('security_events').insert([{
                tx_hash: txHash,
                sender: metadata.sender || 'N/A',
                target: metadata.target || 'N/A',
                risk_score: analysis.riskScore,
                analysis_data: { ...analysis, context: metadata.context },
                chain_id: this.chainId,
                timestamp: new Date().toISOString()
            }]);

            // 3. If high risk, trigger on-chain mitigation
            if (analysis.riskScore >= this.threshold) {
                await this.mitigateThreat(txHash, analysis);
            }

            // 4. Log everything to IPFS for the Audit Trail
            await ipfs.uploadSecurityLog({
                txHash,
                analysis,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('Processing failed:', error.message);
        }
    }

    async mitigateThreat(txHash, analysis) {
        console.warn(`🚨 HIGH RISK DETECTED (${analysis.riskScore}). Triggering Interceptor...`);

        const interceptorInterface = new ethers.Interface(['function triggerEmergencyPause(bytes32 reasonId) external']);
        const reasonId = ethers.id(txHash);

        try {
            let txResponse;
            if (this.walletProvider) {
                // Use CDP WalletProvider for signing
                txResponse = await this.walletProvider.sendTransaction({
                    to: this.interceptorAddress,
                    data: interceptorInterface.encodeFunctionData("triggerEmergencyPause", [reasonId]),
                });
            } else {
                // Fallback to ethers.Wallet signer
                const interceptor = new ethers.Contract(
                    this.interceptorAddress,
                    interceptorInterface,
                    this.wallet
                );
                txResponse = await interceptor.triggerEmergencyPause(reasonId);
            }

            // CDP WalletProvider.sendTransaction might return a hash directly or a transaction response.
            console.log(`✅ Emergency pause triggered. Transaction identifier: ${txResponse.hash || txResponse}`);
        } catch (error) {
            console.error('Failed to trigger mitigation:', error.message);
        }
    }
}

if (require.main === module) {
    const engine = new SentinelEngine({
        interceptorAddress: config.INTERCEPTOR_ADDRESS,
        monitorAddress: config.MONITOR_ADDRESS,
        severityThreshold: config.SEVERITY_THRESHOLD
    });
    engine.start();
}

module.exports = SentinelEngine;