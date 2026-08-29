# Aetheron Sentinel L3

## Overview
Aetheron Sentinel L3 is a lightweight FastAPI service that provides security monitoring and threat analysis for blockchain‑based applications. It offers endpoints to:

- **Synchronize** data with Supabase (or fallback to a local JSON file)
- **Analyze** prompts and calculate threat scores
- **Interact** with a Copilot‑style chat that surfaces recent audit logs
- **Trigger** on‑chain actions such as lockdowns, honeypots, and circuit resets

The service now includes:
- **Log rotation** for `audit_log.jsonl` (10 MiB max, 5 backups)
- **Externalized configuration** via a `.env` file (API key, log path, fallback sync path)

## Prerequisites
- Python 3.10+ (recommended via `pyenv` or virtualenv)
- `pip` (or `uv` if preferred)
- Optional: Supabase credentials if you want real DB sync

## Quick Start
1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/Aetheron-Sentinel-L3.git
   cd Aetheron-Sentinel-L3
   ```
2. **Create a virtual environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate   # on Windows: .venv\Scripts\activate
   ```
3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```
4. **Configure environment variables**
   ```bash
   cp .env.example .env   # edit the file as needed
   ```
   The following variables are recognized:
   - `SENTINEL_API_KEY` – API key required for protected endpoints (default: `testkey`)
   - `AUDIT_LOG_PATH` – Path to the audit log file (default: `audit_log.jsonl`)
   - `FALLBACK_SYNC_PATH` – Path for the local fallback sync file (default: `fallback_sync.json`)
5. **Run the server**
   ```bash
   uvicorn sentinel.api:router --host 0.0.0.0 --port 8000
   ```
   The API documentation is available at `http://localhost:8000/docs`.

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sync` | Sync data to Supabase or fallback JSON. Logs the operation. |
| `POST` | `/analyze` | Compute a threat score for a prompt. Triggers an on‑chain lockdown if score ≥ 0.8. |
| `POST` | `/chat` | Simple Copilot chat that can reference recent audit logs. |
| `POST` | `/reset` | Initiates a circuit‑breaker reset via Hardhat script. |
| `POST` | `/honeypot` | Triggers a honeypot script via Hardhat. |
| `GET`  | `/health` | Health check – returns `{"status": "ok"}`. |
| `GET`  | `/logs` | Retrieve the most recent audit log entries (default 50). |

## Configuration Details
- **Environment variables** are loaded with `python‑dotenv`. Modify `.env` to suit your deployment.
- **Logging**: The audit logger rotates automatically. Old logs are kept as `audit_log.jsonl.1`, `.2`, etc.
- **Error handling**: API key validation returns `401`; unexpected server errors return `500` with minimal details to avoid leaking secrets.

## Development
- Run the test suite (if present) with:
  ```bash
  pytest
  ```
- To add new endpoints, follow the existing pattern: implement a Pydantic request model, add the route to `router`, and log actions via `audit_logger`.

## Contributing
1. Fork the repository
2. Create a feature branch
3. Ensure code passes linting (`ruff` or `flake8`) and tests
4. Open a Pull Request with a clear description

## License
MIT License – see `LICENSE` for details.
