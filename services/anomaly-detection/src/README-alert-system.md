# Enhanced Alert System

Multi-channel alert system with escalation, deduplication, and rate limiting for anomaly detection services.

## Features

- **Multiple Channels**: Webhook, PagerDuty, Slack, Discord, Telegram, Email
- **Intelligent Escalation**: Automatic escalation based on severity and time thresholds
- **Deduplication**: Prevents alert spam for repeated issues
- **Rate Limiting**: Configurable rate limits to prevent alert floods
- **Retry Logic**: Automatic retries with exponential backoff
- **Alert Management**: Track alert states, resolution, and statistics

## Configuration

The alert system is configured via `config/alerts.json`:

```json
{
  "channels": {
    "webhook": {
      "type": "webhook",
      "enabled": true,
      "config": {
        "url": "https://your-webhook-endpoint.com"
      }
    },
    "slack": {
      "type": "slack",
      "enabled": true,
      "config": {
        "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK"
      }
    }
  },
  "escalationRules": [
    {
      "severity": "CRITICAL",
      "channels": ["webhook", "pagerduty"],
      "retryAttempts": 3,
      "retryDelay": 5,
      "escalationDelay": 300,
      "escalationChannels": ["slack", "telegram"]
    }
  ],
  "deduplicationWindow": 300,
  "rateLimit": {
    "maxAlertsPerMinute": 10,
    "maxAlertsPerHour": 100
  }
}
```

## Alert Flow

1. **Alert Creation**: Alert is generated with severity, title, and data
2. **Deduplication Check**: System checks if similar alert was sent recently
3. **Rate Limiting**: Verifies rate limits aren't exceeded
4. **Channel Routing**: Sends to appropriate channels based on escalation rules
5. **Retry Logic**: Retries failed deliveries with backoff
6. **Escalation**: Escalates to additional channels after delay if unresolved

## Supported Channels

### Webhook

Generic HTTP webhook support for custom integrations.

### PagerDuty

Native PagerDuty integration for incident management.

### Slack

Rich Slack messages with colors and formatting.

### Discord

Discord webhook integration with embeds.

### Telegram

Telegram bot integration for instant messaging.

### Email

SMTP-based email alerts (requires additional configuration).

## Escalation Rules

Define how alerts escalate based on severity:

```json
{
  "severity": "CRITICAL",
  "channels": ["webhook"], // Initial channels
  "retryAttempts": 3, // Retry failed deliveries
  "retryDelay": 5, // Seconds between retries
  "escalationDelay": 300, // Seconds before escalation
  "escalationChannels": ["slack"] // Additional channels for escalation
}
```

## Deduplication

Alerts with the same fingerprint within the deduplication window are merged:

- **Fingerprint**: Generated from severity, title, and key data fields
- **Window**: Configurable time window (default: 5 minutes)
- **Behavior**: Updates count and last seen time, prevents spam

## Rate Limiting

Prevents alert floods with configurable limits:

- **Per Minute**: Maximum alerts per minute
- **Per Hour**: Maximum alerts per hour
- **Behavior**: Silently drops alerts exceeding limits

## Usage

```typescript
import { AlertManager } from "./alerts";

// Load configuration
const config = JSON.parse(fs.readFileSync("config/alerts.json", "utf8"));
const alertManager = new AlertManager(config);

// Send alerts
await alertManager.sendAlert("CRITICAL", "Bridge Attack Detected", {
  attackType: "flash_loan_exploit",
  amount: "1000000",
  attacker: "0x123...",
});

// Get statistics
const stats = alertManager.getAlertStats();
console.log(
  `${stats.activeAlerts} active alerts, ${stats.escalatedAlerts} escalated`,
);
```

## Alert States

Each alert maintains state for lifecycle management:

- **Active**: Currently alerting
- **Escalated**: Has been escalated to additional channels
- **Resolved**: Manually marked as resolved
- **Count**: Number of occurrences (for deduplication)

## Environment Variables

- `ALERT_WEBHOOK`: Legacy webhook URL (for backward compatibility)
- `PAGERDUTY_KEY`: Legacy PagerDuty key (for backward compatibility)

## Best Practices

1. **Configure Multiple Channels**: Use different channels for different severity levels
2. **Set Appropriate Escalation**: Critical alerts should escalate quickly
3. **Monitor Alert Volumes**: Adjust rate limits based on normal traffic
4. **Test Alert Channels**: Regularly test all configured alert channels
5. **Document Escalation Procedures**: Ensure team knows how to respond to escalated alerts

## Integration Examples

### With Health Monitoring

```typescript
healthMonitor.on("alert", async (alert) => {
  await alertManager.sendAlert(
    "WARNING",
    "Service Health Issue",
    {
      service: alert.type,
      details: alert.data,
    },
    "health-monitor",
  );
});
```

### With Anomaly Detection

```typescript
anomalyDetector.on("tvlSpike", async (data) => {
  await alertManager.sendAlert("CRITICAL", "TVL Spike Detected", data);
});
```

## Monitoring and Maintenance

- **Alert Statistics**: Monitor alert volumes and patterns
- **Channel Health**: Track delivery success rates
- **Escalation Effectiveness**: Review how often alerts require escalation
- **False Positives**: Adjust detection thresholds to reduce noise
