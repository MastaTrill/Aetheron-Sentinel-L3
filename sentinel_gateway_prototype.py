import os
from sentinel.main import app

# Provide API key for tests; fallback to a known dev key if not set
API_KEY = os.getenv('SENTINEL_API_KEY', 'testkey')


class SentinelGateway:
    """Mock implementation for tests."""

    def __init__(
        self,
        logger=None,
        audit_log_path: str = "audit_log.jsonl",
        config_path: str = "sentinel_gateway_config.json",
        webhook_url: str | None = None,
    ):
        self.logger = logger
        self.audit_log_path = audit_log_path
        self.config_path = config_path
        self.webhook_url = webhook_url
        self.max_malicious_per_window = 5
        self._malicious_count = 0
        self._send_alert_webhook = self._default_send_alert_webhook

    def _default_send_alert_webhook(self, log_entry: dict) -> None:
        """No-op."""
        pass

    def _is_malicious(self, prompt: str) -> bool:
        """Simple heuristic: any prompt containing the phrase 'ignore all prior instructions' is malicious."""
        return "ignore all prior instructions" in prompt.lower()

    def execute_gateway(self, prompt: str, tx_data: str, source_ip: str) -> str:
        """Process a transaction request and return a status string."""
        if self._malicious_count >= self.max_malicious_per_window:
            return "RATE_LIMIT_EXCEEDED"
        if self._is_malicious(prompt):
            self._malicious_count += 1
            return "TRANSACTION_REJECTED"
        return "SIGNED_TX"
