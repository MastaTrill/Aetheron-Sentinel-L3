#!/usr/bin/env node

/**
 * IPFS/Filecoin Integration for Sentinel L3
 * Stores security logs and AI models on decentralized storage
 */

const { create } = require('ipfs-http-client');
const fs = require('fs');

// IPFS configuration
const IPFS_API_URL = process.env.IPFS_API_URL || 'https://ipfs.infura.io:5001/api/v0';
const IPFS_PROJECT_ID = process.env.IPFS_PROJECT_ID;
const IPFS_PROJECT_SECRET = process.env.IPFS_PROJECT_SECRET;

/**
 * Upload security log to IPFS
 */
async function uploadSecurityLog(logData, filename = 'security-log.json') {
  try {
    const auth = 'Basic ' + Buffer.from(IPFS_PROJECT_ID + ':' + IPFS_PROJECT_SECRET).toString('base64');

    const ipfs = create({
      host: 'ipfs.infura.io',
      port: 5001,
      protocol: 'https',
      headers: {
        authorization: auth,
      },
    });

    // Create log file
    const logContent = JSON.stringify({
      timestamp: new Date().toISOString(),
      data: logData,
      version: '1.0.0'
    }, null, 2);

    const file = {
      path: filename,
      content: Buffer.from(logContent)
    };

    const result = await ipfs.add(file);
    console.log('Security log uploaded to IPFS:', result.cid.toString());

    return {
      cid: result.cid.toString(),
      url: `https://ipfs.io/ipfs/${result.cid.toString()}`,
      filename
    };
  } catch (error) {
    console.error('Failed to upload to IPFS:', error);
    throw error;
  }
}

/**
 * Upload AI model to IPFS
 */
async function uploadAIModel(modelPath) {
  try {
    const auth = 'Basic ' + Buffer.from(IPFS_PROJECT_ID + ':' + IPFS_PROJECT_SECRET).toString('base64');

    const ipfs = create({
      host: 'ipfs.infura.io',
      port: 5001,
      protocol: 'https',
      headers: {
        authorization: auth,
      },
    });

    const fileContent = fs.readFileSync(modelPath);
    const file = {
      path: modelPath.split('/').pop(),
      content: fileContent
    };

    const result = await ipfs.add(file);
    console.log('AI model uploaded to IPFS:', result.cid.toString());

    return {
      cid: result.cid.toString(),
      url: `https://ipfs.io/ipfs/${result.cid.toString()}`,
      filename: file.path
    };
  } catch (error) {
    console.error('Failed to upload AI model to IPFS:', error);
    throw error;
  }
}

/**
 * Pin content to Filecoin for permanence
 */
async function pinToFilecoin(cid) {
  // Integration with Filecoin pinning services
  // This would use services like Pinata, NFT.Storage, or Web3.Storage
  console.log('Pinning to Filecoin:', cid);
  // Implementation would depend on chosen pinning service
}

/**
 * Retrieve content from IPFS
 */
async function retrieveFromIPFS(cid) {
  try {
    const auth = 'Basic ' + Buffer.from(IPFS_PROJECT_ID + ':' + IPFS_PROJECT_SECRET).toString('base64');

    const ipfs = create({
      host: 'ipfs.infura.io',
      port: 5001,
      protocol: 'https',
      headers: {
        authorization: auth,
      },
    });

    const stream = ipfs.cat(cid);
    let data = '';

    for await (const chunk of stream) {
      data += chunk.toString();
    }

    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to retrieve from IPFS:', error);
    throw error;
  }
}

// Example usage
if (require.main === module) {
  // Example security log
  const exampleLog = {
    events: [
      { type: 'anomaly', severity: 8, timestamp: Date.now() },
      { type: 'transfer', amount: '1000', address: '0x...' }
    ]
  };

  uploadSecurityLog(exampleLog)
    .then(result => console.log('Upload result:', result))
    .catch(console.error);
}

module.exports = {
  uploadSecurityLog,
  uploadAIModel,
  pinToFilecoin,
  retrieveFromIPFS
};