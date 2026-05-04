#!/usr/bin/env node

/**
 * Sentinel Mobile Security App
 * Backend API for mobile application monitoring DeFi security
 */

const express = require('express');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

/**
 * Mobile Security App API Server
 */
class SentinelMobileApp {
  constructor(port = 3002) {
    this.app = express();
    this.port = port;
    this.jwtSecret = process.env.JWT_SECRET || 'sentinel-mobile-secret';
    this.clients = new Map(); // userId -> WebSocket

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    this.app.use(express.json());

    // JWT authentication middleware
    this.app.use('/api/protected', this.authenticateToken.bind(this));
  }

  setupRoutes() {
    // User registration/login
    this.app.post('/api/auth/login', (req, res) => {
      const { walletAddress, signature } = req.body;

      // Verify signature (simplified)
      if (this.verifyWalletSignature(walletAddress, signature)) {
        const token = jwt.sign({ walletAddress }, this.jwtSecret, { expiresIn: '7d' });

        res.json({
          token,
          user: { walletAddress, tier: 'basic' },
        });
      } else {
        res.status(401).json({ error: 'Invalid signature' });
      }
    });

    // Get user security dashboard
    this.app.get('/api/protected/dashboard', (req, res) => {
      const walletAddress = req.user.walletAddress;
      const dashboard = this.getUserDashboard(walletAddress);
      res.json(dashboard);
    });

    // Get security alerts
    this.app.get('/api/protected/alerts', (req, res) => {
      const walletAddress = req.user.walletAddress;
      const alerts = this.getUserAlerts(walletAddress);
      res.json(alerts);
    });

    // Monitor specific contract
    this.app.post('/api/protected/monitor', (req, res) => {
      const { contractAddress, network } = req.body;
      const walletAddress = req.user.walletAddress;

      const monitorId = this.startContractMonitoring(walletAddress, contractAddress, network);
      res.json({ monitorId, status: 'active' });
    });

    // Get portfolio analysis
    this.app.get('/api/protected/portfolio', (req, res) => {
      const walletAddress = req.user.walletAddress;
      const portfolio = this.analyzePortfolio(walletAddress);
      res.json(portfolio);
    });

    // Emergency security actions
    this.app.post('/api/protected/emergency', (req, res) => {
      const { action, contractAddress } = req.body;
      const walletAddress = req.user.walletAddress;

      const result = this.executeEmergencyAction(walletAddress, action, contractAddress);
      res.json(result);
    });
  }

  setupWebSocket() {
    const wss = new WebSocket.Server({ port: this.port + 1 });

    wss.on('connection', (ws, req) => {
      const token = req.url.split('token=')[1];
      if (!token) {
        ws.close(1008, 'Missing authentication token');
        return;
      }

      try {
        const decoded = jwt.verify(token, this.jwtSecret);
        this.clients.set(decoded.walletAddress, ws);

        ws.on('message', message => {
          this.handleWebSocketMessage(decoded.walletAddress, message);
        });

        ws.on('close', () => {
          this.clients.delete(decoded.walletAddress);
        });

        // Send welcome message
        ws.send(
          JSON.stringify({
            type: 'welcome',
            message: 'Connected to Sentinel Mobile Security',
          })
        );
      } catch (error) {
        ws.close(1008, 'Invalid authentication token');
      }
    });

    console.log(`WebSocket server running on port ${this.port + 1}`);
  }

  /**
   * JWT authentication middleware
   */
  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, this.jwtSecret, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }
      req.user = user;
      next();
    });
  }

  /**
   * Verify wallet signature (simplified)
   */
  verifyWalletSignature(walletAddress, signature) {
    // In production, verify the signature cryptographically
    return signature === `sig-${walletAddress}`;
  }

  /**
   * Get user security dashboard
   */
  getUserDashboard(walletAddress) {
    return {
      walletAddress,
      securityScore: 85,
      activeMonitors: 3,
      recentAlerts: 2,
      portfolioValue: '$12,450',
      riskLevel: 'medium',
      recommendations: [
        'Enable 2FA on all exchanges',
        'Diversify across multiple protocols',
        'Monitor liquidation ratios daily',
      ],
    };
  }

  /**
   * Get user security alerts
   */
  getUserAlerts(walletAddress) {
    return [
      {
        id: 'alert-001',
        type: 'high_risk_transaction',
        severity: 'high',
        message: 'Large transfer detected on monitored contract',
        timestamp: new Date().toISOString(),
        contract: '0xA0b86a33E6441e88C5F2712C3E9b74E39Eb9f6e4',
        actionRequired: true,
      },
      {
        id: 'alert-002',
        type: 'anomaly_detected',
        severity: 'medium',
        message: 'Unusual trading pattern detected',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        contract: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        actionRequired: false,
      },
    ];
  }

  /**
   * Start contract monitoring
   */
  startContractMonitoring(walletAddress, contractAddress, network) {
    const monitorId = `monitor-${Date.now()}`;
    console.log(`Started monitoring ${contractAddress} on ${network} for ${walletAddress}`);

    // In production, this would register with monitoring service
    return monitorId;
  }

  /**
   * Analyze user portfolio
   */
  analyzePortfolio(walletAddress) {
    return {
      totalValue: '$12,450',
      assets: [
        { symbol: 'ETH', balance: '5.2', value: '$8,500', risk: 'low' },
        { symbol: 'AETH', balance: '1000', value: '$2,100', risk: 'medium' },
        { symbol: 'USDC', balance: '1850', value: '$1,850', risk: 'low' },
      ],
      positions: [
        {
          protocol: 'Compound',
          type: 'Lending',
          value: '$3,200',
          apy: '4.2%',
          healthFactor: 2.1,
        },
        {
          protocol: 'Uniswap',
          type: 'Liquidity',
          value: '$1,800',
          apy: '12.5%',
          impermanentLoss: '-2.1%',
        },
      ],
      securityScore: 78,
      recommendations: [
        'Consider reducing exposure to high-volatility assets',
        'Increase diversification across protocols',
        'Set up price alerts for liquidation thresholds',
      ],
    };
  }

  /**
   * Execute emergency security action
   */
  executeEmergencyAction(walletAddress, action, contractAddress) {
    console.log(`Emergency action ${action} executed by ${walletAddress} on ${contractAddress}`);

    // Send real-time alert to user's mobile app
    const ws = this.clients.get(walletAddress);
    if (ws) {
      ws.send(
        JSON.stringify({
          type: 'emergency_action',
          action,
          contractAddress,
          timestamp: new Date().toISOString(),
        })
      );
    }

    return {
      actionId: `action-${Date.now()}`,
      status: 'executed',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(walletAddress, message) {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'ping':
          this.clients.get(walletAddress)?.send(
            JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString(),
            })
          );
          break;

        case 'get_alerts':
          const alerts = this.getUserAlerts(walletAddress);
          this.clients.get(walletAddress)?.send(
            JSON.stringify({
              type: 'alerts_update',
              alerts,
            })
          );
          break;

        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  }

  /**
   * Send real-time alert to user
   */
  sendRealtimeAlert(walletAddress, alert) {
    const ws = this.clients.get(walletAddress);
    if (ws) {
      ws.send(
        JSON.stringify({
          type: 'security_alert',
          alert: {
            ...alert,
            timestamp: new Date().toISOString(),
          },
        })
      );
    }
  }

  /**
   * Start the mobile app server
   */
  start() {
    this.app.listen(this.port, () => {
      console.log(`Sentinel Mobile Security API running on port ${this.port}`);
      console.log(`WebSocket server on port ${this.port + 1}`);
      console.log(`API docs available at http://localhost:${this.port}/api`);
    });
  }
}

// Example usage
if (require.main === module) {
  const mobileApp = new SentinelMobileApp();
  mobileApp.start();
}

module.exports = SentinelMobileApp;
