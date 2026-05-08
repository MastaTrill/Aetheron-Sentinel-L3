import requests
import sys

# Force UTF-8 for Windows MINGW64 consoles
if sys.stdout.encoding != "utf-8":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# RPC: Base Mainnet
RPC_URL = "https://mainnet.base.org"
# Aetheron Bridge Address
BRIDGE_ADDRESS = "0x072091f554df794852e0a9d1c809f2b2bbda171e"


def get_tvl():
    print(f"Querying Bridge TVL at: {BRIDGE_ADDRESS}")

    payload = {
        "jsonrpc": "2.0",
        "method": "eth_getBalance",
        "params": [BRIDGE_ADDRESS, "latest"],
        "id": 1,
    }

    try:
        response = requests.post(RPC_URL, json=payload).json()
        if "result" in response:
            hex_val = response["result"]
            wei = int(hex_val, 16)
            eth = wei / 10**18
            print(f"SUCCESS: CURRENT BRIDGE TVL: {eth:.4f} ETH")

            if eth > 0:
                print("STATUS: Liquidity confirmed. Bridge is ACTIVE.")
            else:
                print("STATUS: WARNING - Zero balance. Verify deployment.")
        else:
            print(f"RPC ERROR: {response}")
    except (requests.RequestException, ValueError, KeyError) as e:
        print(f"SCRIPT ERROR: {e}")


if __name__ == "__main__":
    get_tvl()
