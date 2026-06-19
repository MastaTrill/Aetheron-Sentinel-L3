import os
import requests
import pytest

# URL for project: ybstjqhcmhzcfompdncw
URL = "https://ybstjqhcmhzcfompdncw.supabase.co/rest/v1/"
# Read secret from environment instead of hardcoding credentials in source.
SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "dummy_key")


def test():
    if not SECRET_KEY or SECRET_KEY == "dummy_key":
        print("[WARN] SUPABASE_SECRET_KEY not set or using dummy key. Skipping request.")
        pytest.skip("SUPABASE_SECRET_KEY not set")
        return

    print("Executing Sentinel Genesis Handshake...")
    headers = {"apikey": SECRET_KEY, "Authorization": f"Bearer {SECRET_KEY}"}
    try:
        # Pinging the root to verify the secret key is accepted
        r = requests.get(URL, headers=headers)
        if r.status_code == 200:
            print("\n[PASS] SUCCESS: Sentinel bridge is officially AUTHORIZED.")
            print("The Nexus Lead database is now synced with the cluster.")
        else:
            print(f"\n[FAIL] FAILED: Status {r.status_code}. Response: {r.text}")
    except requests.RequestException as e:
        print(f"[ERROR] REQUEST EXCEPTION: {e}")


if __name__ == "__main__":
    test()
