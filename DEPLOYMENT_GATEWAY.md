# Sentinel Gateway Deployment Guide

## Requirements

- Python 3.11+
- `fastapi`, `uvicorn`, `pydantic`, `requests` (see requirements.txt)
- Linux/macOS/Windows server

## Quick Start (Development)

```bash
python -m venv .venv
.venv/Scripts/activate  # Windows
source .venv/bin/activate  # Linux/macOS
pip install -r requirements.txt
python sentinel_gateway_prototype.py
```

## Production Deployment

### Option 1: Uvicorn with systemd (Linux)

1. Create a systemd service file `/etc/systemd/system/sentinel-gateway.service`:

   ```ini
   [Unit]
   Description=Sentinel Gateway FastAPI Service
   After=network.target

   [Service]
   User=ubuntu
   WorkingDirectory=/path/to/Aetheron-Sentinel-L3
   ExecStart=/path/to/Aetheron-Sentinel-L3/.venv/bin/uvicorn sentinel_gateway_prototype:app --host 0.0.0.0 --port 8000 --workers 2
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

2. Reload systemd and start:

```bash
   sudo systemctl daemon-reload
   sudo systemctl enable sentinel-gateway
   sudo systemctl start sentinel-gateway
```

### Option 2: Docker

1. Create a `Dockerfile`:

```Dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   COPY . .
   RUN pip install fastapi uvicorn pydantic requests
   EXPOSE 8000
   CMD ["uvicorn", "sentinel_gateway_prototype:app", "--host", "0.0.0.0", "--port", "8000"]

```

2. Build and run:

```bash
   docker build -t sentinel-gateway .
   docker run -d -p 8000:8000 --name gateway sentinel-gateway

```

### Option 3: Gunicorn (for async workers)

```bash
.venv/bin/gunicorn -w 2 -k uvicorn.workers.UvicornWorker sentinel_gateway_prototype:app
```

## Security

- Change the API key in code/config before production
- Use HTTPS (behind a reverse proxy like Nginx or Caddy)
- Monitor logs and webhook alerts
- Set up firewall rules to restrict access

---
