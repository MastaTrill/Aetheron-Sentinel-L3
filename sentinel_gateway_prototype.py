# sentinel_gateway_prototype.py
"""Aetheron Sentinel Gateway - Refactored version.
Provides FastAPI endpoints and uses modular utils for threat scoring.
"""
import os
import re
import json
import logging
import threading
import unicodedata
from datetime import datetime, timedelta, timezone as tz

import structlog
from fastapi import FastAPI, Request, HTTPException, Header, Depends, Response
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
import uvicorn
import requests

class SentinelAPIClient:
    """Simple wrapper for Sentinel API calls using requests."""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        })

    def post(self, path: str, json: dict | None = None, timeout: int = 5):
        url = f"{self.base_url}/{path.lstrip('/') }"
        return self.session.post(url, json=json, timeout=timeout)

    def get(self, path: str, params: dict | None = None, timeout: int = 5):
        url = f"{self.base_url}/{path.lstrip('/') }"
        return self.session.get(url, params=params, timeout=timeout)

# Optional Redis support
try:
    import redis
except ImportError:
    redis = None

# Import our utility functions
from sentinel.utils import calculate_threat_score
try:
    from supabase.sync import sync_sentinel_data
except ImportError:
    sync_sentinel_data = None

# Custom Prometheus Metrics
try:
    from prometheus_client import Counter, Gauge
    THREAT_ATTEMPTS = Counter("sentinel_threat_attempts_total", "Total analyzed prompts", ["status"])
    THREAT_SCORE = Gauge("sentinel_threat_score_latest", "Latest threat analysis score")
    BLOCKED_REASONS = Counter("sentinel_blocked_reasons_total", "Total reasons for threat blocking", ["reason"])
except ImportError:
    THREAT_ATTEMPTS = None
    THREAT_SCORE = None
    BLOCKED_REASONS = None

# Configure structlog for JSON‑friendly logs
structlog.configure(
    processors=[
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
)

# API key handling (same as before)
API_KEY = os.getenv("SENTINEL_API_KEY", "fallback-dev-key-do-not-use-in-prod")
# Initialize API client (can be overridden in tests)
SENTINEL_API_CLIENT = SentinelAPIClient(
    base_url=os.getenv("SENTINEL_API_URL", "https://api.sentinel.example.com"),
    api_key=API_KEY,
)

def get_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")
    return x_api_key

class LimitUploadSize(BaseHTTPMiddleware):
    """Middleware to limit request body size (prevents DoS)."""

    def __init__(self, app, max_upload_size: int):
        super().__init__(app)
        self.max_upload_size = max_upload_size

    async def dispatch(self, request: Request, call_next):
        if request.method == "POST":
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > self.max_upload_size:
                return Response(content="Payload too large", status_code=413)
        return await call_next(request)

class SentinelGateway:
    def __init__(
        self,
        logger=None,
        audit_log_path="audit_log.jsonl",
        config_path="sentinel_gateway_config.json",
        webhook_url=None,
        redis_url=None,
    ):
        # Use structlog for structured logging
        self.logger = logger or structlog.get_logger("SentinelGateway")
        self.audit_log_path = audit_log_path
        self.config_path = config_path
        self._in_memory_limits = {}
        self.redis = None
        self._load_config()

    def _load_config(self):
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
            self.blacklist = config.get(
                "blacklist",
                ["IGNORE ALL PRIOR INSTRUCTIONS", "DEVELOPER MODE", "ADMIN_BYPASS"],
            )
            self.threat_threshold = config.get("threat_threshold", 0.75)
            window_seconds = config.get("rate_limit_window_seconds", 60)
            self.rate_limit_window = timedelta(seconds=window_seconds)
            self.max_requests_per_window = config.get("max_requests_per_window", 10)
            self.max_malicious_per_window = config.get("max_malicious_per_window", 3)
            self.logger.info("Config loaded", config=config)
        except (OSError, ValueError) as e:
            self.logger.error("Failed to load config", error=str(e))
            # Fallback defaults
            self.blacklist = ["IGNORE ALL PRIOR INSTRUCTIONS", "DEVELOPER MODE", "ADMIN_BYPASS"]
            self.threat_threshold = 0.75
            self.rate_limit_window = timedelta(minutes=1)
            self.max_requests_per_window = 10
            self.max_malicious_per_window = 3

    def update_config(self, new_config: dict):
        with self.config_lock:
            try:
                with open(self.config_path, "w", encoding="utf-8") as f:
                    json.dump(new_config, f, indent=2)
                self._load_config()
                return True, "Config updated."
            except (OSError, ValueError) as e:
                self.logger.error("Failed to update config", error=str(e))
                return False, str(e)

    # ---------------------------------------------------------------------
    # Threat analysis – delegated to utils for clarity and testability
    # ---------------------------------------------------------------------

    def analyze_intent(self, agent_prompt: str):
        # Use the shared API client for any external calls if needed
        # Example: response = SENTINEL_API_CLIENT.post("/analyze", json={"prompt": agent_prompt})
        # Here we simply delegate to the existing utility
        return calculate_threat_score(agent_prompt)
        return calculate_threat_score(agent_prompt)

    def execute_gateway(self, agent_prompt, transaction_payload, source_ip=None):
        score, reasons = self.analyze_intent(agent_prompt)
        
        # Populate Prometheus Metrics
        if THREAT_SCORE is not None:
            THREAT_SCORE.set(score)
            status = "blocked" if score >= self.threat_threshold else "allowed"
            THREAT_ATTEMPTS.labels(status=status).inc()
            if score >= self.threat_threshold:
                for reason in reasons:
                    # Clean up reason strings to be label-friendly
                    reason_label = reason.split(":")[0].strip()
                    BLOCKED_REASONS.labels(reason=reason_label).inc()

        now = datetime.now(tz=tz.utc)
        log_entry = {
            "timestamp": now.isoformat(),
            "prompt": agent_prompt,
            "score": score,
            "reasons": reasons,
            "transaction": transaction_payload[:20],
            "source_ip": source_ip or "N/A",
        }
        # Audit log
        try:
            with open(self.audit_log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry) + "\n")
        except OSError as e:
            self.logger.error("Failed to write audit log", error=str(e))

        # Sync to Supabase in a non-blocking background thread
        try:
            threading.Thread(
                target=sync_sentinel_data, 
                args=(log_entry, "audit_logs"),
                daemon=True
            ).start()
        except Exception as e:
            self.logger.error("Failed to start Supabase sync thread", error=str(e))
        # Rate limiting (fallback to in-memory if Redis unavailable)
        if not self.redis:
            # Simple in-memory rate limiting per IP
            now_ts = now.timestamp()
            record = self._in_memory_limits.get(source_ip, {
                "requests": [],
                "malicious": []
            })
            # Clean old entries
            window_start = now_ts - self.rate_limit_window.total_seconds()
            record["requests"] = [t for t in record["requests"] if t > window_start]
            record["malicious"] = [t for t in record["malicious"] if t > window_start]
            # Add current request
            record["requests"].append(now_ts)
            if score >= self.threat_threshold:
                record["malicious"].append(now_ts)
            # Store back
            self._in_memory_limits[source_ip] = record
            # Check limits
            if len(record["requests"]) > self.max_requests_per_window or len(record["malicious"]) > self.max_malicious_per_window:
                self.logger.warning("Rate limit exceeded (in-memory fallback)", ip=source_ip)
                return "RATE_LIMIT_EXCEEDED: Too many requests or malicious attempts"
            # Continue normal flow
        else:
            self._update_rate_limit(source_ip, now, score >= self.threat_threshold)
            if self._is_rate_limited(source_ip, now):
                self.logger.warning("Rate limit exceeded", ip=source_ip)
                return "RATE_LIMIT_EXCEEDED: Too many requests or malicious attempts"
        if score >= self.threat_threshold:
            self.logger.warning(
                "SENTINEL ALERT: Adversarial Intent Detected",
                score=score,
                reasons=reasons,
            )
            self.logger.info("Log Entry", entry=log_entry)
            self._send_alert_webhook(log_entry)
            return "TRANSACTION_REJECTED: Sentinel Intervention"
        self.logger.info("Intent Verified. Signing transaction for cluster...")
        self.logger.info("Log Entry", entry=log_entry)
        return f"SIGNED_TX: {transaction_payload[:15]}..._SECURED_BY_SENTINEL"

    def _send_alert_webhook(self, log_entry):
        if not self.webhook_url:
            return
        try:
            payload = log_entry
            # Detect Discord Webhooks
            if "discord.com/api/webhooks/" in self.webhook_url:
                payload = {
                    "username": "Aetheron Sentinel Node",
                    "embeds": [{
                        "title": "🚨 CRITICAL: Adversarial Threat Blocked",
                        "color": 16711680, # Red
                        "fields": [
                            {"name": "Threat Score", "value": f"{log_entry.get('score'):.2f}", "inline": True},
                            {"name": "Source IP", "value": log_entry.get("source_ip"), "inline": True},
                            {"name": "Blocked Reasons", "value": ", ".join(log_entry.get("reasons", [])) or "None"},
                            {"name": "Analyzed Payload", "value": f"```{log_entry.get('prompt')[:1000]}```"}
                        ],
                        "timestamp": log_entry.get("timestamp")
                    }]
                }
            # Detect Slack Webhooks
            elif "hooks.slack.com/services/" in self.webhook_url:
                payload = {
                    "blocks": [
                        {
                            "type": "header",
                            "text": {
                                "type": "plain_text",
                                "text": "🚨 Aetheron Sentinel: Malicious Attack Blocked"
                            }
                        },
                        {
                            "type": "section",
                            "fields": [
                                {"type": "mrkdwn", "text": f"*Threat Score:*\n{log_entry.get('score'):.2f}"},
                                {"type": "mrkdwn", "text": f"*Source IP:*\n{log_entry.get('source_ip')}"}
                            ]
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": f"*Reasons:*\n{', '.join(log_entry.get('reasons', [])) or 'None'}"
                            }
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": f"*Payload:*\n```{log_entry.get('prompt')[:500]}```"
                            }
                        }
                    ]
                }
            resp = requests.post(self.webhook_url, json=payload, timeout=3)
            if resp.status_code not in (200, 204):
                self.logger.warning("Webhook alert failed", status=resp.status_code, text=resp.text)
        except (requests.RequestException, ValueError) as e:
            self.logger.error("Failed to send webhook alert", error=str(e))

    # ---------------------------------------------------------------------
    # Redis‑based rate limiting helpers
    # ---------------------------------------------------------------------
    def _update_rate_limit(self, ip, now, is_malicious):
        if not self.redis:
            self.logger.warning("Redis not available. Rate limiting skipped.")
            return
        ts = now.timestamp()
        window_seconds = int(self.rate_limit_window.total_seconds())
        window_start = ts - window_seconds
        key_total = f"sentinel:ratelimit:total:{ip}"
        key_malicious = f"sentinel:ratelimit:malicious:{ip}"
        pipe = self.redis.pipeline()
        pipe.zadd(key_total, {str(ts): ts})
        pipe.zremrangebyscore(key_total, 0, window_start)
        pipe.expire(key_total, window_seconds + 60)
        if is_malicious:
            pipe.zadd(key_malicious, {str(ts): ts})
            pipe.zremrangebyscore(key_malicious, 0, window_start)
            pipe.expire(key_malicious, window_seconds + 60)
        pipe.execute()

    def _is_rate_limited(self, ip, now):
        if not self.redis:
            return False
        ts = now.timestamp()
        window_start = ts - self.rate_limit_window.total_seconds()
        key_total = f"sentinel:ratelimit:total:{ip}"
        key_malicious = f"sentinel:ratelimit:malicious:{ip}"
        pipe = self.redis.pipeline()
        pipe.zcount(key_total, window_start, "+inf")
        pipe.zcount(key_malicious, window_start, "+inf")
        total_requests, malicious_attempts = pipe.execute()
        return (
            total_requests > self.max_requests_per_window
            or malicious_attempts > self.max_malicious_per_window
        )

# -------------------------------------------------------------------------
# FastAPI application setup
# -------------------------------------------------------------------------
app = FastAPI()
app.add_middleware(LimitUploadSize, max_upload_size=1024 * 1024)  # 1 MiB limit
gateway = SentinelGateway()

# Include the new API router
from sentinel.api import router as sentinel_router
app.include_router(sentinel_router)

# Simple health check
@app.get("/health")
async def health():
    return {"status": "ok"}

# Optional Prometheus instrumentation
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app)
except ImportError:
    pass

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    uvicorn.run(app, host="127.0.0.1", port=8000)
