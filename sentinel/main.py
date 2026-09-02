import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
import structlog
from .api import router, http_exception_handler, validation_exception_handler
from .health import router as health_router


def _allowed_cors_origins() -> list[str]:
    """Return the explicit browser origins allowed to call the API."""
    raw_origins = os.getenv("SENTINEL_CORS_ORIGINS", "")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    if "*" in origins:
        raise RuntimeError("SENTINEL_CORS_ORIGINS must list explicit origins; wildcard CORS is not allowed")
    return origins


def get_app() -> FastAPI:
    app = FastAPI(
        title="Aetheron Sentinel L3 API",
        version="0.1.0",
        description="AI-powered DeFi threat analysis and on-chain circuit-breaker API.",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS is deny-by-default. Browser access must be enabled with an explicit,
    # comma-separated SENTINEL_CORS_ORIGINS allowlist.
    cors_origins = _allowed_cors_origins()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=bool(cors_origins),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting — 100 requests/minute per IP
    limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_exception_handler(429, _rate_limit_exceeded_handler)

    # Versioned + legacy route prefixes
    app.include_router(router, prefix="/v1")
    app.include_router(health_router, prefix="")
    app.include_router(router, prefix="/api", tags=["Sentinel"])  # backward compat

    # Custom exception handlers
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    # Prometheus metrics
    Instrumentator().instrument(app).expose(app)

    return app


app = get_app()
