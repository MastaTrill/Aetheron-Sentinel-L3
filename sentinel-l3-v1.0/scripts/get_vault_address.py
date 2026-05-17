import requests

# Your verified Supabase Project Info
URL = "https://ybstjqhcmhzcfompdncw.supabase.co/rest/v1/projects"
KEY = "sb_publishable_3v7o5OhtT2_2fBQv5-5zTA_KyxR6Xcj"

def find_vault():
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    try:
        # We query for the Aetheron Sentinel project config
        r = requests.get(f"{URL}?project_ref=eq.jvrstvviazzscmenvgqg", headers=headers)
        if r.status_code == 200 and len(r.json()) > 0:
            config = r.json()[0]
            vault = config.get('retainer_vault_address', 'NOT_FOUND')
            print(f"FOUND: AetheronRetainerVault: {vault}")
        else:
            print(f"FAILED: Could not find config in Supabase. Status: {r.status_code}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    find_vault()
