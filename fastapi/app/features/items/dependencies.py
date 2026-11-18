from datetime import datetime, timezone


def get_timestamp() -> str:
    """Provide the current UTC timestamp for item responses."""
    return datetime.now(timezone.utc).isoformat()
