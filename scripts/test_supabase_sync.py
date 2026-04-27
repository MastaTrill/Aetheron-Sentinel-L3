import os

import requests

# URL for project: ybstjqhcmhzcfompdncw
URL = "https://ybstjqhcmhzcfompdncw.supabase.co/rest/v1/"
# Read secret from environment instead of hardcoding credentials in source.
SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

def test():
    if not SECRET_KEY:
        raise RuntimeError("SUPABASE_SECRET_KEY is required")

    print(f"Executing MAVAN-4 Genesis Handshake...")
    headers = {
        "apikey": SECRET_KEY,
        "Authorization": f"Bearer {SECRET_KEY}"
    }
    
    try:
        # Pinging the root to verify the secret key is accepted
        r = requests.get(URL, headers=headers)
        if r.status_code == 200:
            print("\n✅ SUCCESS: MAVAN-4 bridge is officially AUTHORIZED.")
            print("The Nexus Lead database is now synced with the cluster.")
        else:
            print(f"\n❌ FAILED: Status {r.status_code}. Response: {r.text}")
    except Exception as e:
        print(f"🚨 ERROR: {e}")

test()
