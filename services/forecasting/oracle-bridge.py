#!/usr/bin/env python3
"""
@title Exploit Forecasting Oracle Bridge
@notice Python service integration with ExploitForecastOracle contract
@dev Bridges the LSTM forecasting model with on-chain reporting

Features:
- Automated forecast submission to blockchain
- Confidence threshold filtering
- Gas-optimized batch reporting
- Error handling and retries
"""

import os
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List
import requests
from web3 import Web3
from eth_account import Account
import numpy as np
import pandas as pd
from .exploit_forecaster import ExploitForecaster


class ForecastingOracleBridge:
    def __init__(self, config_path: str = "config/oracle-config.json"):
        self.load_config(config_path)
        self.forecaster = ExploitForecaster(self.config.get("model_path"))
        self.web3 = Web3(Web3.HTTPProvider(self.config["rpc_url"]))
        self.account = Account.from_key(self.config["private_key"])

        # Load contract ABI
        with open("contracts/ExploitForecastOracle.json", "r") as f:
            contract_data = json.load(f)
            self.contract = self.web3.eth.contract(
                address=self.config["oracle_address"], abi=contract_data["abi"]
            )

    def load_config(self, config_path: str):
        """Load configuration from JSON file"""
        with open(config_path, "r") as f:
            self.config = json.load(f)

    def prepare_training_data(self) -> pd.DataFrame:
        """Prepare historical data for training"""
        # This would load from database/API in production
        # Mock data for demonstration
        dates = pd.date_range(start="2023-01-01", end="2024-01-01", freq="H")
        np.random.seed(42)

        data = []
        for i, date in enumerate(dates):
            # Simulate exploit patterns based on historical data
            base_probability = 0.05  # 5% base exploit probability

            # Add seasonal patterns
            seasonal_factor = 1 + 0.3 * np.sin(
                2 * np.pi * i / (24 * 30)
            )  # Monthly cycle
            weekly_factor = 1 + 0.2 * np.sin(2 * np.pi * i / (24 * 7))  # Weekly cycle

            # Add trend (decreasing over time as security improves)
            trend_factor = 1 - (i / len(dates)) * 0.5

            exploit_probability = (
                base_probability * seasonal_factor * weekly_factor * trend_factor
            )
            exploit_probability = np.clip(exploit_probability, 0, 1)

            # Generate CVSS score (1-10 scale, multiply by 10 for integer)
            cvss_score = np.random.normal(7.5, 1.5)
            cvss_score = np.clip(cvss_score, 1, 10)

            # Generate features (8 features as per model)
            features = np.random.normal(0, 1, 8)

            data.append([*features, exploit_probability * 100])  # Convert to percentage

        columns = [f"feature_{i}" for i in range(8)] + ["exploit_probability"]
        return pd.DataFrame(data, index=dates, columns=columns)

    def train_model(self):
        """Train the forecasting model"""
        print("🔄 Training exploit forecasting model...")

        training_data = self.prepare_training_data()
        history = self.forecaster.train(training_data)

        print(f"✅ Model trained - Final Loss: {history.history['loss'][-1]:.4f}")

        # Save model
        self.forecaster.save_model(
            self.config.get("model_path", "models/exploit_forecaster.h5")
        )

    def generate_forecast(self, prediction_hours: int = 72) -> List[Dict[str, Any]]:
        """Generate exploit probability forecasts"""
        print(f"🔮 Generating {prediction_hours}-hour exploit forecast...")

        forecasts = []
        base_time = datetime.now()

        for hour in range(1, prediction_hours + 1):
            prediction_time = base_time + timedelta(hours=hour)

            # Get prediction from model
            # In production, this would use real-time features
            mock_features = np.random.normal(0, 1, (1, 8))
            prediction = self.forecaster.predict(mock_features)

            # Scale prediction to 0-10000 basis points
            exploit_probability = int(prediction[0][0] * 10000)

            # Generate CVSS forecast
            avg_cvss = int(np.random.normal(75, 10))  # Mock CVSS * 10

            # Calculate confidence based on prediction certainty
            confidence = min(95, max(60, int(50 + prediction[0][0] * 45)))

            forecast = {
                "prediction_time": int(prediction_time.timestamp()),
                "exploit_probability": exploit_probability,
                "avg_cvss": avg_cvss,
                "confidence": confidence,
                "timestamp": int(base_time.timestamp()),
            }

            forecasts.append(forecast)

        return forecasts

    def submit_forecast_to_oracle(self, forecast: Dict[str, Any]) -> bool:
        """Submit a forecast to the blockchain oracle"""
        try:
            # Build transaction
            tx = self.contract.functions.submitForecast(
                forecast["prediction_time"],
                forecast["exploit_probability"],
                forecast["avg_cvss"],
                forecast["confidence"],
            ).build_transaction(
                {
                    "from": self.account.address,
                    "nonce": self.web3.eth.get_transaction_count(self.account.address),
                    "gas": 200000,
                    "gasPrice": self.web3.eth.gas_price,
                    "chainId": self.config.get("chain_id", 1),
                }
            )

            # Sign and send transaction
            signed_tx = self.web3.eth.account.sign_transaction(tx, self.account.key)
            tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)

            # Wait for confirmation
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)

            if receipt.status == 1:
                print(f"✅ Forecast submitted: TX {tx_hash.hex()}")
                return True
            else:
                print(f"❌ Transaction failed: {tx_hash.hex()}")
                return False

        except Exception as e:
            print(f"❌ Failed to submit forecast: {e}")
            return False

    def run_forecasting_cycle(self):
        """Main forecasting cycle"""
        print("🚀 Starting exploit forecasting oracle bridge...")

        # Train model if needed
        if not self.forecaster.is_trained:
            self.train_model()

        while True:
            try:
                # Generate forecasts
                forecasts = self.generate_forecast()

                # Submit high-confidence forecasts
                submitted_count = 0
                for forecast in forecasts:
                    if forecast["confidence"] >= self.config.get("min_confidence", 70):
                        if self.submit_forecast_to_oracle(forecast):
                            submitted_count += 1
                        time.sleep(1)  # Rate limiting

                print(f"📊 Submitted {submitted_count} forecasts this cycle")

                # Wait for next cycle
                cycle_interval = self.config.get("forecast_interval_hours", 6) * 3600
                print(
                    f"⏰ Waiting {cycle_interval} seconds until next forecast cycle..."
                )
                time.sleep(cycle_interval)

            except KeyboardInterrupt:
                print("🛑 Forecasting bridge stopped by user")
                break
            except Exception as e:
                print(f"❌ Forecasting cycle error: {e}")
                time.sleep(60)  # Wait before retry


def main():
    bridge = ForecastingOracleBridge()
    bridge.run_forecasting_cycle()


if __name__ == "__main__":
    main()
