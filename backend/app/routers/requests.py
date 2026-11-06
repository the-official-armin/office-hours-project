"""Booking requests ("request a different time") — one resource for both roles.

- GET /requests?view=teacher: requests sent to the signed-in teacher.
- GET /requests?view=student: the signed-in student's own requests.
- POST /requests: the student asks for a time outside office hours.
- POST /requests/{id}/answer: the teacher accepts or declines.
- DELETE /requests/{id}: the student withdraws a pending request.
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from .. import rules, views
from ..deps import (CurrentUser, check_view, current_student, current_teacher, current_user, get_db,
                    now_local, push_note)
from ..errors import RuleError
from ..models import BookingRequest, Student, Teacher
from ..schemas import SendRequestIn
from . import common

router = APIRouter(tags=["requests"])


class AnswerIn(BaseModel):
    answer: str  # accepted | declined


@router.get("/requests")
def list_requests(view: str = Query(pattern="^(teacher|student)$"),
                  from_date: Optional[date] = Query(default=None, alias="from"),
                  to_date: Optional[date] = Query(default=None, alias="to"),
                  db: Session = Depends(get_db),
                  me: CurrentUser = Depends(current_user)):
    check_view(view, me)
    if from_date is not None and to_date is not None and from_date > to_date:
        raise RuleError("invalid", "The from date must be on or before the to date.")
    date_filter = []
    if from_date is not None:
        date_filter.append(BookingRequest.date >= from_date)
    if to_date is not None:
        date_filter.append(BookingRequest.date <= to_date)
    if view == "teacher":
        rows = (
            db.query(BookingRequest)
            .options(joinedload(BookingRequest.student))
            .filter(BookingRequest.teacher_id == me.user.id, *date_filter)
            .all()
        )
        rows.sort(key=lambda r: (r.date.isoformat(), r.time))
    else:
        rows = (
            db.query(BookingRequest)
            .options(joinedload(BookingRequest.student))
            .filter(BookingRequest.student_id == me.user.id, *date_filter)
            .order_by(BookingRequest.id)
            .all()
        )
    return [views.request_json(r) for r in rows]


@router.post("/requests")
def send_request(body: SendRequestIn, db: Session = Depends(get_db),
                 student: Student = Depends(current_student)):
    """The student asks a teacher for a time outside their office hours."""
    now = now_local()
    common.assert_check(rules.check_request(common.world(db), body.teacherId, body.date,
                                            body.time, body.reason, now))
    teacher = common.teacher_or_404(db, body.teacherId)
    r = BookingRequest(
        teacher_id=teacher.id,
        student_id=student.id,
        date=body.date,
        time=body.time,
        reason=body.reason.strip(),
        status="pending",
        note="",
    )
    db.add(r)
    db.flush()
    push_note(
        db,
        "%s sent a request for %s at %s." % (
            student.name, rules.format_date_short(r.date), rules.format_time(r.time)),
        teacher_id=teacher.id,
        enabled=teacher.request,
    )
    db.commit()
    db.refresh(r)
    return views.request_json(r)


@router.post("/requests/{request_id}/answer")
def answer_request(request_id: int, body: AnswerIn, db: Session = Depends(get_db),
                   teacher: Teacher = Depends(current_teacher)):
    """The teacher answers a pending request: {"answer": "accepted" | "declined"}.
    Accepting is refused when the time has passed or is a day off."""
    if body.answer not in ("accepted", "declined"):
        raise RuleError("invalid", "Answer must be 'accepted' or 'declined'.")
    r = (
        db.query(BookingRequest)
        .options(joinedload(BookingRequest.student))
        .filter(BookingRequest.id == request_id,
                BookingRequest.teacher_id == teacher.id,
                BookingRequest.status == "pending")
        .first()
    )
    if r is None:
        raise RuleError("not_found", "That request was already answered.")
    accepted = body.answer == "accepted"
    if accepted:
        common.assert_check(rules.check_accept(common.world(db), r.teacher_id, r.date,
                                               r.time, now_local()))
    r.status = body.answer
    r.note = "%s %s this time." % (teacher.name, "accepted" if accepted else "declined")
    student = db.get(Student, r.student_id)
    push_note(
        db,
        "%s %s your request for %s at %s." % (
            teacher.name, "accepted" if accepted else "declined",
            rules.format_date_short(r.date), rules.format_time(r.time)),
        student_id=r.student_id,
        enabled=student.answer if student is not None else True,
    )
    db.commit()
    return views.request_json(r)


@router.delete("/requests/{request_id}", status_code=204)
def cancel_request(request_id: int, db: Session = Depends(get_db),
                   student: Student = Depends(current_student)):
    """The student withdraws a pending request; the teacher is notified."""
    r = (
        db.query(BookingRequest)
        .filter(BookingRequest.id == request_id, BookingRequest.student_id == student.id,
                BookingRequest.status == "pending")
        .first()
    )
    if r is None:
        raise RuleError("not_found", "That request was already answered.")
    teacher = db.get(Teacher, r.teacher_id)
    db.delete(r)
    if teacher is not None:
        push_note(
            db,
            "%s cancelled the request for %s." % (student.name, rules.format_date_short(r.date)),
            teacher_id=teacher.id,
            enabled=teacher.request,
        )
    db.commit()
    return Response(status_code=204)
