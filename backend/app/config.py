"""Runtime settings, all overridable through environment variables (see .env.example)."""
import os

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
