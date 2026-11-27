"""Password hashing and JWT helpers for the authentication API."""
import base64
import binascii
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import jwt

from .config import JWT_EXPIRE_MINUTES, JWT_SECRET


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return "scrypt$%s$%s" % (
        base64.urlsafe_b64encode(salt).decode(),
        base64.urlsafe_b64encode(digest).decode(),
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, salt_text, digest_text = encoded.split("$")
        if scheme != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(digest_text.encode())
        actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    except (ValueError, TypeError, binascii.Error):
        return False
    return hmac.compare_digest(actual, expected)


# A real scrypt hash of a random password nobody knows. Sign-in checks the password against it when there is no account
# (or one without a password yet), so every sign-in costs the same and the response time doesn't reveal who has an account.
DUMMY_PASSWORD_HASH = hash_password(base64.urlsafe_b64encode(os.urandom(24)).decode())


def create_access_token(user_id: str, role: str, version: int = 0, signed_in_at: Optional[int] = None) -> str:
    """A sign-in token. `ver` is the person's session number (bumped on log out, so old tokens stop working);
    `auth` is when they signed in (epoch seconds), kept across refreshes so a session can't last forever."""
    now = datetime.now(timezone.utc)
    claims = {
        "sub": user_id,
        "role": role,
        "ver": version,
        "auth": signed_in_at if signed_in_at is not None else int(now.timestamp()),
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(claims, JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> Dict[str, str]:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
