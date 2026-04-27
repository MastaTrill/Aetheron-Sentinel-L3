import requests
import sys

if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

RPC_URL = "https://mainnet.base.org"
# Potential Vault (Contract Creator)
CREATOR_ADDRESS = "0x04d17367c0062E0B259646b9a89680F2b0F1B0DD"

TOKENS = {
    "USDC": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "AETX": "0xfe0c0b15798b8c9107cd4aa556a87eb031263e8b"
}

def get_erc20_balance(token_name, token_address):
    data = f"0x70a08231000000000000000000000000{CREATOR_ADDRESS[2:]}"
    payload = {
        "jsonrpc": "2.0", "method": "eth_call",
        "params": [{"to": token_address, "data": data}, "latest"],
        "id": 1
    }
    try:
        r = requests.post(RPC_URL, json=payload).json()
        hex_val = r.get('result', '0x0')
        balance = int(hex_val, 16)
        decimals = 6 if token_name == "USDC" else 18
        final_balance = balance / (10**decimals)
        print(f"SUCCESS: {token_name} Balance: {final_balance:,.2f}")
        return final_balance
    except:
        return 0

print(f"Auditing Creator/Vault: {CREATOR_ADDRESS}")
get_erc20_balance("USDC", TOKENS["USDC"])
get_erc20_balance("AETX", TOKENS["AETX"])
