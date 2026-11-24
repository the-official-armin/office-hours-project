"""Office Hours API — FastAPI backend.

Run:
    cd backend
    venv/bin/uvicorn app.main:app --reload --port 8000

The frontend connects with VITE_API_URL=http://localhost:8000 and VITE_USE_MOCKS=false.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import config
from .config import CORS_ORIGINS, REMINDER_INTERVAL_MINUTES
from .database import Base, SessionLocal, engine
from .errors import RuleError, status_for
from .routers import auth, bookings, jobs, notifications, requests, students, teachers
from . import seed as seed_module


# The app's own messages (sent, skipped and failed emails) in the server log next to uvicorn's.
_app_log = logging.getLogger("office_hours")
if not _app_log.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     %(message)s"))
    _app_log.addHandler(_handler)
    _app_log.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # A real database with development defaults is a deployment mistake: stop here, before touching the database.
    problems = config.unsafe_for_production()
    if problems:
        raise RuntimeError("Refusing to start: " + " ".join(problems) + " (Local Postgres with demo data: APP_ENV=development.)")
    # Zero-config development: create tables and demo data on first run.
    # Production deployments should use `alembic upgrade head` instead.
    Base.metadata.create_all(engine)
    if config.AUTO_SEED:
        db = SessionLocal()
        try:
            from .models import Teacher
            if db.query(Teacher).count() == 0:
                seed_module.seed(db)
        finally:
            db.close()
    loop = asyncio.create_task(_reminder_loop()) if REMINDER_INTERVAL_MINUTES > 0 else None
    yield
    if loop:
        loop.cancel()


async def _reminder_loop() -> None:
    """Locally there is no outside timer: run the reminders every REMINDER_INTERVAL_MINUTES inside the server."""
    from . import reminders

    while True:
        try:
            await run_in_threadpool(reminders.run_once)
        except Exception:  # keep the loop alive; the next run tries again
            _app_log.exception("Reminder run failed")
        await asyncio.sleep(REMINDER_INTERVAL_MINUTES * 60)


app = FastAPI(title="Office Hours API", lifespan=lifespan)

# The token travels in the Authorization header (no cookies), so credentials stay off.
# CORS_ORIGINS lists the deployed site(s); without it any localhost port may call the API (development).
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=None if CORS_ORIGINS else r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RuleError)
async def rule_error_handler(request: Request, exc: RuleError):
    return JSONResponse(
        status_code=status_for(exc.code),
        content={"code": exc.code, "message": exc.message},
    )


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


app.include_router(teachers.router)
app.include_router(students.router)
app.include_router(bookings.router)
app.include_router(requests.router)
app.include_router(notifications.router)
app.include_router(auth.router)
app.include_router(jobs.router)
