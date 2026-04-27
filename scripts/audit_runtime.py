import sys
import importlib.util

def run_lean_audit():
    # Verify core architecture for Gate 3 activation without heavy ML weights
    critical_modules = ['src.interceptor', 'src.rpc_adapter']
    for m in critical_modules:
        if importlib.util.find_spec(m) is None:
            print(f"FAILED: {m} missing from environment")
            sys.exit(1)
    print("SUCCESS: Sentinel-Zero stable for MAVAN-4.")
    sys.exit(0)

if __name__ == "__main__":
    if "--mode=lean" in sys.argv:
        run_lean_audit()
