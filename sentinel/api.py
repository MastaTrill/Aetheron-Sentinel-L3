import datetime
import json
import logging
import os
import subprocess
from logging.handlers import RotatingFileHandler

import dotenv
import structlog
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .utils import calculate_threat_score

dotenv.load_dotenv()


# ── Logging setup ──────────────────────────────────────────────────────────────

def _configure_structlog() -> None:
    """Configure structlog once for the process (idempotent)."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


_configure_structlog()

# Audit logger — rotating JSON lines, not propagated to root logger
_audit_stdlib_logger = logging.getLogger("sentinel.audit")
if not _audit_stdlib_logger.handlers:
    _handler = RotatingFileHandler(
        os.getenv("AUDIT_LOG_PATH", "audit_log.jsonl"),
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    _handler.setFormatter(logging.Formatter("%(message)s"))
    _audit_stdlib_logger.addHandler(_handler)
    _audit_stdlib_logger.propagate = False
    _audit_stdlib_logger.setLevel(logging.INFO)

audit_logger = structlog.get_logger("sentinel.audit")


# ── Auth dependency ────────────────────────────────────────────────────────────

async def get_api_key_dep(api_key: str = Header(None, alias="X-API-Key")):
    expected_api_key = (os.getenv("SENTINEL_API_KEY") or "").strip()
    if not expected_api_key:
        raise HTTPException(status_code=503, detail="API authentication is not configured")
    if api_key != expected_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")
    return api_key


# ── Router + exception handlers ────────────────────────────────────────────────

router = APIRouter()


async def http_exception_handler(request: Request, exc: HTTPException):
    audit_logger.error("http_exception", detail=exc.detail, path=str(request.url))
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    audit_logger.error("validation_error", detail=exc.errors(), path=str(request.url))
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


# ── Models ─────────────────────────────────────────────────────────────────────

class SyncRequest(BaseModel):
    data: dict
    table_name: str = "sentinel_data"


class AnalyzeRequest(BaseModel):
    prompt: str


class AnalyzeResponse(BaseModel):
    score: float
    reasons: list[str]


class CopilotRequest(BaseModel):
    message: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _recent_audit_logs(limit: int) -> list[dict]:
    """Read up to `limit` valid JSON audit records from disk."""
    log_path = os.getenv("AUDIT_LOG_PATH", "audit_log.jsonl")
    if not os.path.exists(log_path):
        return []

    logs: list[dict] = []
    try:
        with open(log_path, encoding="utf-8") as log_file:
            for line in log_file.readlines()[-limit:]:
                if not line.strip():
                    continue
                try:
                    logs.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    audit_logger.warning("invalid_audit_log_line", error=str(exc))
    except OSError as exc:
        audit_logger.warning("audit_log_read_failed", error=str(exc))
    return logs


def _local_automation_enabled() -> bool:
    """Return whether local Hardhat control scripts are explicitly enabled."""
    value = (os.getenv("SENTINEL_LOCAL_AUTOMATION_ENABLED") or "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _start_local_hardhat_script(script_path: str) -> None:
    """Start a local-only Hardhat control script when automation is enabled."""
    if not _local_automation_enabled():
        raise HTTPException(status_code=503, detail="Local Sentinel automation is disabled")
    try:
        subprocess.Popen(["npx", "hardhat", "run", script_path, "--network", "localhost"])
    except OSError as exc:
        audit_logger.error("local_automation_start_failed", script=script_path, error=str(exc))
        raise HTTPException(status_code=503, detail="Local Sentinel automation is unavailable") from exc


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/sync", dependencies=[Depends(get_api_key_dep)])
def sync(request: SyncRequest):
    """Synchronize sentinel data with Supabase (or fallback)."""
    try:
        from supabase_sync.sync import sync_sentinel_data  # type: ignore

        sync_sentinel_data(request.data, request.table_name)
    except (ImportError, RuntimeError):
        fallback_path = os.getenv("FALLBACK_SYNC_PATH", "fallback_sync.json")
        try:
            with open(fallback_path, "w", encoding="utf-8") as fallback_file:
                json.dump({"table": request.table_name, "data": request.data}, fallback_file)
        except (OSError, TypeError) as exc:
            audit_logger.error("fallback_sync_failed", error=str(exc))
            raise HTTPException(status_code=500, detail="Fallback synchronization failed") from exc
    except Exception as exc:
        audit_logger.error("supabase_sync_failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Supabase synchronization failed") from exc

    log_entry = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "endpoint": "sync",
        "status": "synced",
        "table_name": request.table_name,
        "data": request.data,
    }
    audit_logger.info("sync", **log_entry)
    return {"status": "synced"}


@router.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(get_api_key_dep)])
def analyze(request: AnalyzeRequest):
    """Score a prompt for threat level and optionally trigger an explicitly enabled local alert."""
    score, reasons = calculate_threat_score(request.prompt)
    if score >= 0.8 and _local_automation_enabled():
        _start_local_hardhat_script("scripts/trigger-alert.js")
    return AnalyzeResponse(score=score, reasons=reasons)


@router.post("/reset", dependencies=[Depends(get_api_key_dep)])
def reset_system():
    """Trigger the local circuit-breaker reset script when explicitly enabled."""
    _start_local_hardhat_script("scripts/reset-circuit.js")
    return {"status": "resetting"}


@router.post("/chat", dependencies=[Depends(get_api_key_dep)])
def copilot_chat(request: CopilotRequest):
    """Answer security questions using Gemini when the provider is available."""
    logs = _recent_audit_logs(5)
    system_instruction = (
        "You are the Sentinel AI Security Copilot. You monitor an L3 blockchain protocol for threats, "
        "explain APY yield status, and describe circuit breaker mechanisms. "
        "Recent threat logs are provided below for context.\n\n"
        f"RECENT LOGS:\n{json.dumps(logs, indent=2)}\n\n"
        "Keep your responses concise, professional, and security-focused."
    )

    try:
        from google import genai

        client = genai.Client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=request.message,
            config=genai.types.GenerateContentConfig(system_instruction=system_instruction),
        )
        response_text = response.text
    except ImportError as exc:
        audit_logger.error("copilot_dependency_unavailable", error=str(exc))
        raise HTTPException(status_code=503, detail="AI copilot is unavailable") from exc
    except Exception as exc:
        audit_logger.error("copilot_provider_unavailable", error=str(exc))
        raise HTTPException(status_code=503, detail="AI copilot provider is unavailable") from exc

    if not response_text:
        raise HTTPException(status_code=503, detail="AI copilot returned no response")
    return {"response": response_text}


@router.post("/honeypot", dependencies=[Depends(get_api_key_dep)])
def trigger_honeypot():
    """Trigger the local honeypot detection script when explicitly enabled."""
    _start_local_hardhat_script("scripts/trigger-honeypot.js")
    return {"status": "triggered"}


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.get("/logs", dependencies=[Depends(get_api_key_dep)])
def get_logs(limit: int = 50):
    """Return the last `limit` audit log entries, newest first."""
    safe_limit = max(1, min(limit, 500))
    return {"logs": _recent_audit_logs(safe_limit)[::-1]}


# ── App instance ───────────────────────────────────────────────────────────────

app = FastAPI(title="Aetheron Sentinel AI Gateway", version="1.0.0")
app.include_router(router)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
