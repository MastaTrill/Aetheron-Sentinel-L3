# sentinel/utils.py
"""Utility functions for Sentinel gateway.
Provides prompt normalization, threat scoring, and a lightweight LLM classifier simulation.
All functions are pure and easily unit-tested.
"""

import os
import re
import unicodedata


def normalize_prompt(prompt: str) -> str:
    """Normalize Unicode, strip non-ASCII characters, and uppercase the prompt.

    Uses NFKD decomposition to convert accented characters to their ASCII equivalents.
    """
    prompt = prompt.replace("\ufffd", "E")
    norm = unicodedata.normalize("NFKD", prompt)
    ascii_str = norm.encode("ascii", "ignore").decode("ascii")
    return ascii_str.upper()


def _llm_classify_intent(prompt: str) -> tuple[float, str | None]:
    """Return a simulated LLM threat score and optional reason."""
    semantic_patterns = ["ACT AS", "SYSTEM PROMPT", "OVERRIDE RULES"]
    for pattern in semantic_patterns:
        if pattern in prompt:
            return 0.4, f"Semantic probing detected: {pattern}"
    return 0.0, None


def calculate_threat_score(prompt: str) -> tuple[float, list[str]]:
    """Calculate a threat score based on heuristics."""
    if len(prompt) > 5000:
        return 1.0, ["Prompt exceeds maximum length"]
    norm = normalize_prompt(prompt)
    score = 0.0
    reasons: list[str] = []

    blacklist = ["IGNORE ALL PRIOR INSTRUCTIONS", "DEVELOPER MODE", "ADMIN_BYPASS"]
    for trigger in blacklist:
        if trigger in norm:
            score += 0.5
            reasons.append(f"Trigger: {trigger}")

    if os.getenv("SUPABASE_SECRET_KEY", "dummy_key") in norm or "WITHDRAW_ALL" in norm:
        score += 0.4
        reasons.append("Sensitive action: PRIVATE_KEY/WITHDRAW_ALL")

    if re.search(r"1GN0RE|1NSTRUCT10NS|ADM1N", norm):
        score += 0.3
        reasons.append("Obfuscation/Leetspeak detected")

    if ";" in norm or "&&" in norm:
        score += 0.2
        reasons.append("Command chaining detected")

    if re.search(r"\s{5,}", norm):
        score += 0.1
        reasons.append("Excessive whitespace detected")

    if any(p in norm for p in ["FLASHLOAN", "FLASH_LOAN", "BORROW_LARGE"]) and any(
        p in norm for p in ["ARBITRAGE", "REPAY", "PRICE_MANIPULATION"]
    ):
        score += 0.4
        reasons.append("Flash loan exploitation footprints detected")

    if any(
        p in norm
        for p in ["REENTRANCY", "RE-ENTRANCY", "MSG.SENDER.CALL", "FALLBACK_REENTRY"]
    ):
        score += 0.4
        reasons.append("Reentrancy vector footprints detected")

    if any(
        p in norm for p in ["FRONTRUN", "FRONT_RUN", "BACKRUN", "BACK_RUN", "SANDWICH_ATTACK"]
    ):
        score += 0.35
        reasons.append("MEV/Sandwich attack footprints detected")

    if any(
        p in norm
        for p in ["MANIPULATE_PRICE", "SKEW_RESERVES", "ORACLE_SKEW", "SPOT_PRICE_MANIPULATION"]
    ):
        score += 0.45
        reasons.append("Oracle price manipulation footprints detected")

    llm_score, llm_reason = _llm_classify_intent(norm)
    if llm_reason:
        score += llm_score
        reasons.append(f"LLM Detection: {llm_reason}")
    return score, reasons
