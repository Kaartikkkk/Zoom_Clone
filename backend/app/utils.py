import os
import random
import string

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://frontend-sable-rho-u2nzn8l17o.vercel.app").rstrip("/")


def generate_meeting_id() -> str:
    """Generate a Zoom-format meeting ID: XXX-XXXX-XXXX"""
    part1 = ''.join(random.choices(string.digits, k=3))
    part2 = ''.join(random.choices(string.digits, k=4))
    part3 = ''.join(random.choices(string.digits, k=4))
    return f"{part1}-{part2}-{part3}"


def generate_invite_link(meeting_id: str) -> str:
    """Generate absolute shareable invite link for a meeting."""
    clean_id = meeting_id.replace("-", "")
    return f"{FRONTEND_URL}/meeting/{clean_id}"


