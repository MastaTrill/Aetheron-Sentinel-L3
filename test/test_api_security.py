from pathlib import Path

from fastapi.testclient import TestClient

from sentinel.api import get_api_key_dep, router
from sentinel.main import get_app


def _route_dependency_calls(path: str):
    route = next(route for route in router.routes if route.path == path)
    return {dependency.call for dependency in route.dependant.dependencies}


def test_sensitive_api_routes_require_authentication_dependency():
    for path in ("/reset", "/chat", "/honeypot"):
        assert get_api_key_dep in _route_dependency_calls(path), path


def test_api_authentication_fails_closed_when_server_key_is_missing(monkeypatch):
    monkeypatch.delenv("SENTINEL_API_KEY", raising=False)
    client = TestClient(get_app())

    response = client.get("/api/logs", headers={"X-API-Key": "testkey"})

    assert response.status_code == 503


def test_default_cors_policy_does_not_allow_arbitrary_origins(monkeypatch):
    monkeypatch.setenv("SENTINEL_API_KEY", "unit-test-api-key")
    monkeypatch.delenv("SENTINEL_CORS_ORIGINS", raising=False)
    client = TestClient(get_app())

    response = client.options(
        "/api/logs",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.headers.get("access-control-allow-origin") is None


def test_docker_uses_hardened_application_entrypoint():
    dockerfile = Path("Dockerfile").read_text(encoding="utf-8")
    assert '"sentinel.main:app"' in dockerfile
