"""Office Hours API — FastAPI backend.

Run:
    cd backend
    venv/bin/uvicorn app.main:app --reload --port 8000

The frontend connects with VITE_API_URL=http://localhost:8000 and VITE_USE_MOCKS=false.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import AUTO_SEED, CORS_ORIGINS, DATABASE_URL, DEV_JWT_SECRET, JWT_SECRET
from .database import Base, SessionLocal, engine
from .errors import RuleError, status_for
from .routers import auth, bookings, notifications, requests, students, teachers
from . import seed as seed_module


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Zero-config development: create tables and demo data on first run.
    # Production deployments should use `alembic upgrade head` instead.
    Base.metadata.create_all(engine)
    if JWT_SECRET == DEV_JWT_SECRET and not DATABASE_URL.startswith("sqlite"):
        logging.getLogger("uvicorn.error").warning(
            "JWT_SECRET is the development default. Set a long random JWT_SECRET before deploying.")
    if AUTO_SEED:
        db = SessionLocal()
        try:
            from .models import Teacher
            if db.query(Teacher).count() == 0:
                seed_module.seed(db)
        finally:
            db.close()
    yield


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
