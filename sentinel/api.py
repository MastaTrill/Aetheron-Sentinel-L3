import os
import json
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from .utils import calculate_threat_score

async def get_api_key_dep(api_key: str = Header(None, alias="X-API-Key")):
    expected_api_key = os.getenv("SENTINEL_API_KEY", "fallback-dev-key-do-not-use-in-prod")
    if api_key != expected_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")
    return api_key

router = APIRouter()

class SyncRequest(BaseModel):
    data: dict
    table_name: str = "sentinel_data"


@router.post("/sync", dependencies=[Depends(get_api_key_dep)])
async def sync(request: SyncRequest):
    try:
        from supabase.sync import sync_sentinel_data
        sync_sentinel_data(request.data, request.table_name)
        return {"status": "synced"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        log_path = "audit_log.jsonl"
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
@router.get("/logs", dependencies=[Depends(get_api_key_dep)])
async def get_logs(limit: int = 50):
    logs = []
    try:
        log_path = "audit_log.jsonl"
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                for line in lines[-limit:]:
                    if line.strip():
                        logs.append(json.loads(line))
        return {"logs": logs[::-1]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
