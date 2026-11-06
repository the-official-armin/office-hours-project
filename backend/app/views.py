"""Load ORM rows into rule views and serialize models into the JSON shapes the frontend expects.

The JSON keys mirror frontend-teacher/src/types/index.ts exactly (camelCase), because
src/api/client.ts passes responses straight into the pages.
"""
from datetime import date
from typing import Dict, List

from sqlalchemy.orm import Session, joinedload

from . import rules
from .models import Booking, BookingRequest, Notification, Student, Teacher, Timing


def _timing_view(t: Timing) -> rules.TimingView:
    return rules.TimingView(
        key=t.key,
        name=t.name,
        start=rules.hhmm(t.start_time),
        end=rules.hhmm(t.end_time),
        days=list(t.days or []),
        gone=bool(t.gone),
    )


def load_world(db: Session) -> rules.World:
    """All teachers (with timings, days off and their reasons) and all bookings, as rule views."""
    teachers = (
        db.query(Teacher)
        .options(joinedload(Teacher.timings), joinedload(Teacher.days_off))
        .order_by(Teacher.id)
        .all()
    )
    bookings = (
        db.query(Booking)
        .options(joinedload(Booking.timing), joinedload(Booking.student))
        .order_by(Booking.id)
        .all()
    )
    tviews: Dict[str, rules.TeacherView] = {}
    for t in teachers:
        reasons = {d.date: d.reason for d in t.days_off}
        tviews[t.id] = rules.TeacherView(
            id=t.id,
            name=t.name,
            subject=t.subject,
            group=t.subject_group,
            capacity=t.capacity,
            timings=[_timing_view(x) for x in t.timings],
            days_off=sorted(reasons.keys()),
        )
        tviews[t.id].days_off_reasons = reasons  # serializer-only extra field
    bviews: List[rules.BookingView] = []
    for b in bookings:
        tv = tviews.get(b.teacher_id)
        timing = None
        if b.timing is not None and tv is not None:
            timing = next((x for x in tv.timings if x.key == b.timing.key), None)
        bviews.append(rules.BookingView(
            id=str(b.id),
            teacher_id=b.teacher_id,
            date=b.date,
            timing_key=b.timing.key if b.timing is not None else "",
            timing=timing,
            student_id=b.student_id,
            student_name=b.student.name if b.student is not None else "",
            reason=b.reason,
            status=b.status,
        ))
    return rules.World(teachers=list(tviews.values()), bookings=bviews)


def timing_json(x: rules.TimingView) -> dict:
    out = {
        "id": x.key,
        "name": x.name,
        "start": x.start,
        "end": x.end,
        "days": list(x.days),
    }
    if x.gone:
        out["gone"] = True
    return out


def teacher_json(t: rules.TeacherView) -> dict:
    reasons = getattr(t, "days_off_reasons", {})
    return {
        "id": t.id,
        "name": t.name,
        "subject": t.subject,
        "group": t.group,
        "max": t.capacity,
        "timings": [timing_json(x) for x in t.timings],
        "daysOff": [
            {"date": d.isoformat(), "reason": reasons.get(d, "")}
            for d in t.days_off
        ],
    }


def booking_json(b) -> dict:
    timing = getattr(b, "timing", None)
    student_name = getattr(b, "student_name", None)
    if student_name is None:
        student = getattr(b, "student", None)
        student_name = student.name if student is not None else ""
    return {
        "id": str(b.id),
        "teacherId": b.teacher_id,
        "date": b.date.isoformat() if isinstance(b.date, date) else b.date,
        "timingId": timing.key if timing is not None else b.timing_key,
        "studentId": b.student_id,
        "studentName": student_name,
        "reason": b.reason,
        "status": b.status,
        "createdAt": b.created_at.isoformat() if b.created_at is not None else None,
    }


def request_json(r: BookingRequest) -> dict:
    return {
        "id": str(r.id),
        "teacherId": r.teacher_id,
        "studentId": r.student_id,
        "studentName": r.student.name if r.student is not None else "",
        "date": r.date.isoformat(),
        "time": r.time,
        "reason": r.reason,
        "status": r.status,
        "note": r.note,
    }


def note_json(n: Notification) -> dict:
    out = {
        "id": str(n.id),
        "text": n.text,
        "at": n.at,
        "read": n.read,
    }
    if n.key:
        out["key"] = n.key
    return out


def teacher_settings_json(t: Teacher) -> dict:
    return {
        "name": t.name,
        "subject": t.subject,
        "email": t.email,
        "remind": t.remind,
        "booking": t.booking,
        "cancel": t.cancel,
        "request": t.request,
        "morning": t.morning,
        "lead": t.lead,
    }


def student_settings_json(s: Student) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "grade": s.grade,
        "email": s.email,
        "remind": s.remind,
        "booked": s.booked,
        "answer": s.answer,
        "out": s.out,
        "lead": s.lead,
    }
