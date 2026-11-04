"""Port of frontend-teacher/src/lib/rules.ts + dates.ts (formatting).

The domain rules as pure functions over view dataclasses (no SQLAlchemy, no FastAPI,
"now" is always passed in). The real backend enforces exactly the rules the frontend
shows and pre-validates; error messages match the mock API word for word.

Date/time model: dates are datetime.date, times are "HH:MM" strings in school local
time. Weekday numbers follow JavaScript getDay(): 1=Monday ... 5=Friday.
"""
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List, Optional, Tuple

MAX_TIMINGS = 4
MIN_STUDENTS = 1
MAX_STUDENTS = 30
DEFAULT_CAPACITY = 4
REASON_MIN = 10
REASON_MAX = 300

# How long before an office hour each reminder setting sends its reminder.
LEAD_MINUTES = {"30 minutes": 30, "1 hour": 60, "1 day": 1440}

# A check result: (ok, code, message) — code/message are "" when ok.
Check = Tuple[bool, str, str]


def ok() -> Check:
    return (True, "", "")


def fail(code: str, message: str) -> Check:
    return (False, code, message)


# ---------------------------------------------------------------- views

@dataclass
class TimingView:
    key: str            # frontend timing id
    name: str
    start: str          # "HH:MM"
    end: str            # "HH:MM"
    days: List[int]
    gone: bool = False


@dataclass
class TeacherView:
    id: str
    name: str
    subject: str
    group: str
    capacity: int  # students per office hour
    timings: List[TimingView] = field(default_factory=list)
    days_off: List[date] = field(default_factory=list)  # sorted


@dataclass
class BookingView:
    id: str
    teacher_id: str
    date: date
    timing_key: str
    timing: Optional[TimingView]  # resolved; None only if the timing row is missing
    student_id: str
    student_name: str
    reason: str
    status: str  # confirmed | cancelled


@dataclass
class World:
    teachers: List[TeacherView]
    bookings: List[BookingView]


# ---------------------------------------------------------------- date/time helpers (dates.ts)

DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December"]
MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def js_dow(d: date) -> int:
    """JavaScript getDay(): 0=Sunday ... 6=Saturday."""
    return (d.weekday() + 1) % 7


def hhmm(t) -> str:
    """datetime.time -> "HH:MM"."""
    return "%02d:%02d" % (t.hour, t.minute)


def parse_hhmm(s: str):
    """"HH:MM" -> datetime.time."""
    from datetime import time as dtime

    h, m = s.split(":")
    return dtime(int(h), int(m))


def valid_hhmm(s: str) -> bool:
    if not isinstance(s, str) or len(s) != 5 or s[2] != ":":
        return False
    try:
        h, m = int(s[0:2]), int(s[3:5])
    except ValueError:
        return False
    return 0 <= h <= 23 and 0 <= m <= 59


def combine(d: date, time_str: str) -> datetime:
    h, m = time_str.split(":")
    return datetime(d.year, d.month, d.day, int(h), int(m))


def format_time(time_str: str) -> str:
    """"12:10" -> "12:10 PM"."""
    h, m = time_str.split(":")
    h = int(h)
    return "%d:%02d %s" % (h % 12 or 12, int(m), "PM" if h >= 12 else "AM")


def format_range(start: str, end: str) -> str:
    """"12:10" / "12:40" -> "12:10 – 12:40 PM" (drops the first AM/PM when both match)."""
    a = format_time(start)
    b = format_time(end)
    if a[-2:] == b[-2:]:
        a = a[:-3]
    return "%s – %s" % (a, b)


def format_date_long(d: date) -> str:
    """-> "Thursday, October 15"."""
    return "%s, %s %d" % (DOW_LONG[js_dow(d)], MONTH_LONG[d.month - 1], d.day)


def format_date_short(d: date) -> str:
    """-> "Thu, Oct 15"."""
    return "%s, %s %d" % (DOW_SHORT[js_dow(d)], MONTH_SHORT[d.month - 1], d.day)


# ---------------------------------------------------------------- lookups

def find_teacher(w: World, teacher_id: str) -> Optional[TeacherView]:
    return next((t for t in w.teachers if t.id == teacher_id), None)


def is_off(t: TeacherView, d: date) -> bool:
    return d in t.days_off


def has_started(d: date, start: str, now: datetime) -> bool:
    return combine(d, start) <= now


def runs_on(timing: TimingView, d: date) -> bool:
    return js_dow(d) in timing.days


def is_confirmed(b: BookingView) -> bool:
    return b.status == "confirmed"


def upcoming_bookings(w: World, pick, now: datetime) -> List[BookingView]:
    out = []
    for b in w.bookings:
        if not (is_confirmed(b) and pick(b)) or b.timing is None:
            continue
        if not has_started(b.date, b.timing.start, now):
            out.append(b)
    out.sort(key=lambda b: (b.date.isoformat(), b.timing.start if b.timing else ""))
    return out


def past_bookings(w: World, pick, now: datetime) -> List[BookingView]:
    out = []
    for b in w.bookings:
        if not pick(b):
            continue
        started = b.timing is None or has_started(b.date, b.timing.start, now)
        if b.status == "cancelled" or started:
            out.append(b)
    out.sort(key=lambda b: (b.date.isoformat(), b.timing.start if b.timing else ""), reverse=True)
    return out


# ---------------------------------------------------------------- booking a spot

def conflicting_booking(w: World, student_id: str, d: date, timing: TimingView,
                        teacher_id: str) -> Optional[BookingView]:
    for b in w.bookings:
        if b.student_id != student_id or not is_confirmed(b) or b.date != d:
            continue
        if b.teacher_id == teacher_id and b.timing_key == timing.key:
            continue
        other = b.timing
        if other and other.start < timing.end and timing.start < other.end:
            return b
    return None


def check_booking(w: World, teacher_id: str, d: date, timing_key: str,
                  student_id: str, now: datetime) -> Check:
    t = find_teacher(w, teacher_id)
    x = next((y for y in t.timings if y.key == timing_key), None) if t else None
    if not t or not x or not runs_on(x, d):
        return fail("no_office_hour", "That office hour does not exist.")
    if is_off(t, d):
        return fail("day_off", "%s is out on %s." % (t.name, format_date_long(d)))
    if has_started(d, x.start, now):
        return fail("past", "That office hour has already started. Pick a later one.")
    taken = sum(
        1 for b in w.bookings
        if b.teacher_id == t.id and b.date == d and b.timing_key == x.key and is_confirmed(b)
    )
    if taken >= t.capacity:
        return fail("full", "That office hour is full. Pick another one.")
    mine = next(
        (b for b in w.bookings
         if b.student_id == student_id and is_confirmed(b) and b.teacher_id == t.id
         and b.date == d and b.timing_key == x.key),
        None,
    )
    if mine:
        return fail("already_booked", "You already have a booking in this office hour.")
    clash = conflicting_booking(w, student_id, d, x, t.id)
    if clash:
        other = find_teacher(w, clash.teacher_id)
        return fail("conflict",
                    "You are already booked at that time with %s." % (other.name if other else "another teacher"))
    return ok()


def check_booking_reason(text: str) -> Check:
    n = len(text.strip())
    if n < REASON_MIN:
        return fail("reason",
                    "Tell your teacher a little more about what you need (at least %d characters)." % REASON_MIN)
    if n > REASON_MAX:
        return fail("reason", "Keep the reason under %d characters." % REASON_MAX)
    return ok()


# ---------------------------------------------------------------- request a different time

def check_request(w: World, teacher_id: str, d: Optional[date], time_str: Optional[str],
                  reason: str, now: datetime) -> Check:
    t = find_teacher(w, teacher_id)
    if not t:
        return fail("not_found", "That teacher no longer exists.")
    if d is None:
        return fail("missing", "Choose a date.")
    if not time_str:
        return fail("missing", "Choose a time.")
    if combine(d, time_str) <= now:
        return fail("past", "Choose a time that hasn\u2019t passed.")
    if is_off(t, d):
        return fail("day_off",
                    "%s is out on %s. Choose another day." % (t.name, format_date_long(d)))
    if len(reason.strip()) < REASON_MIN:
        return fail("reason",
                    "Tell %s why you need this time (at least %d characters)." % (t.name, REASON_MIN))
    return ok()


def check_accept(w: World, teacher_id: str, d: date, time_str: str, now: datetime) -> Check:
    t = find_teacher(w, teacher_id)
    if not t:
        return fail("not_found", "That teacher no longer exists.")
    if combine(d, time_str) <= now:
        return fail("past", "That time has already passed.")
    if is_off(t, d):
        return fail("day_off", "You are out on %s." % format_date_long(d))
    return ok()


# ---------------------------------------------------------------- capacity per office hour

def min_capacity(w: World, teacher_id: str, now: datetime) -> int:
    """The most students booked in any single upcoming office hour: capacity cannot drop below this."""
    m = MIN_STUDENTS
    counts = {}
    for b in upcoming_bookings(w, lambda x: x.teacher_id == teacher_id, now):
        key = (b.date, b.timing_key)
        counts[key] = counts.get(key, 0) + 1
        if counts[key] > m:
            m = counts[key]
    return m


# ---------------------------------------------------------------- saving office hours

def validate_hours(drafts: List[TimingView]) -> str:
    """The first problem with the timings, in the order the editor reports them, or '' when valid."""
    if not drafts:
        return "Add at least one timing so students can book you."
    seen = set()
    for n in drafts:
        name = n.name.strip()
        if not name:
            return "Give each timing a name. Click \u201cName this timing\u201d to type one."
        if name.lower() in seen:
            return "Two timings are called \u201c%s\u201d. Give each its own name." % name
        seen.add(name.lower())
        if not n.start or not n.end:
            return "Set a start and an end time for %s." % name
        if n.start >= n.end:
            return "%s: the end time must be after the start time." % name
        if not n.days:
            return "%s has no days. Pick at least one day, or remove it." % name
    for i in range(len(drafts)):
        for j in range(i + 1, len(drafts)):
            a, b = drafts[i], drafts[j]
            shared = next((d for d in a.days if d in b.days), None)
            if shared is not None and a.start < b.end and b.start < a.end:
                return "%s and %s overlap on %s. Change a time or a day." % (
                    a.name.strip(), b.name.strip(), DOW_LONG[shared])
    return ""


def check_hours(w: World, teacher_id: str, drafts: List[TimingView], max_students: int,
                now: datetime) -> Check:
    if len(drafts) > MAX_TIMINGS:
        return fail("invalid", "You can have up to %d timings." % MAX_TIMINGS)
    problem = validate_hours(drafts)
    if problem:
        return fail("invalid", problem)
    if not isinstance(max_students, int) or isinstance(max_students, bool) \
            or max_students < MIN_STUDENTS or max_students > MAX_STUDENTS:
        return fail("invalid", "Students per office hour must be between %d and %d." % (MIN_STUDENTS, MAX_STUDENTS))
    floor = min_capacity(w, teacher_id, now)
    if max_students < floor:
        return fail("seat_floor",
                    "That office hour already has %d students booked, so capacity cannot go below %d." % (floor, floor))
    return ok()


def orphaned_bookings(w: World, teacher_id: str, drafts: List[TimingView],
                      now: datetime) -> List[BookingView]:
    """Upcoming bookings that would no longer match an office hour after the save (excluding days off)."""
    t = find_teacher(w, teacher_id)
    if not t:
        return []
    out = []
    for b in upcoming_bookings(w, lambda x: x.teacher_id == teacher_id, now):
        x = next((y for y in drafts if y.key == b.timing_key), None)
        if (x is None or js_dow(b.date) not in x.days) and not is_off(t, b.date):
            out.append(b)
    return out


def hours_notices(w: World, teacher: TeacherView, drafts: List[TimingView],
                  now: datetime) -> List[Tuple[str, str]]:
    """Who to tell about a schedule change, and what to say: (student_id, text) per affected booking."""
    out: List[Tuple[str, str]] = []
    for x in [y for y in teacher.timings if not y.gone]:
        n = next((y for y in drafts if y.key == x.key), None)
        changed = n is not None and (x.start != n.start or x.end != n.end or x.name != n.name.strip())
        affected = [
            b for b in w.bookings
            if b.teacher_id == teacher.id and b.timing_key == x.key and is_confirmed(b)
            and not has_started(b.date, x.start, now)
        ]
        for b in affected:
            if n is None:
                out.append((b.student_id,
                            "%s stopped holding %s. Your booking on %s needs a new time." % (
                                teacher.name, x.name, format_date_short(b.date))))
            elif js_dow(b.date) not in n.days:
                out.append((b.student_id,
                            "%s no longer holds %s on %s. Cancel your booking and pick another time." % (
                                teacher.name, n.name.strip(), format_date_short(b.date))))
            elif changed:
                out.append((b.student_id,
                            "%s moved %s to %s. Your booking on %s still stands." % (
                                teacher.name, n.name.strip(), format_range(n.start, n.end),
                                format_date_short(b.date))))
    return out


def apply_timings(current: List[TimingView], drafts: List[TimingView]) -> List[TimingView]:
    """The teacher's timings after a save. A removed timing is kept with no days, so old bookings still resolve."""
    out: List[TimingView] = []
    for x in current:
        n = next((y for y in drafts if y.key == x.key), None)
        if n is None:
            out.append(TimingView(key=x.key, name=x.name, start=x.start, end=x.end, days=[], gone=True))
        else:
            out.append(TimingView(key=x.key, name=n.name.strip(), start=n.start, end=n.end,
                                  days=sorted(n.days), gone=False))
    for n in drafts:
        if not any(x.key == n.key for x in current):
            out.append(TimingView(key=n.key, name=n.name.strip(), start=n.start, end=n.end,
                                  days=sorted(n.days), gone=False))
    return out


# ---------------------------------------------------------------- days off

def check_day_off(t: TeacherView, d: Optional[date], now: datetime) -> Check:
    if d is None:
        return fail("missing", "Choose a date.")
    if d < now.date():
        return fail("past", "That date has passed. Choose today or a later day.")
    if is_off(t, d):
        return fail("duplicate_day_off", "%s is already a day off." % format_date_long(d))
    return ok()


def affected_on(w: World, teacher_id: str, d: date, now: datetime) -> List[BookingView]:
    """Upcoming confirmed bookings on a date that a day off would affect."""
    return [
        b for b in w.bookings
        if b.teacher_id == teacher_id and b.date == d and is_confirmed(b) and b.timing is not None
        and not has_started(b.date, b.timing.start, now)
    ]
