"""Teacher directory, profile, settings, office-hour schedule and days off."""
import re

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from .. import rules, views
from ..deps import current_teacher, get_db, now_local, push_note
from ..errors import RuleError
from ..models import DayOff, Student, Teacher, Timing
from ..schemas import DayOffIn, HoursInputIn, TeacherSettingsIn
from . import common

router = APIRouter(tags=["teachers"])


@router.get("/teachers")
def list_teachers(db: Session = Depends(get_db)):
    """Every teacher, with their office-hour timings and days off."""
    return [views.teacher_json(t) for t in common.world(db).teachers]


@router.get("/teacher/profile")
def teacher_profile(db: Session = Depends(get_db), teacher: Teacher = Depends(current_teacher)):
    """The signed-in teacher's full profile (what the teacher pages render from)."""
    return views.teacher_json(common.me_view(db, teacher))


@router.get("/teacher/settings")
def get_settings(teacher: Teacher = Depends(current_teacher)):
    """The teacher's own record plus email/notification preferences."""
    return views.teacher_settings_json(teacher)


@router.put("/teacher/settings")
def save_settings(body: TeacherSettingsIn, db: Session = Depends(get_db),
                  teacher: Teacher = Depends(current_teacher)):
    name = body.name.strip()
    if not name:
        raise RuleError("invalid", "Enter a name first.")
    email = body.email.strip()
    if email and not re.match(r"^\S+@\S+\.\S+$", email):
        raise RuleError("invalid", "Enter a valid email address.")
    teacher.name = name
    teacher.subject = body.subject.strip()
    teacher.email = email
    teacher.remind = body.remind
    teacher.booking = body.booking
    teacher.cancel = body.cancel
    teacher.request = body.request
    teacher.morning = body.morning
    teacher.lead = body.lead
    db.commit()
    return views.teacher_settings_json(teacher)


@router.put("/teacher/schedule")
def save_schedule(body: HoursInputIn, db: Session = Depends(get_db),
                  teacher: Teacher = Depends(current_teacher)):
    """Save office hours (timings + seats per office hour). Existing bookings are kept;
    affected students are notified. Returns how many upcoming bookings no longer match."""
    now = now_local()
    w = common.world(db)
    tview = next((t for t in w.teachers if t.id == teacher.id), None)
    if tview is None:
        raise RuleError("not_found", "Teacher not found.")
    drafts = [rules.TimingView(key=d.id, name=d.name, start=d.start, end=d.end, days=list(d.days))
              for d in body.timings]
    common.assert_check(rules.check_hours(w, teacher.id, drafts, body.max, now))
    orphaned = len(rules.orphaned_bookings(w, teacher.id, drafts, now))
    notices = rules.hours_notices(w, tview, drafts, now)

    applied = rules.apply_timings(tview.timings, drafts)
    orm_by_key = {x.key: x for x in teacher.timings}
    for v in applied:
        row = orm_by_key.get(v.key)
        if row is None:
            db.add(Timing(teacher_id=teacher.id, key=v.key, name=v.name,
                          start_time=rules.parse_hhmm(v.start), end_time=rules.parse_hhmm(v.end),
                          days=list(v.days), gone=v.gone))
        else:
            row.name = v.name
            row.start_time = rules.parse_hhmm(v.start)
            row.end_time = rules.parse_hhmm(v.end)
            row.days = list(v.days)
            row.gone = v.gone
    teacher.capacity = body.max

    for student_id, text in notices:
        student = db.get(Student, student_id)
        push_note(db, text, student_id=student_id,
                  enabled=student.out if student is not None else True)
    db.commit()
    return {"orphaned": orphaned}


@router.post("/teacher/days-off")
def add_day_off(body: DayOffIn, db: Session = Depends(get_db),
                teacher: Teacher = Depends(current_teacher)):
    """Add a day off. Allowed even when bookings exist (they are kept); affected
    students are notified. Returns the day off and how many bookings it touches."""
    now = now_local()
    w = common.world(db)
    tview = next((t for t in w.teachers if t.id == teacher.id), None)
    if tview is None:
        raise RuleError("not_found", "Teacher not found.")
    common.assert_check(rules.check_day_off(tview, body.date, now))
    affected = rules.affected_on(w, teacher.id, body.date, now)
    reason = body.reason.strip() or "Day off"
    db.add(DayOff(teacher_id=teacher.id, date=body.date, reason=reason))
    for b in affected:
        student = db.get(Student, b.student_id)
        push_note(
            db,
            "%s is out on %s. Cancel your booking and pick another time." % (
                teacher.name, rules.format_date_long(body.date)),
            student_id=b.student_id,
            enabled=student.out if student is not None else True,
        )
    db.commit()
    return {"dayOff": {"date": body.date.isoformat(), "reason": reason}, "affected": len(affected)}


@router.delete("/teacher/days-off/{date}", status_code=204)
def remove_day_off(date: str, db: Session = Depends(get_db),
                   teacher: Teacher = Depends(current_teacher)):
    """Remove a day off; affected students are told their booking is on again."""
    d = common.parse_iso_date(date)
    row = db.query(DayOff).filter(DayOff.teacher_id == teacher.id, DayOff.date == d).first()
    if row is None:
        raise RuleError("not_found", "That day off no longer exists.")
    affected = rules.affected_on(common.world(db), teacher.id, d, now_local())
    db.delete(row)
    for b in affected:
        student = db.get(Student, b.student_id)
        push_note(
            db,
            "%s is back on %s. Your booking is on again." % (
                teacher.name, rules.format_date_long(d)),
            student_id=b.student_id,
            enabled=student.out if student is not None else True,
        )
    db.commit()
    return Response(status_code=204)
