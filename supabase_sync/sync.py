# supabase/sync.py
"""Utility module for synchronizing Sentinel data with Supabase.

Provides a single function `sync_sentinel_data` that upserts a dictionary of
sentinel information into a configured Supabase table.  The Supabase client is
instantiated lazily using environment variables `SUPABASE_URL` and
`SUPABASE_ANON_KEY`.  Errors are logged via `structlog` and re‑raised so that
callers can handle them appropriately.
"""

import os
from typing import Any, Dict
import structlog

# Lazy import to avoid hard dependency if Supabase is not used.
# The function will raise an informative error if the package is missing.

def _get_supabase_client():
    try:
        from supabase import create_client
    except ImportError as exc:
        raise RuntimeError(
            "supabase-py is required for Supabase synchronization. Install it via 'pip install supabase'"
        ) from exc

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set in the environment for Supabase sync."
        )
    return create_client(url, key)


_logger = structlog.get_logger("SupabaseSync")


def sync_sentinel_data(data: Dict[str, Any], table_name: str = "sentinel_data") -> None:
    """Upsert a record into the given Supabase table.

    Parameters
    ----------
    data: dict
        The payload to store.  The dict keys must match column names in the
        Supabase table.
    table_name: str, optional
        Name of the table to upsert into; defaults to ``sentinel_data``.
    Raises
    ------
    RuntimeError
        If the Supabase client cannot be created or the upsert operation fails.
    """
    client = _get_supabase_client()
    try:
        # Supabase upsert: insert if not exists, otherwise update based on primary key.
        res = client.table(table_name).upsert(data).execute()
        
        # Supabase-py version >=2 returns APIResponse, check for errors implicitly or explicitly
        # In v2, .execute() will raise an exception on error in most cases, or return data.
        # So if we reach here without exception, it succeeded.
        _logger.info("Sentinel data synchronized", table=table_name, data=data)
    except Exception as exc:
        _logger.error("Supabase sync error", error=str(exc))
        raise
