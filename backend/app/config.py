"""Runtime settings, all overridable through environment variables (see .env.example)."""
import os
from pathlib import Path


def _load_env_file(path: Path) -> None:
    """Reads backend/.env (KEY=value lines) so the server, alembic and scripts all see the same settings.
    Real environment variables win, so hosts and tests can override anything."""
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


_load_env_file(Path(__file__).resolve().parent.parent / ".env")

# SQLite file for local development; switch to the docker-compose Postgres in production:
#   DATABASE_URL=postgresql://postgres:<password>@localhost:5432/office_hours_db
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./office_hours.db")
# Some hosts hand out "postgres://" URLs, which SQLAlchemy no longer accepts.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]

# Seed the demo dataset on startup when the database is empty. Set to false when deployed.
AUTO_SEED = os.environ.get("AUTO_SEED", "true").lower() != "false"

# JWT settings. Set a long random value in deployed environments.
DEV_JWT_SECRET = "change-this-development-secret"
JWT_SECRET = os.environ.get("JWT_SECRET", DEV_JWT_SECRET)
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "60"))

# The school's time zone, e.g. "America/Los_Angeles". Every "is it in the past?" rule uses it.
# Empty means the server's own clock, which is fine locally but UTC on most hosts.
SCHOOL_TZ = os.environ.get("SCHOOL_TZ", "")

# Browser origins allowed to call the API, comma-separated (e.g. "https://office-hours.vercel.app").
# Empty means any localhost port, for development.
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

# Email through Postmark (https://postmarkapp.com). Empty POSTMARK_TOKEN writes emails to the log instead of sending them.
POSTMARK_TOKEN = os.environ.get("POSTMARK_TOKEN", "").strip()
# The sender. Must be a confirmed Sender Signature (or on a verified domain) in Postmark.
EMAIL_FROM = os.environ.get("EMAIL_FROM", "").strip()
# Where the frontend lives, for links in emails (activation, settings).
APP_URL = os.environ.get("APP_URL", "http://localhost:5173").rstrip("/")

# Reminder emails (app/reminders.py). Deployed: a timer calls GET /jobs/reminders with "Authorization: Bearer <CRON_SECRET>"
# (Vercel Cron sends exactly that header when CRON_SECRET is set). Empty CRON_SECRET turns the endpoint off.
CRON_SECRET = os.environ.get("CRON_SECRET", "").strip()
# Locally (or on a host that keeps the server running): run the reminders every N minutes inside the backend. 0 = off.
REMINDER_INTERVAL_MINUTES = int(os.environ.get("REMINDER_INTERVAL_MINUTES", "0") or 0)

# Sessions: a sign-in token lasts JWT_EXPIRE_MINUTES and the app swaps it for a fresh one while it's being used
# (POST /auth/refresh), up to SESSION_MAX_DAYS after the person signed in. Then they sign in again.
SESSION_MAX_DAYS = int(os.environ.get("SESSION_MAX_DAYS", "7") or 7)
# Rate limits count attempts per computer by IP address. Behind a proxy every request seems to come from the proxy, so name
# the header that carries the visitor's address: "x-real-ip" on Vercel. Empty = the direct connection (local).
CLIENT_IP_HEADER = os.environ.get("CLIENT_IP_HEADER", "").strip().lower()
