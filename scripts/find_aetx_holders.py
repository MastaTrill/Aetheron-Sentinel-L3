import requests

# RPC: Base Mainnet
RPC_URL = "https://mainnet.base.org"
AETX_TOKEN = "0xfe0c0b15798b8c9107cd4aa556a87eb031263e8b"

def get_holders():
    # This is a bit complex for a raw RPC call, but we can look for
    # addresses that received the initial minting of tokens.
    print(f"Scanning AETX Token Genesis...")
    
    # We query for Transfer events from address(0)
    # Transfer(address,address,uint256) topic: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
    payload = {
        "jsonrpc": "2.0", "method": "eth_getLogs",
        "params": [{
            "fromBlock": "0x0",
            "toBlock": "latest",
            "address": AETX_TOKEN,
            "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0x0000000000000000000000000000000000000000000000000000000000000000"]
        }],
        "id": 1
    }
    
    try:
        r = requests.post(RPC_URL, json=payload).json()
        logs = r.get('result', [])
        holders = set()
        for log in logs:
            # The 'to' address is the second topic (index 2)
            if len(log['topics']) > 2:
                addr = "0x" + log['topics'][2][-40:]
                holders.add(addr)
        
        print(f"Potential Vaults (Genesis Recipients):")
        for h in holders:
            # Skip the zero address and the known creator
            if h != "0x0000000000000000000000000000000000000000":
                print(f" -> {h}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    get_holders()
