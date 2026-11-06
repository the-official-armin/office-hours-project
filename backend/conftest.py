"""Pytest setup: fresh SQLite database per test with the demo seed.

Runs from the backend folder:
    cd backend && venv/bin/python -m pytest tests -q
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ["DATABASE_URL"] = "sqlite://"  # in-memory, shared via StaticPool
os.environ["AUTO_SEED"] = "false"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.seed import seed
from app.security import create_access_token


@pytest.fixture()
def db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    session = SessionLocal()
    seed(session)
    try:
        yield session
    finally:
        session.close()


def _bearer(user_id: str, role: str) -> dict:
    return {"Authorization": "Bearer " + create_access_token(user_id, role)}


@pytest.fixture()
def client(db):
    """Not signed in."""
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def student(db):
    """Signed in as the demo student Maya."""
    with TestClient(app, headers=_bearer("maya", "student")) as c:
        yield c


@pytest.fixture()
def teacher(db):
    """Signed in as the demo teacher Ms. Rivera."""
    with TestClient(app, headers=_bearer("rivera", "teacher")) as c:
        yield c


@pytest.fixture()
def signed_in(db):
    """Returns a client signed in as anyone: signed_in("daniel", "student")."""
    clients = []

    def make(user_id: str, role: str) -> TestClient:
        c = TestClient(app, headers=_bearer(user_id, role))
        clients.append(c)
        return c

    yield make
    for c in clients:
        c.close()
