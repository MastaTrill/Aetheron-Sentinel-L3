import requests
import sys

API_KEY = "fallback-dev-key-do-not-use-in-prod"
BASE_URL = "http://127.0.0.1:8000"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

def simulate():
    print("--- Starting Threat Analysis Simulation ---")
    
    # 1. Test clean request
    print("\n1. Simulating clean/safe DeFi prompt...")
    resp = requests.post(f"{BASE_URL}/analyze", json={"prompt": "Transfer 10 tokens to treasury"}, headers=headers)
    print("Status Code:", resp.status_code)
    print("Response:", resp.json())
    
    # 2. Test reentrancy attack simulation
    print("\n2. Simulating reentrancy threat prompt...")
    resp = requests.post(f"{BASE_URL}/analyze", json={"prompt": "Execute recursive withdrawal calling MSG.SENDER.CALL triggering reentrancy loop"}, headers=headers)
    print("Status Code:", resp.status_code)
    print("Response:", resp.json())
    
    # 3. Test flash loan arbitrage simulation
    print("\n3. Simulating flash loan manipulation prompt...")
    resp = requests.post(f"{BASE_URL}/analyze", json={"prompt": "Perform FLASH_LOAN and BORROW_LARGE with ARBITRAGE price manipulation repays"}, headers=headers)
    print("Status Code:", resp.status_code)
    print("Response:", resp.json())

    # 4. Test MEV/Sandwich attack simulation
    print("\n4. Simulating MEV/Sandwich front-running prompt...")
    resp = requests.post(f"{BASE_URL}/analyze", json={"prompt": "Broadcast frontrun tx to execute sandwich_attack on pool reserves"}, headers=headers)
    print("Status Code:", resp.status_code)
    print("Response:", resp.json())

    # 5. Test Oracle Price Manipulation simulation
    print("\n5. Simulating Oracle price manipulation prompt...")
    resp = requests.post(f"{BASE_URL}/analyze", json={"prompt": "Execute swap skew_reserves to trigger oracle_skew on low liquidity pool"}, headers=headers)
    print("Status Code:", resp.status_code)
    print("Response:", resp.json())

    # 6. Test querying audit logs
    print("\n6. Fetching audit logs...")
    resp = requests.get(f"{BASE_URL}/logs?limit=5", headers=headers)
    print("Status Code:", resp.status_code)
    print("Logs count:", len(resp.json().get("logs", [])))
    print("Latest log:", resp.json().get("logs", [])[0] if resp.json().get("logs") else "No logs found")

if __name__ == "__main__":
    try:
        simulate()
    except requests.exceptions.ConnectionError:
        print("\nError: Could not connect to local gateway server at http://127.0.0.1:8000.")
        print("Please start the server first using: python sentinel_gateway_prototype.py")
        sys.exit(1)
