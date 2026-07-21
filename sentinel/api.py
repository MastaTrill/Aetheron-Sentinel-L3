from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from .utils import calculate_threat_score
from .utils import calculate_threat_score

async def get_api_key_dep(api_key: str = Header(None, alias="X-API-Key")):
    from sentinel_gateway_prototype import get_api_key
    return get_api_key(api_key)

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
    return AnalyzeResponse(score=score, reasons=reasons)

import json
import os

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
