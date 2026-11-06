"""Runtime settings, all overridable through environment variables."""
import os

# SQLite file for local development; switch to the docker-compose Postgres in production:
#   DATABASE_URL=postgresql://postgres:secretpassword@localhost:5432/office_hours_db
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./office_hours.db")

# The signed-in people until real JWT auth lands (frontend demo accounts).
ME_TEACHER_ID = os.environ.get("ME_TEACHER_ID", "rivera")
ME_STUDENT_ID = os.environ.get("ME_STUDENT_ID", "maya")

# Seed the demo dataset on startup when the database is empty.
AUTO_SEED = os.environ.get("AUTO_SEED", "true").lower() != "false"

# JWT settings. Set a long random value in deployed environments.
JWT_SECRET = os.environ.get("JWT_SECRET", "change-this-development-secret")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "60"))
