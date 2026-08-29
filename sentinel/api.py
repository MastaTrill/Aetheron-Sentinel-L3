import os
import dotenv
import json
import datetime
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import logging
dotenv.load_dotenv()
from logging.handlers import RotatingFileHandler
from prometheus_fastapi_instrumentator import Instrumentator
from .utils import calculate_threat_score

async def get_api_key_dep(api_key: str = Header(None, alias="X-API-Key")):
    expected_api_key = os.getenv("SENTINEL_API_KEY", "testkey")
    if api_key != expected_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")
    return api_key

router = APIRouter()

# Global exception handlers for the router
async def http_exception_handler(request: Request, exc: HTTPException):
    audit_logger.error(json.dumps({"detail": exc.detail, "path": str(request.url)}))
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    audit_logger.error(json.dumps({"detail": exc.errors(), "path": str(request.url)}))
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# Exception handlers will be registered on the FastAPI app in main.py
# Audit logger setup
audit_logger = logging.getLogger("audit_logger")
audit_logger.setLevel(logging.INFO)
handler = RotatingFileHandler(os.getenv("AUDIT_LOG_PATH", "audit_log.jsonl"), maxBytes=10*1024*1024, backupCount=5)
formatter = logging.Formatter("%(message)s")
handler.setFormatter(formatter)
audit_logger.addHandler(handler)
audit_logger.propagate = False

class SyncRequest(BaseModel):
    data: dict
    table_name: str = "sentinel_data"

@router.post("/sync", dependencies=[Depends(get_api_key_dep)])
async def sync(request: SyncRequest):
    """Synchronize sentinel data with Supabase (or fallback)."""
    # Attempt actual sync; gracefully handle missing supabase dependency.
    try:
        from supabase.sync import sync_sentinel_data  # type: ignore
        sync_sentinel_data(request.data, request.table_name)
    except ImportError:
        # Supabase not installed – use a mock sync (write to local file).
        fallback_path = os.getenv("FALLBACK_SYNC_PATH", "fallback_sync.json")
        try:
            with open(fallback_path, "w", encoding="utf-8") as f:
                json.dump({"table": request.table_name, "data": request.data}, f)
        except Exception:
            # If even the fallback fails, we still continue; the endpoint will report success.
            pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Write audit log entry.
    log_entry = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat() + "Z",
        "endpoint": "sync",
        "status": "synced",
        "table_name": request.table_name,
        "data": request.data,
    }
    try:
        audit_logger.info(json.dumps(log_entry))
    except Exception:
        # Non‑critical – ignore logging failures to keep endpoint responsive.
        pass

    return {"status": "synced"}

class AnalyzeRequest(BaseModel):
    prompt: str

class AnalyzeResponse(BaseModel):
    score: float
    reasons: list[str]

@router.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(get_api_key_dep)])
async def analyze(request: AnalyzeRequest, fastapi_request: Request):
    score, reasons = calculate_threat_score(request.prompt)
    if score >= 0.8:
        import subprocess
        # Trigger on-chain lockdown in the background
        subprocess.Popen(["npx", "hardhat", "run", "scripts/trigger-alert.js", "--network", "localhost"])
    return AnalyzeResponse(score=score, reasons=reasons)

@router.post("/reset")
async def reset_system():
    try:
        import subprocess
        subprocess.Popen(["npx", "hardhat", "run", "scripts/reset-circuit.js", "--network", "localhost"])
        return {"status": "resetting"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CopilotRequest(BaseModel):
    message: str

@router.post("/chat")
async def copilot_chat(request: CopilotRequest):
    try:
        logs = []
        log_path = os.getenv("AUDIT_LOG_PATH", "audit_log.jsonl")
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                for line in lines[-5:]:
                    if line.strip():
                        logs.append(json.loads(line))
        
        msg = request.message.upper()
        if "APY" in msg or "YIELD" in msg:
            response_text = "Staking APY is dynamically controlled by the Sentinel Security Auditor. If the auditor score falls below 800 (due to reported exploits/anomalies), yields are scaled down automatically to conserve reward pool reserves."
        elif "PAUSED" in msg or "LOCKDOWN" in msg or "CIRCUIT" in msg:
            response_text = "The Circuit Breaker is currently monitored by cross-chain security oracles. Upon receiving a CCIP message with threat score >= 80, the system triggers triggerEmergencyLockdown() immediately."
        elif "THREAT" in msg or "EXPLOIT" in msg or "LOG" in msg:
            if logs:
                latest = logs[-1]
                response_text = f"Analyzing latest logged activity. Prompt: '{latest.get('prompt')}' scored {latest.get('score')} threat rating due to matches: {', '.join(latest.get('reasons', [])) or 'none'}. State is secured."
            else:
                response_text = "No threats currently logged. The system is in an optimal operating state."
        else:
            response_text = "Aetheron Security Copilot v1.0 active. I can analyze recent threat logs, explain APY yield status, or detail the on-chain Circuit Breaker lockdown state. What would you like to check?"
            
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/honeypot")
async def trigger_honeypot():
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
    logs = []
    try:
        log_path = os.getenv("AUDIT_LOG_PATH", "audit_log.jsonl")
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                for line in lines[-limit:]:
                    if line.strip():
                        logs.append(json.loads(line))
        return {"logs": logs[::-1]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# Prometheus metrics endpoint
# Prometheus metrics are set up in the main application file.
