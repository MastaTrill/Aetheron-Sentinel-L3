import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from .api import router, http_exception_handler, validation_exception_handler

def get_app() -> FastAPI:
    app = FastAPI(title="Aetheron Sentinel L3 API", version="0.1.0")
    # Include routes at root
    app.include_router(router)
    # Also expose routes under /api prefix for backward compatibility
    app.include_router(router, prefix="/api", tags=["Sentinel"])
    # Register exception handlers on the app
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    
    # Prometheus metrics endpoint
    instrumentator = Instrumentator()
    instrumentator.instrument(app).expose(app)
    
    return app

app = get_app()
