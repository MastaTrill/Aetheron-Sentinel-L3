import asyncio
import os
from datetime import UTC, datetime

import aiohttp
from web3 import Web3

# Load configuration
RPC_URL = os.getenv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")

w3 = Web3(Web3.HTTPProvider(RPC_URL))

# Verified Sentinel Contract on Base Sepolia
SENTINEL_INTERCEPTOR_ADDRESS = "0xe483B6c3a9e8478DFB1744553C9A95cfb2bc6a0B"


async def send_discord_alert(title: str, description: str, color: int = 0x00F2FE):
    """Send formatted rich alert embed to Discord webhook."""
    if not DISCORD_WEBHOOK_URL:
        return
    payload = {
        "embeds": [
            {
                "title": f"🛡️ {title}",
                "description": description,
                "color": color,
                "timestamp": datetime.now(UTC).isoformat(),
                "footer": {"text": "Aetheron Sentinel L3 • Threat Sentinel Engine"},
            }
        ]
    }
    async with aiohttp.ClientSession() as session:
        try:
            await session.post(DISCORD_WEBHOOK_URL, json=payload)
        except aiohttp.ClientError as exc:
            print(f"[Alert] Discord broadcast failed: {exc}")


async def send_telegram_alert(message: str):
    """Send alert message to Telegram bot chat."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": f"🛡️ *AETHERON SENTINEL L3 ALERT*\n\n{message}",
        "parse_mode": "Markdown",
    }
    async with aiohttp.ClientSession() as session:
        try:
            await session.post(url, json=payload)
        except aiohttp.ClientError as exc:
            print(f"[Alert] Telegram broadcast failed: {exc}")


async def monitor_network_threats():
    """Continuous background threat monitoring loop."""
    print("==================================================")
    print("🛡️  AETHERON SENTINEL L3 - REAL-TIME THREAT BOT")
    print(f"📡  Connected to: Base Sepolia ({RPC_URL})")
    print(f"🔗  Monitoring Guardrail: {SENTINEL_INTERCEPTOR_ADDRESS}")
    print("==================================================")

    last_block = w3.eth.block_number

    while True:
        try:
            current_block = w3.eth.block_number
            if current_block > last_block:
                for block_num in range(last_block + 1, current_block + 1):
                    block = w3.eth.get_block(block_num, full_transactions=True)
                    for tx in block.transactions:
                        if tx.get("to") and tx["to"].lower() == SENTINEL_INTERCEPTOR_ADDRESS.lower():
                            msg = (
                                "⚡ *Interception Event Detected on Base Sepolia!*\n"
                                f"• Tx: `{tx['hash'].hex()}`\n"
                                f"• From: `{tx['from']}`\n"
                                f"• Block: `{block_num}`"
                            )
                            print(f"[Alert] {msg}")
                            await send_telegram_alert(msg)
                            await send_discord_alert(
                                "Circuit-Breaker Interception", msg, color=0xFF0055
                            )

                last_block = current_block
            await asyncio.sleep(4)
        except Exception as exc:  # noqa: BLE001 - monitoring loop must survive provider failures
            print(f"[Monitor] Error in threat cycle: {exc}")
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(monitor_network_threats())
