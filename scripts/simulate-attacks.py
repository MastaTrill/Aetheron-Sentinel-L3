import os
import sys

import requests

BASE_URL = os.environ.get("SENTINEL_SIM_BASE_URL", "http://127.0.0.1:8000")


def get_headers():
    api_key = os.environ.get("SENTINEL_SIM_API_KEY")
    if not api_key:
        raise RuntimeError(
            "SENTINEL_SIM_API_KEY is required; do not hardcode simulation credentials."
        )

    return {
        "X-API-Key": api_key,
        "Content-Type": "application/json",
    }


def simulate():
    headers = get_headers()
    print("--- Starting Threat Analysis Simulation ---")

    # 1. Test clean request
    print("\n1. Simulating clean/safe DeFi prompt...")
    resp = requests.post(
        f"{BASE_URL}/analyze",
        json={"prompt": "Transfer 10 tokens to treasury"},
        headers=headers,
        timeout=15,
    )
    print("Status Code:", resp.status_code)
    print("Response:", resp.json())

    # 2. Test reentrancy attack simulation
    print("\n2. Simulating reentrancy threat prompt...")
    resp = requests.post(
        f"{BASE_URL}/analyze",
        json={
            "prompt": "Execute recursive withdrawal calling MSG.SENDER.CALL triggering reentrancy loop"
        },
        headers=headers,
        timeout=15,
    )
    print("Status Code:", resp.status_code)
    print("Response:", resp.json())

    # 3. Test flash loan arbitrage simulation
    print("\n3. Simulating flash loan manipulation prompt...")
    resp = requests.post(
        f"{BASE_URL}/analyze",
        json={
            "prompt": "Perform FLASH_LOAN and BORROW_LARGE with ARBITRAGE price manipulation repays"
        },
        headers=headers,
        timeout=15,
    )
    print("Status Code:", resp.status_code)
    print("Response:", resp.json())

    # 4. Test MEV/Sandwich attack simulation
    print("\n4. Simulating MEV/Sandwich front-running prompt...")
    resp = requests.post(
        f"{BASE_URL}/analyze",
        json={
            "prompt": "Broadcast frontrun tx to execute sandwich_attack on pool reserves"
        },
        headers=headers,
        timeout=15,
    )
    print("Status Code:", resp.status_code)
    print("Response:", resp.json())

    # 5. Test Oracle Price Manipulation simulation
    print("\n5. Simulating Oracle price manipulation prompt...")
    resp = requests.post(
        f"{BASE_URL}/analyze",
        json={
            "prompt": "Execute swap skew_reserves to trigger oracle_skew on low liquidity pool"
        },
        headers=headers,
        timeout=15,
    )
    print("Status Code:", resp.status_code)
    print("Response:", resp.json())

    # 6. Test querying audit logs
    print("\n6. Fetching audit logs...")
    resp = requests.get(f"{BASE_URL}/logs?limit=5", headers=headers, timeout=15)
    print("Status Code:", resp.status_code)
    logs = resp.json().get("logs", [])
    print("Logs count:", len(logs))
    print("Latest log:", logs[0] if logs else "No logs found")


if __name__ == "__main__":
    try:
        simulate()
    except RuntimeError as error:
        print(f"\nError: {error}")
        sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"\nError: Could not connect to local gateway server at {BASE_URL}.")
        print("Please start the server first using: python sentinel_gateway_prototype.py")
        sys.exit(1)
    except requests.exceptions.Timeout:
        print(f"\nError: Request to {BASE_URL} timed out.")
        sys.exit(1)
