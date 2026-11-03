"""Student profile settings."""
import re

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import current_student, get_db
from ..errors import RuleError
from ..models import Student
from ..schemas import StudentSettingsIn
from .. import views

router = APIRouter(tags=["students"])


@router.get("/student/settings")
def get_settings(student: Student = Depends(current_student)):
    """The signed-in student's own record plus notification preferences."""
    return views.student_settings_json(student)


@router.put("/student/settings")
def save_settings(body: StudentSettingsIn, db: Session = Depends(get_db),
                  student: Student = Depends(current_student)):
    name = body.name.strip()
    if not name:
        raise RuleError("invalid", "Enter a name first.")
    email = body.email.strip()
    if email and not re.match(r"^\S+@\S+\.\S+$", email):
        raise RuleError("invalid", "Enter a valid email address.")
    student.name = name
    student.grade = body.grade.strip()
    student.email = email
    student.remind = body.remind
    student.booked = body.booked
    student.answer = body.answer
    student.out = body.out
    student.lead = body.lead
    db.commit()
    return views.student_settings_json(student)
