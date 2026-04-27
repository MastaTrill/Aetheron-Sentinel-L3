import requests

RPC_URL = "https://mainnet.base.org"
AETX_TOKEN = "0xfe0c0b15798b8c9107cd4aa556a87eb031263e8b"

def get_owner():
    # owner() selector: 0x8da5cb5b
    payload = {
        "jsonrpc": "2.0", "method": "eth_call",
        "params": [{"to": AETX_TOKEN, "data": "0x8da5cb5b"}, "latest"],
        "id": 1
    }
    try:
        r = requests.post(RPC_URL, json=payload).json()
        raw_address = r.get('result', '0x')
        # Clean the padding (last 40 chars)
        vault_address = "0x" + raw_address[-40:]
        print(f"IDENTIFIED: Potential Retainer Vault (Owner): {vault_address}")
        return vault_address
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    get_owner()
