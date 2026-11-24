"""Invite-only accounts: nobody signs up. A developer invites a person (python -m app.invite), the person gets an email with a
one-time link, chooses a password and is signed in. "Forgot password" sends the same kind of link.

Links are random tokens; only their SHA-256 hash is stored (AccountLink). A link works once, until it expires, and a newer
link for the same person and purpose replaces the older one.
"""
import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Union

from sqlalchemy.orm import Session, joinedload

from . import config, mailer, rules
from .deps import now_local, push_note
from .errors import RuleError
from .models import (STATUS_ACTIVE, STATUS_DEACTIVATED, STATUS_INVITED, AccountLink, Booking, Student, Teacher)
from .security import hash_password

Person = Union[Teacher, Student]

ACTIVATE = "activate"
RESET = "reset"
LINK_HOURS = {ACTIVATE: 7 * 24, RESET: 1}
MIN_PASSWORD = 10
MAX_PASSWORD = 128

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_MODELS = {"teacher": Teacher, "student": Student}


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def valid_email(email: str) -> bool:
    return bool(_EMAIL.match(email))


def find_by_email(db: Session, email: str) -> Optional[Tuple[Person, str]]:
    """The teacher or student with this sign-in email, and their role. Emails are unique across both tables."""
    email = normalize_email(email)
    if not email:
        return None
    for role, model in _MODELS.items():
        person = db.query(model).filter(model.email == email).one_or_none()
        if person is not None:
            return person, role
    return None


def _new_id(db: Session, model, email: str) -> str:
    """A readable id like the existing ones ("maya"): the email's local part, unique within the table."""
    base = re.sub(r"[^a-z0-9]+", "-", email.partition("@")[0]).strip("-") or "user"
    candidate, n = base, 2
    while db.get(model, candidate) is not None:
        candidate, n = "%s-%d" % (base, n), n + 1
    return candidate


def check_password(password: str, email: str) -> None:
    if len(password) < MIN_PASSWORD:
        raise RuleError("weak_password", "Use at least %d characters." % MIN_PASSWORD)
    if len(password) > MAX_PASSWORD:
        raise RuleError("weak_password", "Use at most %d characters." % MAX_PASSWORD)
    lowered = password.lower()
    if lowered in (email, email.partition("@")[0]):
        raise RuleError("weak_password", "Don't use your email as your password.")


# ------------------------------------------------------------------------------------------------ links

def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_link(db: Session, role: str, user_id: str, purpose: str) -> str:
    """A new one-time link token (returned once, never stored). Older unused links of this kind stop working."""
    now = utcnow()
    (db.query(AccountLink)
       .filter(AccountLink.role == role, AccountLink.user_id == user_id,
               AccountLink.purpose == purpose, AccountLink.used_at.is_(None))
       .update({AccountLink.used_at: now}, synchronize_session=False))
    token = secrets.token_urlsafe(32)
    db.add(AccountLink(token_hash=_hash(token), purpose=purpose, role=role, user_id=user_id,
                       expires_at=now + timedelta(hours=LINK_HOURS[purpose]), created_at=now))
    db.flush()
    return token


def read_link(db: Session, token: str) -> Tuple[AccountLink, Person, str]:
    """The link, its person and their role, or RuleError("link_invalid") when it is unknown, used, expired, or no longer fits."""
    link = db.query(AccountLink).filter(AccountLink.token_hash == _hash(token or "")).one_or_none()
    invalid = RuleError("link_invalid", "This link has expired or was already used.")
    if link is None or link.used_at is not None or link.expires_at <= utcnow():
        raise invalid
    person = db.get(_MODELS[link.role], link.user_id)
    if person is None or person.status == STATUS_DEACTIVATED:
        raise invalid
    if link.purpose == ACTIVATE and person.status != STATUS_INVITED:
        raise invalid
    if link.purpose == RESET and person.status != STATUS_ACTIVE:
        raise invalid
    return link, person, link.role


def use_link(db: Session, token: str, password: str) -> Tuple[Person, str]:
    """Sets the password from an activation or reset link, activates the account, and spends the link."""
    link, person, role = read_link(db, token)
    check_password(password, person.email)
    person.password_hash = hash_password(password)
    person.status = STATUS_ACTIVE
    person.session_version += 1  # a new password signs out every other device
    link.used_at = utcnow()
    db.commit()
    return person, role


# ------------------------------------------------------------------------------------------------ emails

def _link_url(path: str, token: str) -> str:
    return "%s/%s?token=%s" % (config.APP_URL, path, token)


def send_invite(person: Person, token: str) -> bool:
    first = person.name.split()[0] if person.name.split() else person.name
    return mailer.send_email(mailer.render(
        person.email,
        "Your %s account" % mailer.SCHOOL,
        "Hi %s, your account is ready" % first,
        [
            "You've been added to %s, where students book a spot at their teachers' office hours." % mailer.SCHOOL,
            "Choose a password to start. This link works once and expires in 7 days.",
        ],
        button=("Choose your password", _link_url("activate", token)),
        tag="invite",
    ))


def send_reset(person: Person, token: str) -> bool:
    return mailer.send_email(mailer.render(
        person.email,
        "Reset your %s password" % mailer.SCHOOL,
        "Reset your password",
        [
            "Someone asked to reset the password for %s. If it was you, choose a new one below." % person.email,
            "This link works once and expires in 1 hour. If you didn't ask, you can ignore this email.",
        ],
        button=("Choose a new password", _link_url("reset-password", token)),
        tag="reset",
    ))


# ------------------------------------------------------------------------------------------------ admin actions

def invite(db: Session, name: str, email: str, role: str, grade: str = "", subject: str = "",
           group: str = "") -> Tuple[Person, bool]:
    """Creates an invited account and emails the activation link. Returns the person and whether the email went out
    (the account stays either way; --resend sends a new link). RuleError when the email is taken or invalid."""
    email = normalize_email(email)
    name = name.strip()
    if role not in _MODELS:
        raise RuleError("invalid", "Role must be teacher or student.")
    if not name:
        raise RuleError("invalid", "A name is required.")
    if not valid_email(email):
        raise RuleError("invalid", "Not a valid email address: %r." % email)
    if find_by_email(db, email):
        raise RuleError("email_taken", "%s already has an account." % email)
    model = _MODELS[role]
    common = dict(id=_new_id(db, model, email), name=name, email=email, password_hash="", status=STATUS_INVITED)
    if role == "teacher":
        person = Teacher(subject=subject.strip(), subject_group=(group or subject).strip() or "Other",
                         capacity=rules.DEFAULT_CAPACITY, **common)
    else:
        person = Student(grade=grade.strip(), **common)
    db.add(person)
    db.flush()
    token = create_link(db, role, person.id, ACTIVATE)
    db.commit()
    return person, send_invite(person, token)


def resend_invite(db: Session, email: str) -> Tuple[Person, bool]:
    """A new activation link (the old one stops working). Returns the person and whether the email went out."""
    found = find_by_email(db, email)
    if not found:
        raise RuleError("not_found", "No account for %s." % normalize_email(email))
    person, role = found
    if person.status != STATUS_INVITED:
        raise RuleError("invalid", "%s is %s, not waiting for activation. Use forgot password instead." % (person.email, person.status))
    token = create_link(db, role, person.id, ACTIVATE)
    db.commit()
    return person, send_invite(person, token)


def _cancel_upcoming_bookings(db: Session, person: Person, role: str) -> int:
    """Cancels the person's confirmed bookings that haven't started (a deactivated student's spots open up again; a
    deactivated teacher's office hours won't happen) and tells the other side. Past bookings stay on record."""
    now = now_local()
    mine = Booking.student_id if role == "student" else Booking.teacher_id
    rows = (db.query(Booking)
            .options(joinedload(Booking.timing), joinedload(Booking.student))
            .filter(mine == person.id, Booking.status == "confirmed", Booking.date >= now.date())
            .all())
    cancelled = 0
    for b in rows:
        if b.timing is not None and datetime.combine(b.date, b.timing.start_time) <= now:
            continue  # already started or over: stays on record
        b.status = "cancelled"
        cancelled += 1
        what = "%s on %s" % (b.timing.name if b.timing else "an office hour", rules.format_date_short(b.date))
        if role == "student":
            teacher = db.get(Teacher, b.teacher_id)
            if teacher is not None:
                push_note(db, "%s's account was closed, so their spot in %s is open again." % (person.name, what),
                          teacher_id=teacher.id, enabled=teacher.cancel,
                          subject="Cancelled: %s, %s" % (person.name, rules.format_date_short(b.date)),
                          link="/teacher/calendar", tag="cancel")
        elif b.student is not None and b.student.status == STATUS_ACTIVE:
            push_note(db, "%s no longer holds office hours here, so your booking in %s was cancelled." % (person.name, what),
                      student_id=b.student_id, enabled=b.student.out,
                      subject="Cancelled: %s, %s" % (person.name, rules.format_date_short(b.date)),
                      link="/student/teachers", tag="out")
    return cancelled


def set_status(db: Session, email: str, status: str) -> Tuple[Person, int]:
    """Deactivate (sign-in, open sessions and links stop working at once, and upcoming bookings are cancelled) or
    reactivate an account (cancelled bookings stay cancelled). Returns the person and how many bookings were cancelled."""
    found = find_by_email(db, email)
    if not found:
        raise RuleError("not_found", "No account for %s." % normalize_email(email))
    person, role = found
    if status == STATUS_ACTIVE and not person.password_hash:
        status = STATUS_INVITED  # never activated: back to waiting for the invite
    person.status = status
    person.session_version += 1
    (db.query(AccountLink)
       .filter(AccountLink.role == role, AccountLink.user_id == person.id, AccountLink.used_at.is_(None))
       .update({AccountLink.used_at: utcnow()}, synchronize_session=False))
    cancelled = _cancel_upcoming_bookings(db, person, role) if status == STATUS_DEACTIVATED else 0
    db.commit()  # the notices' emails go out here (app/outbox.py)
    return person, cancelled


def forgot_password(db: Session, email: str) -> None:
    """Emails a reset link to an active account, or a fresh invite to one that never activated. Says nothing either way."""
    found = find_by_email(db, email)
    if not found:
        return
    person, role = found
    if person.status == STATUS_ACTIVE:
        token = create_link(db, role, person.id, RESET)
        db.commit()
        send_reset(person, token)
    elif person.status == STATUS_INVITED:
        token = create_link(db, role, person.id, ACTIVATE)
        db.commit()
        send_invite(person, token)
