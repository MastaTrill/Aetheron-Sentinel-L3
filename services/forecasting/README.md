# Exploit Forecasting Oracle Integration

This service integrates the LSTM-based exploit forecasting model with the on-chain ExploitForecastOracle contract.

## Setup

1. Install Python dependencies:

```bash
pip install numpy pandas tensorflow scikit-learn web3 eth-account joblib
```

2. Configure the oracle bridge:

```bash
cp config/oracle-config.json.example config/oracle-config.json
# Edit the configuration with your contract addresses and private key
```

3. Train the model (optional, model file included):

```bash
python oracle-bridge.py --train
```

## Configuration

The `config/oracle-config.json` file contains:

- `rpc_url`: Ethereum RPC endpoint
- `oracle_address`: Deployed ExploitForecastOracle contract address
- `private_key`: Private key for submitting transactions
- `chain_id`: Network chain ID
- `model_path`: Path to save/load the trained model
- `forecast_interval_hours`: Hours between forecast cycles
- `min_confidence`: Minimum confidence threshold for submissions

## Running the Service

Start the forecasting oracle bridge:

```bash
python oracle-bridge.py
```

The service will:

1. Train/load the LSTM model
2. Generate 72-hour exploit probability forecasts
3. Submit high-confidence forecasts to the blockchain oracle
4. Repeat every configured interval

## Forecast Data

Each forecast includes:

- `prediction_time`: Unix timestamp when prediction applies
- `exploit_probability`: Probability in basis points (0-10000)
- `avg_cvss`: Average predicted CVSS score × 10
- `confidence`: Model confidence (0-100)

## Integration with Smart Contracts

The forecasts are submitted to the `ExploitForecastOracle` contract, which:

- Stores forecast data on-chain
- Provides risk assessment functions
- Triggers automated responses based on risk levels
- Enables governance decisions based on predicted threats

## Monitoring

Monitor the service logs for:

- Model training progress
- Forecast submission confirmations
- Any transaction failures or retries
- Performance metrics and accuracy
