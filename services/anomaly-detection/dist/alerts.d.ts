interface AlertChannel {
    type: "webhook" | "pagerduty" | "slack" | "email" | "discord" | "telegram";
    enabled: boolean;
    config: Record<string, any>;
}
interface EscalationRule {
    severity: "CRITICAL" | "WARNING" | "INFO";
    channels: string[];
    retryAttempts: number;
    retryDelay: number;
    escalationDelay?: number;
    escalationChannels?: string[];
}
export interface AlertConfig {
    channels: Record<string, AlertChannel>;
    escalationRules: EscalationRule[];
    deduplicationWindow: number;
    rateLimit: {
        maxAlertsPerMinute: number;
        maxAlertsPerHour: number;
    };
}
export declare class AlertManager {
    private config;
    private alertStates;
    private recentAlerts;
    private rateLimitCounters;
    constructor(config: AlertConfig);
    sendAlert(severity: "CRITICAL" | "WARNING" | "INFO", title: string, data: Record<string, unknown>, source?: string): Promise<void>;
    private checkRateLimits;
    private generateFingerprint;
    private sendToChannels;
    private sendToChannel;
    private sendWebhookAlert;
    private sendPagerDutyAlert;
    private sendSlackAlert;
    private sendDiscordAlert;
    private sendTelegramAlert;
    private sendEmailAlert;
    private scheduleEscalation;
    resolveAlert(fingerprint: string): void;
    getAlertStats(): {
        activeAlerts: number;
        escalatedAlerts: number;
        totalAlertsSent: number;
    };
    private cleanupOldAlerts;
}
export {};
//# sourceMappingURL=alerts.d.ts.map