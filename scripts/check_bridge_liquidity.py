import requests
import sys

# Force UTF-8 for MINGW64
if sys.stdout.encoding != "utf-8":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

RPC_URL = "https://mainnet.base.org"
BRIDGE_ADDRESS = "0x072091f554df794852e0a9d1c809f2b2bbda171e"

# Token Addresses on Base
TOKENS = {
    "USDC": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "AETX": "0xfe0c0b15798b8c9107cd4aa556a87eb031263e8b",
}


def get_erc20_balance(token_name, token_address):
    # balanceOf(address) selector is 0x70a08231
    data = f"0x70a08231000000000000000000000000{BRIDGE_ADDRESS[2:]}"
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_call",
        "params": [{"to": token_address, "data": data}, "latest"],
        "id": 1,
    }
    try:
        response = requests.post(RPC_URL, json=payload).json()
        hex_val = response.get("result", "0x0")
        balance = int(hex_val, 16)

        # Adjust decimals (USDC is 6, AETX is 18)
        decimals = 6 if token_name == "USDC" else 18
        final_balance = balance / (10**decimals)
        print(f"SUCCESS: {token_name} Balance: {final_balance:,.2f}")
        return final_balance
    except:
        return 0


print(f"Auditing Bridge Liquidity Gate: {BRIDGE_ADDRESS}")
usdc_bal = get_erc20_balance("USDC", TOKENS["USDC"])
aetx_bal = get_erc20_balance("AETX", TOKENS["AETX"])

if usdc_bal > 0 or aetx_bal > 0:
    print("\nSTATUS: LIQUIDITY DETECTED. Bridge is solvent.")
else:
    print("\nSTATUS: CRITICAL - No liquidity found. Check RetainerVault.")
