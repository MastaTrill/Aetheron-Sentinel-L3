import requests

RPC_URL = "https://mainnet.base.org"
# The 15% Holder (Operations/Liquidity)
OPS_ADDRESS = "0x2748888b584067e98a39a0447384a3059883c442"
USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

def check():
    data = f"0x70a08231000000000000000000000000{OPS_ADDRESS[2:]}"
    payload = {"jsonrpc": "2.0", "method": "eth_call", "params": [{"to": USDC_TOKEN, "data": data}, "latest"], "id": 1}
    r = requests.post(RPC_URL, json=payload).json()
    balance = int(r.get('result', '0x0'), 16) / 1e6
    print(f"Operations Wallet (0x2748...) USDC Balance: ${balance:,.2f}")

check()
