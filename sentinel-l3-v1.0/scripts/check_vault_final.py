import requests
import sys

if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

RPC_URL = "https://mainnet.base.org"
# The Aetheron Retainer Vault (Multi-Sig Candidate)
VAULT_ADDRESS = "0x04d17367c0062E0B259646b9a89680F2b0F1B0DD" 

TOKENS = {
    "USDC": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "AETX": "0xfe0c0b15798b8c9107cd4aa556a87eb031263e8b"
}

def get_balance(token_name, token_address):
    data = f"0x70a08231000000000000000000000000{VAULT_ADDRESS[2:]}"
    payload = {"jsonrpc": "2.0", "method": "eth_call", "params": [{"to": token_address, "data": data}, "latest"], "id": 1}
    try:
        r = requests.post(RPC_URL, json=payload).json()
        hex_val = r.get('result', '0x0')
        balance = int(hex_val, 16)
        decimals = 6 if token_name == "USDC" else 18
        return balance / (10**decimals)
    except:
        return 0

print(f"Final Audit: Aetheron Retainer Vault")
print(f"USDC: {get_balance('USDC', TOKENS['USDC']):,.2f}")
print(f"AETX: {get_balance('AETX', TOKENS['AETX']):,.2f}")
