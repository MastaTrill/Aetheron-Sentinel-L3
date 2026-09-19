# Aetheron Sentinel L3

> **Sale status (2026-09-19):** The Base AETH presale missed the 5 ETH soft cap (0.0049 ETH raised). Public pages in this repo must not advertise a live sale, 85% filled, or $4.25M raised. Do not send ETH. See `SALE_STATUS.md`.

Canonical platform status: [MastaTrill/Aetheron_platform PROJECT_STATUS.md](https://github.com/MastaTrill/Aetheron_platform/blob/main/PROJECT_STATUS.md).

GitHub Pages landing is a closed-sale notice (`index.html`), not a buy widget.

## Overview
Aetheron Sentinel L3 is a lightweight FastAPI service that provides security monitoring and threat analysis for blockchain-based applications. It offers endpoints to:

- **Synchronize** data with Supabase (or fallback to a local JSON file)
- **Analyze** prompts and calculate threat scores
- **Interact** with a Copilot-style chat that surfaces recent audit logs
- **Trigger** on-chain actions such as lockdowns, honeypots, and circuit resets

The service now includes:
- **Log rotation** for `audit_log.jsonl` (10 MiB max, 5 backups)
- **Externalized configuration** via a `.env` file (API key, log path, fallback sync path)

## Prerequisites
- Python 3.10+ (recommended via `pyenv` or virtualenv)
- `pip` (or `uv` if preferred)
- Optional: Supabase credentials if you want real DB sync

## Quick Start
1. **Clone the repository**
   ```bash
   git clone https://github.com/MastaTrill/Aetheron-Sentinel-L3.git
   cd Aetheron-Sentinel-L3
   ```
2. **Create a virtual environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```
4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
5. **Run the server**
   ```bash
   uvicorn sentinel.api:router --host 0.0.0.0 --port 8000
   ```

## License
MIT License – see `LICENSE` for details.
