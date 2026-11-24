"""Rate limits on sign-in, password links and forgot password, so passwords and links can't be guessed and nobody can
flood someone's inbox. Attempts are rows in auth_attempts (not memory, which Vercel doesn't keep between requests).

    ratelimit.check(db, "login-email", email)    # raises RuleError("too_many") -> 429 when over the limit
    ratelimit.record(db, "login-email", email)   # after a failed attempt
"""
from datetime import timedelta

from fastapi import Request
from sqlalchemy.orm import Session

from . import config
from .accounts import utcnow
from .errors import RuleError
from .models import AuthAttempt

# kind -> (most attempts allowed, within this many minutes)
# The "-ip" limits are per public address, and a whole school shares one, so they are generous and only slow down
# someone trying many accounts. They never stop a correct password (see routers/auth.py login).
LIMITS = {
    "login-email": (10, 15),   # wrong passwords for one account: the real protection against guessing
    "login-ip": (100, 15),     # wrong passwords from one address (a school): only wrong ones are turned away
    "forgot-email": (3, 60),   # reset emails to one address
    "forgot-ip": (100, 60),    # reset requests from one address (a school)
    "link-ip": (60, 15),       # unusable activation/reset links from one address (a school)
}
KEEP_HOURS = 24


def client_ip(request: Request) -> str:
    if config.CLIENT_IP_HEADER:
        forwarded = request.headers.get(config.CLIENT_IP_HEADER, "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _bucket(kind: str, key: str) -> str:
    return ("%s:%s" % (kind, key.strip().lower()))[:200]


def check(db: Session, kind: str, key: str) -> None:
    limit, minutes = LIMITS[kind]
    since = utcnow() - timedelta(minutes=minutes)
    count = (db.query(AuthAttempt)
             .filter(AuthAttempt.bucket == _bucket(kind, key), AuthAttempt.at >= since)
             .count())
    if count >= limit:
        raise RuleError("too_many", "Too many tries. Wait a few minutes and try again.")


def record(db: Session, kind: str, key: str) -> None:
    db.add(AuthAttempt(bucket=_bucket(kind, key), at=utcnow()))
    db.commit()


def cleanup(db: Session) -> int:
    """Deletes attempts older than a day. The reminder job calls it."""
    removed = db.query(AuthAttempt).filter(AuthAttempt.at < utcnow() - timedelta(hours=KEEP_HOURS)).delete()
    db.commit()
    return removed
