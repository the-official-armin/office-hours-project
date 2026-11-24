"""Step 7: rate limits on sign-in / links / forgot password, real log out, ending sessions on a new password, and refresh."""
import re
import time
from datetime import timedelta

import jwt
import pytest

from app import accounts, config, mailer, ratelimit
from app.models import AuthAttempt
from app.security import create_access_token

GOOD = {"email": "maya@example.com", "password": "demo-password"}


def login(client, email="maya@example.com", password="demo-password", headers=None):
    return client.post("/auth/login", json={"email": email, "password": password}, headers=headers or {})


def bearer(token):
    return {"Authorization": "Bearer " + token}


@pytest.fixture()
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(mailer, "send_email", lambda m: sent.append(m) or True)
    monkeypatch.setattr(config, "APP_URL", "http://app.test")
    return sent


# ------------------------------------------------------------------------------------------------ rate limits

def test_ten_wrong_passwords_lock_that_email_for_a_while(client):
    for _ in range(10):
        assert login(client, password="wrong").status_code == 401
    res = login(client)  # even the right password now waits
    assert res.status_code == 429 and res.json()["code"] == "too_many"
    # Other people are not locked out by it.
    assert login(client, email="daniel@example.com").status_code == 200


def test_the_lock_lifts_after_fifteen_minutes(client, db):
    for _ in range(10):
        login(client, password="wrong")
    for a in db.query(AuthAttempt):
        a.at -= timedelta(minutes=16)
    db.commit()
    assert login(client).status_code == 200


def test_one_computer_trying_many_emails_is_limited(client):
    for i in range(30):
        login(client, email="guess%d@example.com" % i, password="wrong")
    assert login(client, email="daniel@example.com").status_code == 429


def test_the_visitors_address_comes_from_the_proxy_header_when_set(client, monkeypatch):
    monkeypatch.setattr(config, "CLIENT_IP_HEADER", "x-real-ip")
    for i in range(30):
        login(client, email="guess%d@example.com" % i, password="wrong", headers={"X-Real-IP": "203.0.113.9"})
    assert login(client, email="daniel@example.com", headers={"X-Real-IP": "203.0.113.9"}).status_code == 429
    assert login(client, email="daniel@example.com", headers={"X-Real-IP": "198.51.100.7"}).status_code == 200


def test_forgot_password_sends_at_most_three_emails_an_hour(client, outbox):
    for _ in range(3):
        assert client.post("/auth/forgot-password", json={"email": "maya@example.com"}).status_code == 204
    res = client.post("/auth/forgot-password", json={"email": "maya@example.com"})
    assert res.status_code == 429
    assert len(outbox) == 3


def test_guessing_links_is_limited(client):
    for i in range(20):
        assert client.get("/auth/link/guess-%d" % i).status_code == 410
    assert client.get("/auth/link/guess-x").status_code == 429
    assert client.post("/auth/set-password", json={"token": "x", "password": "a good long password"}).status_code == 429


def test_old_attempts_are_cleaned_up(client, db):
    login(client, password="wrong")
    for a in db.query(AuthAttempt):
        a.at -= timedelta(hours=25)
    db.commit()
    assert ratelimit.cleanup(db) == 2  # the email row and the computer row
    assert db.query(AuthAttempt).count() == 0


# ------------------------------------------------------------------------------------------------ sessions

def test_log_out_ends_the_session_on_every_device(client):
    phone, laptop = login(client).json()["accessToken"], login(client).json()["accessToken"]
    assert client.get("/auth/me", headers=bearer(phone)).status_code == 200
    assert client.post("/auth/logout", headers=bearer(phone)).status_code == 204
    assert client.get("/auth/me", headers=bearer(phone)).status_code == 401
    assert client.get("/auth/me", headers=bearer(laptop)).status_code == 401
    assert client.get("/auth/me", headers=bearer(login(client).json()["accessToken"])).status_code == 200


def test_a_new_password_signs_out_other_devices(client, outbox):
    old = login(client).json()["accessToken"]
    client.post("/auth/forgot-password", json={"email": "maya@example.com"})
    token = re.search(r"token=([\w-]+)", outbox[0].text).group(1)
    new = client.post("/auth/set-password", json={"token": token, "password": "a good long password"}).json()["accessToken"]
    assert client.get("/auth/me", headers=bearer(old)).status_code == 401
    assert client.get("/auth/me", headers=bearer(new)).status_code == 200


def test_deactivating_ends_sessions_and_reactivating_does_not_bring_them_back(client, db):
    token = login(client).json()["accessToken"]
    accounts.set_status(db, "maya@example.com", "deactivated")
    accounts.set_status(db, "maya@example.com", "active")
    assert client.get("/auth/me", headers=bearer(token)).status_code == 401


def test_refresh_gives_a_fresh_token_for_the_same_sign_in(client):
    first = login(client).json()["accessToken"]
    signed_in = jwt.decode(first, options={"verify_signature": False})["auth"]
    res = client.post("/auth/refresh", headers=bearer(first))
    assert res.status_code == 200
    second = res.json()["accessToken"]
    assert res.json()["user"]["id"] == "maya" and res.json()["expiresIn"] == 3600
    assert jwt.decode(second, options={"verify_signature": False})["auth"] == signed_in
    assert client.get("/auth/me", headers=bearer(second)).status_code == 200


def test_refresh_stops_seven_days_after_signing_in(client):
    week_old = create_access_token("maya", "student", 0, signed_in_at=int(time.time()) - 8 * 24 * 3600)
    assert client.get("/auth/me", headers=bearer(week_old)).status_code == 200  # still valid for its hour
    assert client.post("/auth/refresh", headers=bearer(week_old)).status_code == 401


def test_refresh_needs_a_valid_session(client):
    token = login(client).json()["accessToken"]
    client.post("/auth/logout", headers=bearer(token))
    assert client.post("/auth/refresh", headers=bearer(token)).status_code == 401
    assert client.post("/auth/refresh").status_code == 401


# ------------------------------------------------------------------------------------------------ unsafe production settings

@pytest.fixture()
def real_database(monkeypatch):
    """Settings as on a deployed server: Postgres, production, safe values. Each test then breaks one."""
    monkeypatch.setattr(config, "DATABASE_URL", "postgresql://u:p@db.example/office_hours")
    monkeypatch.setattr(config, "APP_ENV", "production")
    monkeypatch.setattr(config, "AUTO_SEED", False)
    monkeypatch.setattr(config, "JWT_SECRET", "x" * 48)


def test_safe_production_settings_start(real_database):
    assert config.unsafe_for_production() == []


def test_demo_data_on_a_real_database_refuses_to_start(real_database, monkeypatch):
    monkeypatch.setattr(config, "AUTO_SEED", True)
    assert "AUTO_SEED" in " ".join(config.unsafe_for_production())
    from app.main import app
    from fastapi.testclient import TestClient
    with pytest.raises(RuntimeError, match="Refusing to start: AUTO_SEED"):
        with TestClient(app):
            pass


@pytest.mark.parametrize("secret", ["change-this-development-secret", "short-secret"])
def test_a_weak_jwt_secret_refuses_to_start(real_database, monkeypatch, secret):
    monkeypatch.setattr(config, "JWT_SECRET", secret)
    assert "JWT_SECRET" in " ".join(config.unsafe_for_production())


def test_sqlite_and_development_are_allowed(real_database, monkeypatch):
    monkeypatch.setattr(config, "AUTO_SEED", True)
    monkeypatch.setattr(config, "APP_ENV", "development")
    assert config.unsafe_for_production() == []
    monkeypatch.setattr(config, "APP_ENV", "production")
    monkeypatch.setattr(config, "DATABASE_URL", "sqlite:///./office_hours.db")
    assert config.unsafe_for_production() == []
