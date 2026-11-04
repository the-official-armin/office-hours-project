"""Shared dependencies: database session, the placeholder signed-in user, notifications.

Auth is intentionally a placeholder (no JWT yet): every endpoint answers for the demo
user, mirroring the frontend mock mode. Swap current_teacher/current_student for real
JWT dependencies when the auth team lands their part.
"""
import time as time_module
from datetime import datetime
from typing import Optional

from fastapi import Depends
from sqlalchemy.orm import Session

from .config import ME_STUDENT_ID, ME_TEACHER_ID
from .database import SessionLocal
from .errors import RuleError
from .models import Notification, Student, Teacher


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_teacher(db: Session = Depends(get_db)) -> Teacher:
    teacher = db.get(Teacher, ME_TEACHER_ID)
    if teacher is None:
        raise RuleError("not_found", "Teacher not found.")
    return teacher


def current_student(db: Session = Depends(get_db)) -> Student:
    student = db.get(Student, ME_STUDENT_ID)
    if student is None:
        raise RuleError("not_found", "Student not found.")
    return student


def now_local() -> datetime:
    """School local time, naive — the same clock the frontend uses."""
    return datetime.now()


def push_note(db: Session, text: str, *, teacher_id: Optional[str] = None,
              student_id: Optional[str] = None, enabled: bool = True,
              key: Optional[str] = None) -> bool:
    """Adds a notification for one recipient, newest first. Skips when disabled or the key exists."""
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
    return True
