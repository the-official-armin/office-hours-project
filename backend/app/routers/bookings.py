"""Bookings — one resource for both roles.

- GET /bookings?view=teacher: everything booked with the signed-in teacher (teacher pages).
- GET /bookings?view=student: the signed-in student's own bookings, every status.
- GET /bookings?view=open: every confirmed booking, with other students' names and
  reasons removed (the public occupancy view: how full each office hour is).
- POST /bookings: the student books a spot. DELETE /bookings/{id}: the student cancels.
"""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session, joinedload

from .. import rules, views
from ..deps import current_student, current_teacher, get_db, now_local, push_note
from ..errors import RuleError
from ..models import Booking, Student, Teacher
from ..schemas import BookSeatIn
from . import common

router = APIRouter(tags=["bookings"])


class _AnonBooking:
    """Wraps a Booking so the serializer blanks the student's name and reason."""

    def __init__(self, booking: Booking):
        self._b = booking

    def __getattr__(self, item):
        if item in ("student_name", "reason"):
            return ""
        return getattr(self._b, item)


def _query(db: Session):
    return db.query(Booking).options(joinedload(Booking.timing), joinedload(Booking.student))


@router.get("/bookings")
def list_bookings(view: str = Query(pattern="^(teacher|student|open)$"),
                  db: Session = Depends(get_db),
                  teacher: Teacher = Depends(current_teacher),
                  student: Student = Depends(current_student)):
    if view == "open":
        # The public occupancy view: a student only learns that a spot is taken, never by whom.
        rows = _query(db).filter(Booking.status == "confirmed").order_by(Booking.date, Booking.id).all()
        return [views.booking_json(b if b.student_id == student.id else _AnonBooking(b)) for b in rows]
    if view == "teacher":
        rows = _query(db).filter(Booking.teacher_id == teacher.id).order_by(Booking.date, Booking.id).all()
    else:
        rows = _query(db).filter(Booking.student_id == student.id).order_by(Booking.date, Booking.id).all()
    return [views.booking_json(b) for b in rows]


@router.post("/bookings")
def book_seat(body: BookSeatIn, db: Session = Depends(get_db),
              student: Student = Depends(current_student)):
    """The student books a spot in one of the teacher's office hours."""
    now = now_local()
    common.assert_check(rules.check_booking_reason(body.reason))
    common.assert_check(rules.check_booking(common.world(db), body.teacherId, body.date,
                                            body.timingId, student.id, now))
    teacher = common.teacher_or_404(db, body.teacherId)
    timing = next((x for x in teacher.timings if x.key == body.timingId), None)
    booking = Booking(
        teacher_id=teacher.id,
        timing_id=timing.id,
        date=body.date,
        student_id=student.id,
        reason=body.reason.strip(),
        status="confirmed",
    )
    db.add(booking)
    db.flush()
    push_note(
        db,
        "%s booked a spot in %s on %s." % (
            student.name, timing.name, rules.format_date_short(booking.date)),
        teacher_id=teacher.id,
        enabled=teacher.booking,
    )
    db.commit()
    db.refresh(booking)
    return views.booking_json(booking)


@router.delete("/bookings/{booking_id}", status_code=204)
def cancel_booking(booking_id: int, db: Session = Depends(get_db),
                   student: Student = Depends(current_student)):
    """The student cancels a confirmed booking; the teacher is notified."""
    now = now_local()
    booking = (
        db.query(Booking)
        .options(joinedload(Booking.timing))
        .filter(Booking.id == booking_id, Booking.student_id == student.id,
                Booking.status == "confirmed")
        .first()
    )
    if booking is None:
        raise RuleError("not_found", "That booking was already cancelled.")
    timing = booking.timing
    if timing is not None and rules.has_started(booking.date, rules.hhmm(timing.start_time), now):
        raise RuleError("past", "That office hour has already started.")
    booking.status = "cancelled"
    teacher = db.get(Teacher, booking.teacher_id)
    if teacher is not None:
        push_note(
            db,
            "%s cancelled their spot in %s on %s. The spot is open again." % (
                student.name,
                timing.name if timing is not None else "an office hour",
                rules.format_date_short(booking.date)),
            teacher_id=teacher.id,
            enabled=teacher.cancel,
        )
    db.commit()
    return Response(status_code=204)
