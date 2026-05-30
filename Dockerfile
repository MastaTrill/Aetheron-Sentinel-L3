FROM node:22-alpine

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