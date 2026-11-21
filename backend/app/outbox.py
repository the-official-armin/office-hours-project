"""Emails that go with a database change: queued during the request, sent only once the change is saved.

    outbox.email_person(db, subject, lines, teacher_id=..., enabled=teacher.booking, link="/teacher")
    db.commit()   # the queued emails go out here, in one batch; a rollback drops them

So a booking that fails ("full", "already booked") never sends an email, and every email sent describes something that is
really in the database.
"""
from typing import List, Optional

from sqlalchemy import event
from sqlalchemy.orm import Session

from . import config, mailer
from .models import Student, Teacher

_KEY = "outbox"


def queue(db: Session, message: mailer.Email) -> None:
    db.info.setdefault(_KEY, []).append(message)


def email_person(db: Session, subject: str, lines: List[str], *, teacher_id: Optional[str] = None,
                 student_id: Optional[str] = None, enabled: bool = True, link: str = "", tag: str = "") -> bool:
    """Queues an email to one teacher or student, if they have that kind of email on. `link` is an app path ("/teacher")."""
    if not enabled:
        return False
    role, person = ("teacher", db.get(Teacher, teacher_id)) if teacher_id else ("student", db.get(Student, student_id))
    if person is None or not person.email:
        return False
    footer = "You get this email because it's on in your Settings: %s/%s/settings" % (config.APP_URL, role)
    queue(db, mailer.render(
        person.email,
        subject,
        subject,
        lines + [footer],
        button=("Open Office Hours", config.APP_URL + (link or "/" + role)),
        tag=tag,
    ))
    return True


@event.listens_for(Session, "after_commit")
def _send_after_commit(session: Session) -> None:
    messages = session.info.pop(_KEY, None)
    if messages:
        mailer.send_many(messages)


@event.listens_for(Session, "after_rollback")
def _drop_after_rollback(session: Session) -> None:
    session.info.pop(_KEY, None)
