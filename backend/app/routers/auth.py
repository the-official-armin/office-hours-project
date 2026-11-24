"""Authentication endpoints. Accounts are invite-only (app/accounts.py): no sign-up here.
Sign-in, password links and forgot password are rate limited (app/ratelimit.py)."""
import asyncio
import logging
import time

from fastapi import APIRouter, Depends, Request, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from .. import accounts, config, ratelimit
from ..database import SessionLocal
from ..config import JWT_EXPIRE_MINUTES, SESSION_MAX_DAYS
from ..deps import CurrentUser, current_user, get_db
from ..errors import RuleError
from ..models import STATUS_ACTIVE
from ..schemas import ForgotPasswordIn, LoginIn, SetPasswordIn
from ..security import DUMMY_PASSWORD_HASH, create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger("office_hours.auth")


def _public_user(user, role: str):
    return {"id": user.id, "role": role, "name": user.name}


def _session(user, role: str, signed_in_at=None):
    return {
        "accessToken": create_access_token(user.id, role, user.session_version, signed_in_at),
        "tokenType": "bearer",
        "expiresIn": 60 * JWT_EXPIRE_MINUTES,
        "user": _public_user(user, role),
    }


@router.post("/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    """Email + password. One answer for every failure (unknown email, wrong password, not activated, deactivated).

    Limits: too many wrong passwords for one account lock that account for a while (checked first). The limit per
    address only ever turns away *wrong* passwords: a whole school shares one public address, so a classroom of typos
    must not keep a teacher with the right password out."""
    email, ip = accounts.normalize_email(body.email), ratelimit.client_ip(request)
    ratelimit.check(db, "login-email", email)
    found = accounts.find_by_email(db, email)
    # Always run the (deliberately slow) password check, against a stand-in hash when there is no account or no password
    # yet, so the time it takes is the same whoever asks.
    stored = found[0].password_hash if found is not None and found[0].password_hash else DUMMY_PASSWORD_HASH
    password_ok = verify_password(body.password, stored)
    if found is not None and stored is not DUMMY_PASSWORD_HASH and found[0].status == STATUS_ACTIVE and password_ok:
        user, role = found
        return _session(user, role)
    ratelimit.record(db, "login-email", email)
    ratelimit.record(db, "login-ip", ip)
    ratelimit.check(db, "login-ip", ip)
    raise RuleError("invalid_credentials", "Invalid email or password.")


@router.get("/me")
def me(me: CurrentUser = Depends(current_user)):
    return _public_user(me.user, me.role)


@router.post("/refresh")
def refresh(me: CurrentUser = Depends(current_user)):
    """A fresh token for a session that is still valid, so people aren't signed out every hour while they use the app.
    Not past SESSION_MAX_DAYS after the person signed in."""
    signed_in_at = int(me.claims.get("auth", 0))
    if time.time() - signed_in_at > SESSION_MAX_DAYS * 24 * 3600:
        raise RuleError("unauthorized", "Please sign in again.")
    return _session(me.user, me.role, signed_in_at)


@router.post("/logout", status_code=204)
def logout(me: CurrentUser = Depends(current_user), db: Session = Depends(get_db)):
    """Ends every session of this person, on every device: their tokens stop working at once."""
    me.user.session_version += 1
    db.commit()
    return Response(status_code=204)


def _link_guard(db: Session, request: Request, use):
    """Runs `use` (which reads a link); a link that can't be used counts towards this computer's limit."""
    ip = ratelimit.client_ip(request)
    ratelimit.check(db, "link-ip", ip)
    try:
        return use()
    except RuleError as err:
        if err.code == "link_invalid":
            db.rollback()
            ratelimit.record(db, "link-ip", ip)
        raise


@router.get("/link/{token}")
def link_info(token: str, request: Request, db: Session = Depends(get_db)):
    """What an activation or reset link is for, so the page can greet the person. 410 link_invalid when it can't be used."""
    link, person, role = _link_guard(db, request, lambda: accounts.read_link(db, token))
    return {"purpose": link.purpose, "name": person.name, "email": person.email, "role": role}


@router.post("/set-password")
def set_password(body: SetPasswordIn, request: Request, db: Session = Depends(get_db)):
    """Chooses a password from an activation or reset link, and signs the person in (every other session ends)."""
    person, role = _link_guard(db, request, lambda: accounts.use_link(db, body.token, body.password))
    return _session(person, role)


def _count_forgot_request(email: str, ip: str) -> None:
    db = SessionLocal()
    try:
        ratelimit.check(db, "forgot-email", email)
        ratelimit.check(db, "forgot-ip", ip)
        ratelimit.record(db, "forgot-email", email)
        ratelimit.record(db, "forgot-ip", ip)
    finally:
        db.close()


def _send_reset_link(email: str) -> None:
    """Looks the email up and sends a reset link (or a new invite). Its own session: it may outlive the request."""
    db = SessionLocal()
    try:
        accounts.forgot_password(db, email)
    except Exception:  # never surfaces to the caller, who already got (or will get) the same 204
        log.exception("Forgot password: sending to %s failed", email)
    finally:
        db.close()


@router.post("/forgot-password", status_code=204)
async def forgot_password(body: ForgotPasswordIn, request: Request):
    """Always 204 after the same FORGOT_PASSWORD_SECONDS (unless rate limited), so neither the answer nor the time it takes
    tells anyone which emails have accounts. The lookup and the email happen meanwhile; if Postmark is slower than that,
    the answer still goes out on time and the email follows."""
    started = time.monotonic()
    email, ip = accounts.normalize_email(body.email), ratelimit.client_ip(request)
    await run_in_threadpool(_count_forgot_request, email, ip)  # 429 here says nothing about the account
    work = asyncio.get_running_loop().run_in_executor(None, _send_reset_link, email)
    budget = config.FORGOT_PASSWORD_SECONDS
    await asyncio.wait({work}, timeout=max(0.0, budget - (time.monotonic() - started)))
    await asyncio.sleep(max(0.0, budget - (time.monotonic() - started)))
    return Response(status_code=204)
