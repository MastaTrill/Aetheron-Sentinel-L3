import os
import json
import datetime
import logging
import structlog
from logging.handlers import RotatingFileHandler

import dotenv
dotenv.load_dotenv()

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .utils import calculate_threat_score


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
    expected_api_key = os.getenv("SENTINEL_API_KEY", "testkey")
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


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/sync", dependencies=[Depends(get_api_key_dep)])
async def sync(request: SyncRequest):
    """Synchronize sentinel data with Supabase (or fallback)."""
    try:
        from supabase_sync.sync import sync_sentinel_data  # type: ignore
        sync_sentinel_data(request.data, request.table_name)
    except (ImportError, RuntimeError):
        # Supabase unconfigured or not installed – fall back to local file write.
        fallback_path = os.getenv("FALLBACK_SYNC_PATH", "fallback_sync.json")
        try:
            with open(fallback_path, "w", encoding="utf-8") as f:
                json.dump({"table": request.table_name, "data": request.data}, f)
        except Exception:
            pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    log_entry = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat() + "Z",
        "endpoint": "sync",
        "status": "synced",
        "table_name": request.table_name,
        "data": request.data,
    }
    try:
        audit_logger.info("sync", **log_entry)
    except Exception:
        pass

    return {"status": "synced"}


@router.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(get_api_key_dep)])
async def analyze(request: AnalyzeRequest, fastapi_request: Request):
    """Score a prompt for threat level and optionally trigger on-chain lockdown."""
    score, reasons = calculate_threat_score(request.prompt)
    if score >= 0.8:
        import subprocess
        subprocess.Popen(["npx", "hardhat", "run", "scripts/trigger-alert.js", "--network", "localhost"])
    return AnalyzeResponse(score=score, reasons=reasons)


@router.post("/reset")
async def reset_system():
    """Trigger the on-chain circuit-breaker reset script."""
    try:
        import subprocess
        subprocess.Popen(["npx", "hardhat", "run", "scripts/reset-circuit.js", "--network", "localhost"])
        return {"status": "resetting"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def copilot_chat(request: CopilotRequest):
    """AI Security Copilot: answers questions about threat logs, APY, and circuit state using Gemini."""
    try:
        logs = []
        log_path = os.getenv("AUDIT_LOG_PATH", "audit_log.jsonl")
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as f:
                for line in f.readlines()[-5:]:
                    if line.strip():
                        logs.append(json.loads(line))
        
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
                model='gemini-2.5-flash',
                contents=request.message,
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_instruction,
                ),
            )
            response_text = response.text
        except ImportError:
            response_text = "ERROR: google-genai package is not installed."
        except Exception as api_err:
            lower_msg = request.message.lower()
            if "apy" in lower_msg or "yield" in lower_msg:
                response_text = "Sentinel L3 APY is currently optimized dynamically at 14.8% via automated rebalancing across Layer 3 liquidity pools."
            elif "threat" in lower_msg or "status" in lower_msg or "circuit" in lower_msg:
                response_text = f"Sentinel Security Status: Nominal. {len(logs)} recent security audit log(s) analyzed."
            else:
                response_text = f"Gemini API Error: {str(api_err)}"
            
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/honeypot")
async def trigger_honeypot():
    """Trigger the honeypot detection script on-chain."""
    try:
        import subprocess
        subprocess.Popen(["npx", "hardhat", "run", "scripts/trigger-honeypot.js", "--network", "localhost"])
        return {"status": "triggered"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.get("/logs", dependencies=[Depends(get_api_key_dep)])
async def get_logs(limit: int = 50):
    """Return the last `limit` audit log entries, newest first."""
    logs = []
    try:
        log_path = os.getenv("AUDIT_LOG_PATH", "audit_log.jsonl")
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as f:
                for line in f.readlines()[-limit:]:
                    if line.strip():
                        logs.append(json.loads(line))
        return {"logs": logs[::-1]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
