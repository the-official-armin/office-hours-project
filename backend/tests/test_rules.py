"""Rule engine tests — the backend mirror of frontend-teacher/src/lib/rules.test.ts.

Fixed clock: Monday 2026-11-02 09:00 local. Tuesday = 11-03, Thursday = 11-05.
"""
from datetime import date, datetime

import pytest

from app import rules

NOW = datetime(2026, 11, 2, 9, 0)  # Monday morning
TUE = date(2026, 11, 3)
THU = date(2026, 11, 5)
WED = date(2026, 11, 4)
FRI = date(2026, 11, 6)
PAST_TUE = date(2026, 10, 28)  # last week, also a Tuesday


def timing(key="lunch", name="Lunch", start="12:10", end="12:40", days=(2, 4), gone=False):
    return rules.TimingView(key=key, name=name, start=start, end=end, days=list(days), gone=gone)


def teacher(timings=None, days_off=(), capacity=4, tid="rivera", name="Ms. Rivera"):
    return rules.TeacherView(
        id=tid, name=name, subject="Mathematics", group="Math",
        capacity=capacity,
        timings=timings if timings is not None else [timing()],
        days_off=list(days_off),
    )


def booking(tid="rivera", d=TUE, key="lunch", sid="maya", sname="Maya K.",
            reason="Review homework problems 12–18.", status="confirmed",
            timing_view=None):
    tv = timing_view if timing_view is not None else timing()
    return rules.BookingView(id="b1", teacher_id=tid, date=d, timing_key=key,
                             timing=tv, student_id=sid,
                             student_name=sname, reason=reason, status=status)


def world(teachers=None, bookings=()):
    return rules.World(teachers=teachers if teachers is not None else [teacher()],
                       bookings=list(bookings))


# ---------------------------------------------------------------- date formatting

def test_js_dow_monday_is_1():
    assert rules.js_dow(date(2026, 11, 2)) == 1
    assert rules.js_dow(date(2026, 11, 1)) == 0  # Sunday
    assert rules.js_dow(date(2026, 11, 7)) == 6  # Saturday


def test_format_time():
    assert rules.format_time("12:10") == "12:10 PM"
    assert rules.format_time("15:30") == "3:30 PM"
    assert rules.format_time("00:05") == "12:05 AM"


def test_format_range_drops_shared_meridiem():
    assert rules.format_range("12:10", "12:40") == "12:10 – 12:40 PM"
    assert rules.format_range("11:30", "12:40") == "11:30 AM – 12:40 PM"


def test_format_dates():
    assert rules.format_date_long(TUE) == "Tuesday, November 3"
    assert rules.format_date_short(TUE) == "Tue, Nov 3"


# ---------------------------------------------------------------- check_booking

def test_booking_happy_path():
    assert rules.check_booking(world(), "rivera", TUE, "lunch", "daniel", NOW)[0]


def test_booking_unknown_timing():
    c = rules.check_booking(world(), "rivera", TUE, "nope", "daniel", NOW)
    assert c[1] == "no_office_hour"


def test_booking_wrong_weekday():
    c = rules.check_booking(world(), "rivera", WED, "lunch", "daniel", NOW)
    assert c[1] == "no_office_hour"


def test_booking_day_off():
    w = world(teachers=[teacher(days_off=[TUE])])
    c = rules.check_booking(w, "rivera", TUE, "lunch", "daniel", NOW)
    assert c[1] == "day_off"
    assert "Ms. Rivera is out on Tuesday, November 3." == c[2]


def test_booking_already_started():
    afternoon = datetime(2026, 11, 3, 12, 30)
    c = rules.check_booking(world(), "rivera", TUE, "lunch", "daniel", afternoon)
    assert c[1] == "past"


def test_booking_full():
    # Four students already hold the four spots in Tuesday's Lunch.
    full = [booking(sid=s) for s in ("daniel", "priya", "ethan", "hana")]
    c = rules.check_booking(world(bookings=full), "rivera", TUE, "lunch", "maya", NOW)
    assert c[1] == "full"
    # A cancelled booking frees its spot.
    freed = [booking(sid="daniel", status="cancelled")] + full[1:]
    assert rules.check_booking(world(bookings=freed), "rivera", TUE, "lunch", "maya", NOW)[0]


def test_booking_already_booked():
    mine = booking(sid="maya")
    w = world(bookings=[mine])
    c = rules.check_booking(w, "rivera", TUE, "lunch", "maya", NOW)
    assert c[1] == "already_booked"
    assert c[2] == "You already have a booking in this office hour."


def test_booking_conflict_with_overlapping_hour():
    other_timing = timing(key="after", name="After school", start="12:30", end="13:00", days=(2, 4))
    other_teacher = teacher(timings=[other_timing], tid="okafor", name="Mr. Okafor")
    clash = booking(tid="okafor", key="after", sid="maya", timing_view=other_timing)
    w = world(teachers=[teacher(), other_teacher], bookings=[clash])
    c = rules.check_booking(w, "rivera", TUE, "lunch", "maya", NOW)
    assert c[1] == "conflict"
    assert "Mr. Okafor" in c[2]


def test_booking_reason_length():
    assert rules.check_booking_reason("123456789")[1] == "reason"
    assert rules.check_booking_reason("x" * 301)[1] == "reason"
    assert rules.check_booking_reason("1234567890")[0]


# ---------------------------------------------------------------- requests

def test_request_happy_path():
    w = world()
    assert rules.check_request(w, "rivera", TUE, "15:45", "Need extra time.", NOW)[0]


def test_request_past_time():
    tuesday_morning = datetime(2026, 11, 3, 9, 0)
    c = rules.check_request(world(), "rivera", TUE, "08:00", "Need extra time.", tuesday_morning)
    assert c[1] == "past"


def test_request_day_off():
    w = world(teachers=[teacher(days_off=[TUE])])
    c = rules.check_request(w, "rivera", TUE, "15:45", "Need extra time.", NOW)
    assert c[1] == "day_off"


def test_request_short_reason():
    c = rules.check_request(world(), "rivera", TUE, "15:45", "short", NOW)
    assert c[1] == "reason"
    assert "Ms. Rivera" in c[2]


def test_accept_past_and_day_off():
    w = world(teachers=[teacher(days_off=[THU])])
    tuesday_morning = datetime(2026, 11, 3, 9, 0)
    assert rules.check_accept(w, "rivera", TUE, "08:00", tuesday_morning)[1] == "past"
    assert rules.check_accept(w, "rivera", THU, "15:45", NOW)[1] == "day_off"


# ---------------------------------------------------------------- capacity

def test_min_capacity_is_the_busiest_upcoming_slot():
    bookings = [
        booking(d=TUE, sid="maya"),
        booking(d=TUE, sid="daniel"),
        booking(d=TUE, sid="priya"),
        booking(d=THU, sid="ethan"),
        booking(d=PAST_TUE, sid="hana"),
        booking(d=TUE, sid="noor", status="cancelled"),
    ]
    w = world(bookings=bookings)
    assert rules.min_capacity(w, "rivera", NOW) == 3
    assert rules.min_capacity(world(), "rivera", NOW) == 1


def test_validate_hours_empty():
    assert "Add at least one timing" in rules.validate_hours([])


def test_validate_hours_overlap():
    a = timing(key="a", name="Early", start="12:00", end="13:00", days=(2,))
    b = timing(key="b", name="Late", start="12:30", end="13:30", days=(2,))
    problem = rules.validate_hours([a, b])
    assert "overlap on Tuesday" in problem


def test_check_hours_capacity_floor():
    held = [booking(d=TUE, sid="daniel"), booking(d=TUE, sid="priya"),
            booking(d=TUE, sid="ethan")]
    w = world(bookings=held)
    c = rules.check_hours(w, "rivera", [timing()], 2, NOW)
    assert c[1] == "seat_floor"
    assert "3 students booked" in c[2]
    assert rules.check_hours(w, "rivera", [timing()], 3, NOW)[0]


def test_check_hours_capacity_range():
    assert rules.check_hours(world(), "rivera", [timing()], 0, NOW)[1] == "invalid"
    assert rules.check_hours(world(), "rivera", [timing()], 31, NOW)[1] == "invalid"


def test_apply_timings_keeps_removed_as_gone():
    current = [timing(), timing(key="after", name="After school", start="15:30", end="16:00")]
    drafts = [timing(days=(2,))]  # 'after' removed
    out = rules.apply_timings(current, drafts)
    assert len(out) == 2
    gone = next(x for x in out if x.key == "after")
    assert gone.gone and gone.days == []


def test_orphaned_bookings_when_day_dropped():
    b = booking(d=WED)  # Wednesday: no draft day covers it
    w = world(bookings=[b])
    drafts = [timing(days=(2, 4))]
    assert len(rules.orphaned_bookings(w, "rivera", drafts, NOW)) == 1
    drafts = [timing(days=(2, 3, 4))]
    assert len(rules.orphaned_bookings(w, "rivera", drafts, NOW)) == 0


def test_hours_notices_stopped_holding():
    after = timing(key="after", name="After school", start="15:30", end="16:00")
    current = [timing(), after]
    b = booking(key="after", d=THU, sid="maya", timing_view=after)
    t = teacher(timings=current)
    w = world(teachers=[t], bookings=[b])
    notices = rules.hours_notices(w, t, [timing()], NOW)  # 'after' removed
    assert len(notices) == 1
    assert "stopped holding After school" in notices[0][1]


# ---------------------------------------------------------------- days off

def test_check_day_off_past_and_duplicate():
    t = teacher(days_off=[THU])
    assert rules.check_day_off(t, date(2026, 11, 1), NOW)[1] == "past"
    assert rules.check_day_off(t, THU, NOW)[1] == "duplicate_day_off"
    assert rules.check_day_off(t, FRI, NOW)[0]


def test_affected_on_only_upcoming():
    upcoming = booking(d=FRI, sid="maya")
    past = booking(d=PAST_TUE, sid="daniel")
    w = world(bookings=[upcoming, past])
    assert [b.student_id for b in rules.affected_on(w, "rivera", FRI, NOW)] == ["maya"]
