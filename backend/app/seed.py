"""Demo dataset — a Python port of frontend-teacher/src/api/mocks/seed.ts.

Built from today's date so the screens are never empty. Run standalone:
    cd backend && venv/bin/python -m app.seed
or automatically on startup when the database is empty (AUTO_SEED=true).
"""
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from . import rules
from .database import Base, SessionLocal, engine
from .models import Booking, BookingRequest, DayOff, Notification, Student, Teacher, Timing

ME_TEACHER = "rivera"
ME_STUDENT = "maya"
HOUR_MS = 3_600_000


def fwd(t0: date, dows, n: int):
    """The next n dates, starting tomorrow, that fall on one of these JS weekdays."""
    out = []
    d = t0 + timedelta(days=1)
    while len(out) < n:
        if rules.js_dow(d) in dows:
            out.append(d)
        d += timedelta(days=1)
    return out


def back(t0: date, dows, n: int):
    """The previous n dates, starting yesterday, that fall on one of these JS weekdays."""
    out = []
    d = t0 - timedelta(days=1)
    while len(out) < n:
        if rules.js_dow(d) in dows:
            out.append(d)
        d -= timedelta(days=1)
    return out


STUDENTS = {
    "maya": ("Maya K.", "Grade 10"),
    "daniel": ("Daniel O.", "Grade 10"),
    "priya": ("Priya S.", "Grade 10"),
    "ethan": ("Ethan W.", "Grade 10"),
    "hana": ("Hana B.", "Grade 10"),
    "leo": ("Leo M.", "Grade 10"),
    "noor": ("Noor A.", "Grade 10"),
    "jonas": ("Jonas R.", "Grade 10"),
    "zoe": ("Zoe T.", "Grade 10"),
    "ines": ("Ines F.", "Grade 10"),
    "tariq": ("Tariq A.", "Grade 10"),
    "mia": ("Mia C.", "Grade 10"),
    "omar": ("Omar H.", "Grade 10"),
    "lena": ("Lena V.", "Grade 10"),
    "sam": ("Sam D.", "Grade 10"),
    "aiden": ("Aiden P.", "Grade 10"),
    "sofia": ("Sofia L.", "Grade 10"),
    "marcus": ("Marcus T.", "Grade 10"),
}


def seed(db: Session, now: datetime = None) -> None:
    now = now or datetime.now()
    t0 = now.date()
    now_ms = int(now.timestamp() * 1000)

    # Wipe in dependency order (seed is a full reset).
    for model in (Notification, BookingRequest, Booking, DayOff, Timing, Student, Teacher):
        db.query(model).delete()

    # ---------------------------------------------------------------- people
    for sid, (name, grade) in STUDENTS.items():
        db.add(Student(id=sid, name=name, grade=grade, email="",
                       remind=True, booked=True, answer=True, out=True, lead="1 hour"))

    def timing(key: str, name: str, start: str, end: str, days) -> Timing:
        return Timing(key=key, name=name, start_time=rules.parse_hhmm(start),
                      end_time=rules.parse_hhmm(end), days=list(days), gone=False)

    def teacher(tid: str, name: str, subject: str, group: str, timings) -> Teacher:
        t = Teacher(id=tid, name=name, subject=subject, subject_group=group,
                    capacity=rules.DEFAULT_CAPACITY, email="",
                    remind=True, booking=True, cancel=True, request=True,
                    morning=False, lead="1 hour")
        t.timings = timings
        return t

    lunch = lambda days: timing("lunch", "Lunch", "12:10", "12:40", days)
    after = lambda days: timing("after", "After school", "15:30", "16:00", days)

    teachers = [
        teacher("rivera", "Ms. Rivera", "Mathematics", "Math", [lunch([2, 4]), after([2, 4])]),
        teacher("okafor", "Mr. Okafor", "Chemistry", "Science", [lunch([2, 5])]),
        teacher("brooks", "Ms. Brooks", "Biology", "Science", [lunch([2, 4])]),
        teacher("lindqvist", "Dr. Lindqvist", "English", "English", [after([2, 5])]),
        teacher("alvarez", "Ms. Alvarez", "Spanish", "Languages", [lunch([3, 4])]),
        teacher("tanaka", "Mr. Tanaka", "World History", "History", [after([1, 3])]),
    ]
    for t in teachers:
        db.add(t)
    db.flush()
    timing_by_key = {(t.id, x.key): x for t in teachers for x in t.timings}

    def add_day_off(tid: str, d: date, reason: str):
        db.add(DayOff(teacher_id=tid, date=d, reason=reason))

    bookings = []

    def add(tid: str, d: date, timing_key: str, student_id: str,
            reason: str, status: str = "confirmed"):
        bookings.append(Booking(
            teacher_id=tid, timing_id=timing_by_key[(tid, timing_key)].id, date=d,
            student_id=student_id, reason=reason, status=status,
        ))

    ME = ME_STUDENT

    # ---------------------------------------------------------------- Ms. Rivera (the teacher view)
    riv = fwd(t0, [2, 4], 12)
    add("rivera", riv[0], "lunch", ME, "Review homework problems 12\u201318.")
    add("rivera", riv[0], "lunch", "daniel", "Questions on the graphing project rubric.")
    add("rivera", riv[0], "lunch", "priya", "Not sure how to start the word problems.")
    add("rivera", riv[0], "after", "ethan", "Wants feedback on his test corrections.")
    add("rivera", riv[1], "lunch", "hana", "Prep for the unit 3 exam.")
    add("rivera", riv[1], "lunch", "leo", "Catch up after missing two classes.")
    add("rivera", riv[2], "lunch", "noor", "Check my work on factoring.")
    add("rivera", riv[2], "lunch", "jonas", "Study group review for the quiz.")
    add("rivera", riv[2], "lunch", "zoe", "Retake plan for the last test.")
    add("rivera", riv[2], "lunch", "ines", "Confused about slope-intercept form.")
    add("rivera", riv[3], "lunch", "tariq", "Help with the extra credit problem.")
    add_day_off("rivera", riv[3], "Parent conference day")
    add_day_off("rivera", riv[5], "Field trip")
    add_day_off("rivera", riv[9], "Holiday break")
    # This week's office hours that already happened (today counts), so history is never empty.
    monday = t0 - timedelta(days=t0.weekday())
    for i in range(5):
        d = monday + timedelta(days=i)
        if d <= t0 and rules.js_dow(d) in (2, 4):
            add("rivera", d, "lunch", "mia", "Help with the homework set.")
            add("rivera", d, "lunch", "omar", "Quiz retake planning.")
            add("rivera", d, "lunch", "lena", "Check my graphs.")
            add("rivera", d, "after", "sam", "Review the unit test.")

    # ---------------------------------------------------------------- other teachers
    ok = fwd(t0, [2, 5], 6)
    add("okafor", ok[0], "lunch", "daniel", "Lab report questions.")
    add("okafor", ok[0], "lunch", "hana", "Review moles and molar mass.")
    add("okafor", ok[1], "lunch", "leo", "Catch up on the titration lab.")
    add("okafor", ok[1], "lunch", ME, "Questions about balancing equations.")
    add("okafor", ok[2], "lunch", "noor", "Study for the unit test.")
    br = fwd(t0, [2, 4], 6)
    for sid in ["jonas", "zoe", "ines", "tariq"]:
        add("brooks", br[0], "lunch", sid, "Cell structure review.")
    add("brooks", br[1], "lunch", "mia", "Help with the genetics worksheet.")
    li = fwd(t0, [2, 5], 6)
    add("lindqvist", li[1], "after", "omar", "Feedback on my essay draft.")
    al = fwd(t0, [3, 4], 6)
    add("alvarez", al[0], "lunch", "lena", "Practice speaking.")
    add("alvarez", al[2], "lunch", ME, "Practice for the oral exam.")
    add_day_off("alvarez", al[2], "Curriculum day")
    ta = fwd(t0, [1, 3], 6)
    add("tanaka", ta[1], "after", "sam", "Essay outline help.")

    # ---------------------------------------------------------------- Maya's history
    add("rivera", back(t0, [2], 1)[0], "lunch", ME, "Help with the chapter 3 quiz.")
    add("okafor", back(t0, [5], 1)[0], "lunch", ME, "Lab safety questions.")
    add("lindqvist", back(t0, [2, 5], 4)[3], "after", ME,
        "Feedback on my essay outline.", status="cancelled")

    for i, b in enumerate(bookings):
        b.created_at = now - timedelta(hours=2 + i)
        db.add(b)

    # ---------------------------------------------------------------- requests
    requests = [
        ("rivera", "aiden", fwd(t0, [3], 1)[0], "15:45",
         "Wants to go over the unit test he missed before the make-up date.", "pending", ""),
        ("rivera", "sofia", fwd(t0, [5], 1)[0], "12:15",
         "Stuck on geometry proofs and needs more time than a lunch slot.", "pending", ""),
        ("rivera", "marcus", fwd(t0, [1], 1)[0], "15:30",
         "Wants to plan a retake of last quiz.", "pending", ""),
        ("okafor", ME, fwd(t0, [5], 1)[0], "15:45",
         "Can I get feedback on my lab report draft? None of the lunch slots fit my schedule.", "pending", ""),
        ("alvarez", ME, back(t0, [3], 1)[0], "16:00",
         "Extra practice before the vocabulary test.", "accepted", "Ms. Alvarez accepted this time."),
        ("lindqvist", ME, back(t0, [1], 1)[0], "15:30",
         "Talk through my thesis statement.", "declined",
         "Dr. Lindqvist: \u201cI\u2019m out Mondays. Please use Tuesday or Friday.\u201d"),
    ]
    for tid, sid, d, t, reason, status, note in requests:
        db.add(BookingRequest(teacher_id=tid, student_id=sid, date=d, time=t,
                              reason=reason, status=status, note=note))

    # ---------------------------------------------------------------- notifications
    student_notes = [
        ("Ms. Alvarez is out on %s. Cancel your booking and pick another time."
         % rules.format_date_long(al[2]), 2, False),
        ("Ms. Alvarez accepted your request for a different time.", 30, True),
    ]
    teacher_notes = [
        ("Marcus T. sent a request for %s at %s."
         % (rules.format_date_short(fwd(t0, [1], 1)[0]), rules.format_time("15:30")), 1, False),
        ("Hana B. booked a spot in Lunch on %s." % rules.format_date_short(riv[1]), 5, False),
        ("Sofia L. sent a request for %s at %s."
         % (rules.format_date_short(fwd(t0, [5], 1)[0]), rules.format_time("12:15")), 26, True),
    ]
    for text, hours_ago, read in student_notes:
        db.add(Notification(student_id=ME_STUDENT, text=text,
                            at=now_ms - hours_ago * HOUR_MS, read=read))
    for text, hours_ago, read in teacher_notes:
        db.add(Notification(teacher_id=ME_TEACHER, text=text,
                            at=now_ms - hours_ago * HOUR_MS, read=read))

    db.commit()


def main() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        seed(db)
        print("Seeded demo data: 6 teachers, %d students." % len(STUDENTS))
    finally:
        db.close()


if __name__ == "__main__":
    main()
