import axios from "axios";

interface AlertConfig {
  alertWebhook: string;
  pagerdutyKey: string;
}

interface AlertPayload {
  severity: string;
  title: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export class AlertManager {
  private config: AlertConfig;

  constructor(config: AlertConfig) {
    this.config = config;
  }

  async sendAlert(
    severity: "CRITICAL" | "WARNING" | "INFO",
    title: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const payload: AlertPayload = {
      severity,
      title,
      data,
      timestamp: new Date().toISOString(),
    };

    console.log(`[${severity}] ${title}`, data);

    // Send webhook alert
    if (this.config.alertWebhook) {
      try {
        await axios.post(this.config.alertWebhook, payload, {
          timeout: 5000,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Failed to send webhook alert:", error);
      }
    }

    // Send PagerDuty alert for critical issues
    if (severity === "CRITICAL" && this.config.pagerdutyKey) {
      try {
        await axios.post(
          "https://events.pagerduty.com/v2/enqueue",
          {
            routing_key: this.config.pagerdutyKey,
            event_action: "trigger",
            payload: {
              summary: title,
              severity: "critical",
              source: "aetheron-sentinel",
              custom_details: data,
            },
          },
          {
            timeout: 5000,
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error("Failed to send PagerDuty alert:", error);
      }
    }
  }
}
