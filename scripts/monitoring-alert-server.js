#!/usr/bin/env node

/**
 * Sentinel L3 — Production Monitoring & Alerting Server
 * Integrates Prometheus metrics, Discord/Slack webhooks, and Telegram bots.
 */

const http = require('http');
const express = require('express');

class SentinelAlertServer {
  constructor(port = 8080) {
    this.app = express();
    this.port = process.env.PORT || port;
    this.discordWebhook = process.env.DISCORD_WEBHOOK_URL;
    this.slackWebhook = process.env.SLACK_WEBHOOK_URL;
    this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID;

    this.metrics = {
      threatsDetectedTotal: 0,
      anomaliesBlockedTotal: 0,
      circuitBreakerEventsTotal: 0,
      activeMonitorsCount: 4,
      lastAlertTimestamp: null,
    };

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'Sentinel Alert Server v1.0.0',
      });
    });

    // Prometheus metrics endpoint
    this.app.get('/metrics', (req, res) => {
      const output = [
        '# HELP sentinel_threats_detected_total Total count of intercepted threats',
        '# TYPE sentinel_threats_detected_total counter',
        `sentinel_threats_detected_total ${this.metrics.threatsDetectedTotal}`,

        '# HELP sentinel_anomalies_blocked_total Total count of anomalies blocked',
        '# TYPE sentinel_anomalies_blocked_total counter',
        `sentinel_anomalies_blocked_total ${this.metrics.anomaliesBlockedTotal}`,

        '# HELP sentinel_circuit_breaker_events_total Total circuit breaker triggers',
        '# TYPE sentinel_circuit_breaker_events_total counter',
        `sentinel_circuit_breaker_events_total ${this.metrics.circuitBreakerEventsTotal}`,

        '# HELP sentinel_active_monitors_count Total active contract monitors',
        '# TYPE sentinel_active_monitors_count gauge',
        `sentinel_active_monitors_count ${this.metrics.activeMonitorsCount}`,
      ].join('\n');

      res.setHeader('Content-Type', 'text/plain');
      res.send(output);
    });

    // Trigger Security Alert via Webhook / REST
    this.app.post('/api/alerts/trigger', async (req, res) => {
      const { title, description, severity, chain, contractAddress } = req.body;

      if (!title || !description) {
        return res.status(400).json({ error: 'Missing required alert fields: title, description' });
      }

      this.metrics.threatsDetectedTotal++;
      this.metrics.lastAlertTimestamp = new Date().toISOString();

      const alertPayload = {
        title: title || '⚠️ SECURITY THREAT DETECTED',
        description,
        severity: severity || 'HIGH',
        chain: chain || 'Base Mainnet',
        contractAddress: contractAddress || '0x...',
        timestamp: new Date().toISOString(),
      };

      console.log(`[ALERT BROADCAST] ${alertPayload.severity}: ${alertPayload.title}`);

      // Emit to external webhooks asynchronously
      this.sendDiscordAlert(alertPayload);
      this.sendSlackAlert(alertPayload);

      res.json({
        status: 'DISPATCHED',
        payload: alertPayload,
      });
    });
  }

  async sendDiscordAlert(payload) {
    if (!this.discordWebhook) return;
    try {
      const content = {
        embeds: [
          {
            title: `🛡️ Sentinel L3 Alert: ${payload.title}`,
            description: payload.description,
            color: payload.severity === 'CRITICAL' ? 16711765 : 65535,
            fields: [
              { name: 'Chain', value: payload.chain, inline: true },
              { name: 'Contract', value: payload.contractAddress, inline: true },
              { name: 'Severity', value: payload.severity, inline: true },
            ],
            timestamp: payload.timestamp,
          },
        ],
      };
      await fetch(this.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
    } catch (err) {
      console.error('[Discord Alert Error]', err.message);
    }
  }

  async sendSlackAlert(payload) {
    if (!this.slackWebhook) return;
    try {
      const content = {
        text: `*Sentinel L3 ${payload.severity} Alert*: ${payload.title}\n${payload.description}\nChain: ${payload.chain} | Contract: ${payload.contractAddress}`,
      };
      await fetch(this.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
    } catch (err) {
      console.error('[Slack Alert Error]', err.message);
    }
  }

  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`📡 Sentinel Alert Server running on port ${this.port}`);
      console.log(`   • Health check: http://localhost:${this.port}/health`);
      console.log(`   • Prometheus metrics: http://localhost:${this.port}/metrics`);
    });
  }
}

if (require.main === module) {
  const server = new SentinelAlertServer();
  server.start();
}

module.exports = SentinelAlertServer;
