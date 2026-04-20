from __future__ import annotations

import json
from pathlib import Path


TOKENS = {
    "{{SENTINEL_INTERCEPTOR_ADDRESS}}": ("SentinelInterceptor", "address"),
    "{{SENTINEL_INTERCEPTOR_START_BLOCK}}": ("SentinelInterceptor", "startBlock"),
    "{{AETHERON_BRIDGE_ADDRESS}}": ("AetheronBridge", "address"),
    "{{AETHERON_BRIDGE_START_BLOCK}}": ("AetheronBridge", "startBlock"),
    "{{RATE_LIMITER_ADDRESS}}": ("RateLimiter", "address"),
    "{{RATE_LIMITER_START_BLOCK}}": ("RateLimiter", "startBlock"),
    "{{CIRCUIT_BREAKER_ADDRESS}}": ("CircuitBreaker", "address"),
    "{{CIRCUIT_BREAKER_START_BLOCK}}": ("CircuitBreaker", "startBlock"),
}


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    template_path = repo_root / "subgraph" / "subgraph.template.yaml"
    deployment_path = repo_root / "subgraph" / "deployments" / "sepolia.json"
    output_path = repo_root / "subgraph" / "subgraph.yaml"

    template = template_path.read_text(encoding="utf-8")
    deployment = json.loads(deployment_path.read_text(encoding="utf-8"))

    rendered = template
    for token, (contract, field) in TOKENS.items():
        value = deployment[contract][field]
        rendered = rendered.replace(token, str(value))

    output_path.write_text(rendered, encoding="utf-8")
    print(f"Rendered {output_path} from {deployment_path}")


if __name__ == "__main__":
    main()
