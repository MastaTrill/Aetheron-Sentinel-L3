import axios from "axios";
export class AlertManager {
    config;
    alertStates = new Map();
    recentAlerts = [];
    rateLimitCounters = {
        minute: { count: 0, resetTime: Date.now() + 60000 },
        hour: { count: 0, resetTime: Date.now() + 3600000 },
    };
    constructor(config) {
        this.config = config;
        // Start cleanup interval
        setInterval(() => this.cleanupOldAlerts(), 60000); // Clean every minute
    }
    async sendAlert(severity, title, data, source = "anomaly-detector") {
        // Check rate limits
        if (!this.checkRateLimits()) {
            console.warn("Alert rate limit exceeded, skipping alert:", title);
            return;
        }
        // Generate alert fingerprint for deduplication
        const fingerprint = this.generateFingerprint(severity, title, data);
        // Check for deduplication
        const existingAlert = this.alertStates.get(fingerprint);
        const now = Date.now();
        if (existingAlert && (now - existingAlert.lastSeen) < (this.config.deduplicationWindow * 1000)) {
            // Update existing alert
            existingAlert.lastSeen = now;
            existingAlert.count++;
            console.log(`[DUPLICATE] ${title} (count: ${existingAlert.count})`);
            return;
        }
        // Create new alert
        const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const payload = {
            id: alertId,
            severity,
            title,
            data,
            timestamp: new Date().toISOString(),
            source,
            fingerprint,
            escalationLevel: 0,
        };
        // Store alert state
        this.alertStates.set(fingerprint, {
            id: alertId,
            firstSeen: now,
            lastSeen: now,
            count: 1,
            escalated: false,
            resolved: false,
        });
        this.recentAlerts.push(payload);
        // Keep recent alerts buffer
        if (this.recentAlerts.length > 1000) {
            this.recentAlerts.shift();
        }
        console.log(`[${severity}] ${title}`, data);
        // Send to configured channels based on escalation rules
        await this.sendToChannels(payload);
        // Schedule escalation if configured
        this.scheduleEscalation(payload);
    }
    checkRateLimits() {
        const now = Date.now();
        // Reset counters if needed
        if (now > this.rateLimitCounters.minute.resetTime) {
            this.rateLimitCounters.minute = { count: 0, resetTime: now + 60000 };
        }
        if (now > this.rateLimitCounters.hour.resetTime) {
            this.rateLimitCounters.hour = { count: 0, resetTime: now + 3600000 };
        }
        // Check limits
        if (this.rateLimitCounters.minute.count >= this.config.rateLimit.maxAlertsPerMinute) {
            return false;
        }
        if (this.rateLimitCounters.hour.count >= this.config.rateLimit.maxAlertsPerHour) {
            return false;
        }
        // Increment counters
        this.rateLimitCounters.minute.count++;
        this.rateLimitCounters.hour.count++;
        return true;
    }
    generateFingerprint(severity, title, data) {
        // Create a simplified fingerprint for deduplication
        const keyData = `${severity}:${title}:${JSON.stringify(data).slice(0, 200)}`;
        let hash = 0;
        for (let i = 0; i < keyData.length; i++) {
            const char = keyData.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
    async sendToChannels(alert) {
        const rule = this.config.escalationRules.find(r => r.severity === alert.severity);
        if (!rule)
            return;
        const channels = alert.escalationLevel === 0 ? rule.channels : rule.escalationChannels || rule.channels;
        for (const channelName of channels) {
            const channel = this.config.channels[channelName];
            if (!channel?.enabled)
                continue;
            try {
                await this.sendToChannel(channel, alert, rule.retryAttempts, rule.retryDelay);
            }
            catch (error) {
                console.error(`Failed to send alert to ${channelName}:`, error);
            }
        }
    }
    async sendToChannel(channel, alert, retryAttempts, retryDelay) {
        let lastError = null;
        for (let attempt = 0; attempt <= retryAttempts; attempt++) {
            try {
                switch (channel.type) {
                    case "webhook":
                        await this.sendWebhookAlert(channel.config.url, alert);
                        break;
                    case "pagerduty":
                        await this.sendPagerDutyAlert(channel.config.routingKey, alert);
                        break;
                    case "slack":
                        await this.sendSlackAlert(channel.config.webhookUrl, alert);
                        break;
                    case "discord":
                        await this.sendDiscordAlert(channel.config.webhookUrl, alert);
                        break;
                    case "telegram":
                        await this.sendTelegramAlert(channel.config.botToken, channel.config.chatId, alert);
                        break;
                    case "email":
                        await this.sendEmailAlert(channel.config, alert);
                        break;
                }
                return; // Success
            }
            catch (error) {
                lastError = error;
                if (attempt < retryAttempts) {
                    console.warn(`Alert delivery attempt ${attempt + 1} failed, retrying in ${retryDelay}s...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));
                }
            }
        }
        throw lastError || new Error("All delivery attempts failed");
    }
    async sendWebhookAlert(url, alert) {
        await axios.post(url, alert, {
            timeout: 10000,
            headers: { "Content-Type": "application/json" },
        });
    }
    async sendPagerDutyAlert(routingKey, alert) {
        const severity = alert.severity === "CRITICAL" ? "critical" :
            alert.severity === "WARNING" ? "warning" : "info";
        await axios.post("https://events.pagerduty.com/v2/enqueue", {
            routing_key: routingKey,
            event_action: "trigger",
            payload: {
                summary: alert.title,
                severity,
                source: alert.source,
                custom_details: alert.data,
            },
        }, {
            timeout: 10000,
            headers: { "Content-Type": "application/json" },
        });
    }
    async sendSlackAlert(webhookUrl, alert) {
        const color = alert.severity === "CRITICAL" ? "danger" :
            alert.severity === "WARNING" ? "warning" : "good";
        const payload = {
            attachments: [{
                    color,
                    title: alert.title,
                    text: JSON.stringify(alert.data, null, 2),
                    fields: [
                        { title: "Severity", value: alert.severity, short: true },
                        { title: "Source", value: alert.source, short: true },
                        { title: "Time", value: alert.timestamp, short: true }
                    ]
                }]
        };
        await axios.post(webhookUrl, payload, {
            timeout: 10000,
            headers: { "Content-Type": "application/json" },
        });
    }
    async sendDiscordAlert(webhookUrl, alert) {
        const color = alert.severity === "CRITICAL" ? 15158332 : // red
            alert.severity === "WARNING" ? 16776960 : // yellow
                3066993; // green
        const payload = {
            embeds: [{
                    color,
                    title: alert.title,
                    description: `\`\`\`json\n${JSON.stringify(alert.data, null, 2)}\`\`\``,
                    fields: [
                        { name: "Severity", value: alert.severity, inline: true },
                        { name: "Source", value: alert.source, inline: true },
                        { name: "Time", value: alert.timestamp, inline: true }
                    ]
                }]
        };
        await axios.post(webhookUrl, payload, {
            timeout: 10000,
            headers: { "Content-Type": "application/json" },
        });
    }
    async sendTelegramAlert(botToken, chatId, alert) {
        const emoji = alert.severity === "CRITICAL" ? "🚨" :
            alert.severity === "WARNING" ? "⚠️" : "ℹ️";
        const message = `${emoji} *${alert.title}*\n\n` +
            `Severity: ${alert.severity}\n` +
            `Source: ${alert.source}\n` +
            `Time: ${alert.timestamp}\n\n` +
            `Data:\n\`\`\`\n${JSON.stringify(alert.data, null, 2)}\n\`\`\``;
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: "Markdown",
        }, {
            timeout: 10000,
            headers: { "Content-Type": "application/json" },
        });
    }
    async sendEmailAlert(config, alert) {
        // This would integrate with an email service like SendGrid, Mailgun, etc.
        // For now, just log it
        console.log(`📧 EMAIL ALERT: ${alert.title} to ${config.recipient || "configured recipient"}`);
    }
    scheduleEscalation(alert) {
        const rule = this.config.escalationRules.find(r => r.severity === alert.severity);
        if (!rule?.escalationDelay || !rule.escalationChannels)
            return;
        setTimeout(async () => {
            const alertState = this.alertStates.get(alert.fingerprint);
            if (!alertState || alertState.resolved)
                return;
            // Escalate the alert
            alert.escalationLevel++;
            alertState.escalated = true;
            console.log(`🚀 Escalating alert: ${alert.title} (level ${alert.escalationLevel})`);
            // Send to escalation channels
            await this.sendToChannels(alert);
        }, rule.escalationDelay * 1000);
    }
    resolveAlert(fingerprint) {
        const alertState = this.alertStates.get(fingerprint);
        if (alertState) {
            alertState.resolved = true;
            console.log(`✅ Alert resolved: ${fingerprint}`);
        }
    }
    getAlertStats() {
        let activeAlerts = 0;
        let escalatedAlerts = 0;
        for (const state of this.alertStates.values()) {
            if (!state.resolved) {
                activeAlerts++;
                if (state.escalated)
                    escalatedAlerts++;
            }
        }
        return {
            activeAlerts,
            escalatedAlerts,
            totalAlertsSent: this.recentAlerts.length,
        };
    }
    cleanupOldAlerts() {
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
        const expiredFingerprints = [];
        for (const [fingerprint, state] of this.alertStates) {
            if (state.lastSeen < cutoffTime) {
                expiredFingerprints.push(fingerprint);
            }
        }
        for (const fingerprint of expiredFingerprints) {
            this.alertStates.delete(fingerprint);
        }
        // Cleanup recent alerts (keep last 100)
        if (this.recentAlerts.length > 100) {
            this.recentAlerts.splice(0, this.recentAlerts.length - 100);
        }
    }
}
//# sourceMappingURL=alerts.js.map