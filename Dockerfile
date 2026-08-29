FROM python:3.12-slim AS builder
# Install build dependencies
RUN apt-get update && apt-get install -y build-essential gcc && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Runtime stage
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /app /app

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "sentinel.main:app", "--host", "0.0.0.0", "--port", "8000"]

WORKDIR /app

# Install curl for health monitoring
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Ensure entrypoint is executable
RUN chmod +x /app/entrypoint.sh

# Prevent accidental .env leakage
RUN rm -f .env

# Monitor health and benchmark metrics in real-time
# Fails if the health endpoint is unreachable or returns a stalled status
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3005/health | grep '"status":"active"' || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npx", "hardhat", "deploy-sentinel", "--network", "sepolia"]