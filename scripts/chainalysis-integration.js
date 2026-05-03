#!/usr/bin/env node

/**
 * Chainalysis AML/KYC Integration
 * Enhanced compliance and risk assessment for Sentinel transactions
 */

const axios = require('axios');
const crypto = require('crypto');

// Chainalysis API configuration
const CHAINALYSIS_API_URL = process.env.CHAINALYSIS_API_URL || 'https://api.chainalysis.com/v1';
const CHAINALYSIS_API_KEY = process.env.CHAINALYSIS_API_KEY;

/**
 * Check address risk score
 */
async function getAddressRisk(address) {
  try {
    const response = await axios.get(`${CHAINALYSIS_API_URL}/addresses/${address}`, {
      headers: {
        'Authorization': `Bearer ${CHAINALYSIS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      address,
      riskScore: response.data.riskScore,
      riskCategory: response.data.category,
      flags: response.data.flags,
      lastUpdated: response.data.lastUpdated
    };
  } catch (error) {
    console.error('Failed to get address risk:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Check transaction risk
 */
async function getTransactionRisk(txHash, network = 'ethereum') {
  try {
    const response = await axios.get(`${CHAINALYSIS_API_URL}/transactions/${network}/${txHash}`, {
      headers: {
        'Authorization': `Bearer ${CHAINALYSIS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      txHash,
      riskScore: response.data.riskScore,
      exposure: response.data.exposure,
      sentTo: response.data.sentTo,
      receivedFrom: response.data.receivedFrom
    };
  } catch (error) {
    console.error('Failed to get transaction risk:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Screen addresses for sanctions
 */
async function screenAddresses(addresses) {
  try {
    const response = await axios.post(`${CHAINALYSIS_API_URL}/addresses/screen`, {
      addresses
    }, {
      headers: {
        'Authorization': `Bearer ${CHAINALYSIS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.screenedAddresses.map(result => ({
      address: result.address,
      isSanctioned: result.sanctions?.length > 0,
      sanctions: result.sanctions,
      alerts: result.alerts
    }));
  } catch (error) {
    console.error('Failed to screen addresses:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get entity exposure
 */
async function getEntityExposure(entityId) {
  try {
    const response = await axios.get(`${CHAINALYSIS_API_URL}/entities/${entityId}/exposure`, {
      headers: {
        'Authorization': `Bearer ${CHAINALYSIS_API_KEY}`
      }
    });

    return {
      entityId,
      totalExposure: response.data.totalExposure,
      directExposure: response.data.directExposure,
      indirectExposure: response.data.indirectExposure
    };
  } catch (error) {
    console.error('Failed to get entity exposure:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Generate compliance report
 */
async function generateComplianceReport(addresses, transactions) {
  try {
    const [addressRisks, txRisks] = await Promise.all([
      Promise.all(addresses.map(addr => getAddressRisk(addr))),
      Promise.all(transactions.map(tx => getTransactionRisk(tx)))
    ]);

    const highRiskAddresses = addressRisks.filter(addr => addr.riskScore > 0.7);
    const highRiskTransactions = txRisks.filter(tx => tx.riskScore > 0.7);

    return {
      summary: {
        totalAddresses: addresses.length,
        highRiskAddresses: highRiskAddresses.length,
        totalTransactions: transactions.length,
        highRiskTransactions: highRiskTransactions.length
      },
      highRiskAddresses,
      highRiskTransactions,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to generate compliance report:', error);
    throw error;
  }
}

/**
 * Monitor address for changes
 */
async function monitorAddress(address, webhookUrl) {
  try {
    const response = await axios.post(`${CHAINALYSIS_API_URL}/addresses/${address}/monitor`, {
      webhookUrl,
      alertTypes: ['sanctions', 'risk_score_change', 'exposure_change']
    }, {
      headers: {
        'Authorization': `Bearer ${CHAINALYSIS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      address,
      monitorId: response.data.monitorId,
      status: 'active'
    };
  } catch (error) {
    console.error('Failed to monitor address:', error.response?.data || error.message);
    throw error;
  }
}

// Example usage
if (require.main === module) {
  const testAddress = '0xA1B9CF0F48F815cE80ed2aB203fa7c0C8299A0fB';

  getAddressRisk(testAddress)
    .then(risk => console.log('Address risk:', risk))
    .catch(console.error);
}

module.exports = {
  getAddressRisk,
  getTransactionRisk,
  screenAddresses,
  getEntityExposure,
  generateComplianceReport,
  monitorAddress
};