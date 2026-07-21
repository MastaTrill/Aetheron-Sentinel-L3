#!/usr/bin/env node

/**
 * IPFS/Filecoin Integration for Sentinel L3
 * Stores security logs and AI models on decentralized storage
 */

const { create } = require('ipfs-http-client');
const fs = require('fs');
const EthCrypto = require('eth-crypto');

// IPFS configuration
const IPFS_API_URL = process.env.IPFS_API_URL || 'https://ipfs.infura.io:5001/api/v0';
const IPFS_PROJECT_ID = process.env.IPFS_PROJECT_ID;
const IPFS_PROJECT_SECRET = process.env.IPFS_PROJECT_SECRET;

/**
 * Creates an authenticated IPFS client instance.
 * @returns {object} The IPFS client instance.
 */
function getIpfsClient() {
  if (!IPFS_PROJECT_ID || !IPFS_PROJECT_SECRET) {
    throw new Error(
      'IPFS_PROJECT_ID and IPFS_PROJECT_SECRET must be set in environment variables.'
    );
  }
  const auth =
    'Basic ' + Buffer.from(IPFS_PROJECT_ID + ':' + IPFS_PROJECT_SECRET).toString('base64');

  const url = new URL(IPFS_API_URL);

  return create({
    host: url.hostname,
    port: url.port,
    protocol: url.protocol.replace(':', ''), // Remove trailing colon
    headers: {
      authorization: auth,
    },
  });
}

/**
 * Helper function to retry asynchronous operations with exponential backoff.
 * @param {Function} fn - The asynchronous function to execute.
 * @param {number} [retries=3] - The number of retry attempts.
 * @param {number} [delay=1000] - The initial delay between retries in milliseconds.
 * @returns {Promise<any>} The result of the asynchronous function.
 */
async function withRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(
        `Attempt ${i + 1}/${retries} failed: ${error.message}. Retrying in ${delay}ms...`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

/**
 * Upload security log to IPFS
 * @param {object} logData - The security log data to upload.
 * @param {string} [filename='security-log.json'] - The desired filename for the log.
 * @returns {Promise<object>} An object containing the CID, URL, and filename of the uploaded log.
 */
async function uploadSecurityLog(logData, filename = 'security-log.json') {
  try {
    // Prepare log content
    const logContent = JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        data: logData,
        version: '1.0.0',
      },
      null,
      2
    );

    let finalContent = Buffer.from(logContent);
    const publicKey = process.env.OWNER_PUBLIC_KEY;

    // Encrypt using ECIES if a public key is provided in environment
    if (publicKey) {
      console.log('🔒 Encrypting security log with ECIES...');
      const encrypted = await EthCrypto.encryptWithPublicKey(
        publicKey.replace('0x', ''), // EthCrypto expects hex without 0x
        logContent
      );
      finalContent = Buffer.from(JSON.stringify(encrypted));
    }

    const ipfs = getIpfsClient();
    const file = {
      path: filename,
      content: finalContent,
    };

    const result = await withRetry(() => ipfs.add(file));
    console.log('Security log uploaded to IPFS:', result.cid.toString());

    return {
      cid: result.cid.toString(),
      url: `https://ipfs.io/ipfs/${result.cid.toString()}`,
      filename,
    };
  } catch (error) {
    console.error('Failed to upload to IPFS:', error);
    throw error;
  }
}

/**
 * Upload AI model file to IPFS
 * @param {string} modelPath - The file path to the AI model.
 * @returns {Promise<object>} An object containing the CID, URL, and filename of the uploaded model.
 */
async function uploadAIModel(modelPath) {
  try {
    const ipfs = getIpfsClient();

    // Using fs.promises.readFile for asynchronous file reading
    const fileContent = await fs.promises.readFile(modelPath);
    const file = {
      path: modelPath.split('/').pop(),
      content: fileContent,
    };

    const result = await withRetry(() => ipfs.add(file));
    console.log('AI model uploaded to IPFS:', result.cid.toString());

    return {
      cid: result.cid.toString(),
      url: `https://ipfs.io/ipfs/${result.cid.toString()}`,
      filename: file.path,
    };
  } catch (error) {
    console.error('Failed to upload AI model to IPFS:', error);
    throw error;
  }
}

/**
 * Placeholder function to pin content to Filecoin for permanence.
 * Actual implementation would depend on the chosen pinning service (e.g., Pinata, NFT.Storage).
 * @param {string} cid - The CID of the content to pin.
 * @returns {Promise<void>}
 */
async function pinToFilecoin(cid) {
  // Integration with Filecoin pinning services
  // This would use services like Pinata, NFT.Storage, or Web3.Storage
  console.log('Pinning to Filecoin:', cid);
  // Implementation would depend on chosen pinning service
  return Promise.resolve(); // Placeholder for actual pinning logic
}

/**
 * Retrieve content from IPFS
 * @param {string} cid - The CID of the content to retrieve.
 * @param {string} [privateKey] - Optional private key to decrypt ECIES content.
 * @returns {Promise<object|string>} The retrieved content, parsed as JSON if possible.
 */
async function retrieveFromIPFS(cid, privateKey) {
  try {
    const ipfs = getIpfsClient();

    const data = await withRetry(async () => {
      const stream = ipfs.cat(cid);
      let content = '';
      for await (const chunk of stream) {
        content += chunk.toString();
      }
      return content;
    });

    try {
      const parsed = JSON.parse(data);

      // Check if this looks like an ECIES encrypted object (has ciphertext, iv, etc.)
      if (parsed.ciphertext && parsed.iv && privateKey) {
        console.log('🔓 Decrypting ECIES content...');
        const decrypted = await EthCrypto.decryptWithPrivateKey(
          privateKey.replace('0x', ''),
          parsed
        );
        try {
          return JSON.parse(decrypted);
        } catch {
          return decrypted;
        }
      }
      return parsed;
    } catch (jsonError) {
      return data; // Return as plain string if not JSON
    }
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
      { type: 'transfer', amount: '1000', address: '0x...' },
    ],
  };

  // Example usage: upload with a dynamic filename
  const dynamicFilename = `security-log-${Date.now()}.json`;

  uploadSecurityLog(exampleLog, dynamicFilename)
    .then(result => console.log('Upload result:', result))
    .catch(console.error);
}

module.exports = {
  uploadSecurityLog,
  uploadAIModel,
  pinToFilecoin,
  retrieveFromIPFS,
};
