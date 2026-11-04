"""Helpers shared by the resource routers."""
from datetime import date, datetime

from sqlalchemy.orm import Session

from .. import rules, views
from ..errors import RuleError
from ..models import Student, Teacher


def world(db: Session) -> rules.World:
    return views.load_world(db)


def me_view(db: Session, teacher: Teacher) -> rules.TeacherView:
    w = world(db)
    return next((t for t in w.teachers if t.id == teacher.id), None) or rules.TeacherView(
        id=teacher.id, name=teacher.name, subject=teacher.subject,
        group=teacher.subject_group, capacity=teacher.capacity,
    )


def assert_check(check: rules.Check) -> None:
    if not check[0]:
        raise RuleError(check[1], check[2])


def parse_iso_date(s: str) -> date:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise RuleError("not_found", "That day off no longer exists.")


def teacher_or_404(db: Session, teacher_id: str) -> Teacher:
    teacher = db.get(Teacher, teacher_id)
    if teacher is None:
        raise RuleError("not_found", "That teacher no longer exists.")
    return teacher


def student_name(db: Session, student_id: str) -> str:
    student = db.get(Student, student_id)
    return student.name if student is not None else ""
