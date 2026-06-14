from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from .utils import calculate_threat_score
from sentinel_gateway_prototype import get_api_key
from supabase.sync import sync_sentinel_data

router = APIRouter()

class SyncRequest(BaseModel):
    data: dict
    table_name: str = "sentinel_data"


@router.post("/sync", dependencies=[Depends(get_api_key)])
async def sync(request: SyncRequest):
    try:
        sync_sentinel_data(request.data, request.table_name)
        return {"status": "synced"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AnalyzeRequest(BaseModel):
    prompt: str

class AnalyzeResponse(BaseModel):
    score: float
    reasons: list[str]

@router.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(get_api_key)])
async def analyze(request: AnalyzeRequest, fastapi_request: Request):
    score, reasons = calculate_threat_score(request.prompt)
    return AnalyzeResponse(score=score, reasons=reasons)
