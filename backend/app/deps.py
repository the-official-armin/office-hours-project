"""Shared dependencies: database session, the signed-in user, the school clock, notifications.

Every endpoint except /healthz, /teachers and /auth/login needs `Authorization: Bearer <token>`
(from POST /auth/login). The token says who is signed in and as which role:
- current_user: anyone signed in (401 without a valid token).
- current_teacher / current_student: that role only (403 for the other one).
- check_view: the ?view= of the shared resources must match the signed-in role (403 otherwise).
"""
import time as time_module
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Union
from zoneinfo import ZoneInfo

from fastapi import Depends, Header
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from .config import SCHOOL_TZ
from . import outbox
from .database import SessionLocal
from .errors import RuleError
from .models import STATUS_ACTIVE, Notification, Student, Teacher
from .security import decode_access_token


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@dataclass
class CurrentUser:
    role: str  # teacher | student
    user: Union[Teacher, Student]
    claims: dict = field(default_factory=dict)  # the token's claims (POST /auth/refresh keeps its sign-in time)


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> CurrentUser:
    """The person the bearer token belongs to."""
    if not authorization.lower().startswith("bearer "):
        raise RuleError("unauthorized", "Please sign in.")
    try:
        claims = decode_access_token(authorization[7:].strip())
    except InvalidTokenError as exc:
        raise RuleError("unauthorized", "Your session has ended. Please sign in again.") from exc
    role = claims.get("role")
    if role not in ("teacher", "student") or not claims.get("sub"):
        raise RuleError("unauthorized", "Your session has ended. Please sign in again.")
    user = db.get(Teacher if role == "teacher" else Student, claims["sub"])
    if user is None:
        raise RuleError("unauthorized", "That account no longer exists.")
    if user.status != STATUS_ACTIVE:
        # Deactivated: their tokens stop working at once, not when they expire.
        raise RuleError("unauthorized", "This account is not active.")
    if claims.get("ver", 0) != user.session_version:
        # Logged out, or a new password was chosen, since this token was made.
        raise RuleError("unauthorized", "Your session has ended. Please sign in again.")
    return CurrentUser(role=role, user=user, claims=claims)


def current_teacher(me: CurrentUser = Depends(current_user)) -> Teacher:
    if me.role != "teacher":
        raise RuleError("forbidden", "Only teachers can do that.")
    return me.user


def current_student(me: CurrentUser = Depends(current_user)) -> Student:
    if me.role != "student":
        raise RuleError("forbidden", "Only students can do that.")
    return me.user


def check_view(view: str, me: CurrentUser) -> None:
    """?view=teacher is for teachers; ?view=student and ?view=open are for students."""
    if (view == "teacher") != (me.role == "teacher"):
        raise RuleError("forbidden", "That list is not available to you.")


def now_local() -> datetime:
    """School local time, naive: the same clock the frontend uses. SCHOOL_TZ when set, else the server's."""
    if SCHOOL_TZ:
        return datetime.now(ZoneInfo(SCHOOL_TZ)).replace(tzinfo=None)
    return datetime.now()


def push_note(db: Session, text: str, *, teacher_id: Optional[str] = None,
              student_id: Optional[str] = None, enabled: bool = True,
              key: Optional[str] = None, subject: Optional[str] = None, link: str = "", tag: str = "") -> bool:
    """Adds a notification for one recipient, newest first. Skips when disabled or the key exists.
    With a `subject` the same news is also emailed (app/outbox.py), once the change is saved."""
    if not enabled:
        return False
    if key is not None:
        exists = db.query(Notification).filter(
            Notification.key == key,
            Notification.teacher_id == teacher_id,
            Notification.student_id == student_id,
        ).first()
        if exists:
            return False
    note = Notification(
        teacher_id=teacher_id,
        student_id=student_id,
        text=text,
        at=int(time_module.time() * 1000),
        read=False,
        key=key,
    )
    db.add(note)
    db.flush()
    if subject:
        outbox.email_person(db, subject, [text], teacher_id=teacher_id, student_id=student_id, link=link, tag=tag)
    return True
