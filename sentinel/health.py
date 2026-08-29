from fastapi import APIRouter

router = APIRouter()

@router.get("/health", tags=["Health"])
def health_check():
    """Simple health‑check endpoint used by orchestration and monitoring tools."""
    return {"status": "ok"}
