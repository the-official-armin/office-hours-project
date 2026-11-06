"""API integration tests against a seeded in-memory database.

The seed builds dates from *today*, so tests compute the same dates the seeder used
(tomorrow-onward Tue/Thu etc.) instead of hardcoding them.

Fixtures (conftest.py): `student` is signed in as Maya, `teacher` as Ms. Rivera, `client` is
not signed in, and `signed_in(id, role)` makes a client for anyone else.
"""
from datetime import date, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app import rules
from app.models import Booking
from app.seed import ME_STUDENT, fwd

T0 = date.today()
NEXT_TUE = fwd(T0, [2], 1)[0]
NEXT_THU = fwd(T0, [4], 1)[0]
NEXT_FRI = fwd(T0, [5], 1)[0]
NEXT_MON = fwd(T0, [1], 1)[0]
RIVR3 = fwd(T0, [2, 4], 12)[3]  # a Rivera Thursday that is seeded as a day off
REASON = "Need help with integrals and derivatives."


# ---------------------------------------------------------------- health & profile

def test_healthz(client):
    assert client.get("/healthz").json() == {"status": "ok"}


def test_teacher_login_and_me(client):
    res = client.post("/auth/login", json={
        "role": "teacher", "userId": "rivera", "password": "demo-password",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["tokenType"] == "bearer"
    assert body["user"] == {"id": "rivera", "role": "teacher", "name": "Ms. Rivera"}
    me = client.get("/auth/me", headers={"Authorization": "Bearer " + body["accessToken"]})
    assert me.status_code == 200
    assert me.json() == body["user"]


def test_second_demo_student_can_log_in(client):
    res = client.post("/auth/login", json={
        "role": "student", "userId": "alex", "password": "demo-password",
    })
    assert res.status_code == 200
    assert res.json()["user"]["name"] == "Alex R."


def test_login_rejects_bad_password(client):
    res = client.post("/auth/login", json={
        "role": "student", "userId": "maya", "password": "wrong",
    })
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_credentials"


def test_teacher_profile(teacher):
    body = teacher.get("/teacher/profile").json()
    assert body["id"] == "rivera"
    assert body["name"] == "Ms. Rivera"
    assert body["max"] == 4
    keys = [t["id"] for t in body["timings"]]
    assert keys == ["lunch", "after"]
    assert body["timings"][0]["days"] == [2, 4]
    assert len(body["daysOff"]) == 3


def test_teachers_list(client):
    # Public: the sign-in screens and "Find a teacher" read it.
    body = client.get("/teachers").json()
    assert len(body) == 6
    assert {t["group"] for t in body} >= {"Math", "Science", "Languages"}


# ---------------------------------------------------------------- who is signed in

@pytest.mark.parametrize("method, path", [
    ("get", "/teacher/profile"),
    ("get", "/teacher/settings"),
    ("get", "/student/settings"),
    ("get", "/bookings?view=student"),
    ("get", "/requests?view=teacher"),
    ("get", "/notifications?view=student"),
    ("post", "/notifications/read-all?view=teacher"),
    ("get", "/auth/me"),
])
def test_endpoints_need_a_token(client, method, path):
    res = getattr(client, method)(path)
    assert res.status_code == 401
    assert res.json()["code"] == "unauthorized"


def test_bad_or_expired_token_is_401(client):
    res = client.get("/student/settings", headers={"Authorization": "Bearer not-a-token"})
    assert res.status_code == 401
    assert res.json()["code"] == "unauthorized"


def test_answers_for_whoever_signed_in(signed_in):
    daniel = signed_in("daniel", "student")
    assert daniel.get("/student/settings").json()["name"] == "Daniel O."
    mine = daniel.get("/bookings?view=student").json()
    assert mine and all(b["studentId"] == "daniel" for b in mine)

    okafor = signed_in("okafor", "teacher")
    assert okafor.get("/teacher/profile").json()["name"] == "Mr. Okafor"
    assert all(b["teacherId"] == "okafor" for b in okafor.get("/bookings?view=teacher").json())


@pytest.mark.parametrize("method, path", [
    ("get", "/teacher/profile"),
    ("put", "/teacher/schedule"),
    ("post", "/teacher/days-off"),
    ("get", "/bookings?view=teacher"),
    ("get", "/requests?view=teacher"),
    ("get", "/notifications?view=teacher"),
    ("post", "/requests/1/answer"),
])
def test_students_cannot_use_teacher_endpoints(student, method, path):
    kwargs = {} if method == "get" else {"json": {}}
    res = getattr(student, method)(path, **kwargs)
    assert res.status_code == 403
    assert res.json()["code"] == "forbidden"


@pytest.mark.parametrize("method, path", [
    ("get", "/student/settings"),
    ("post", "/bookings"),
    ("delete", "/bookings/1"),
    ("post", "/requests"),
    ("get", "/bookings?view=student"),
    ("get", "/bookings?view=open"),
    ("get", "/requests?view=student"),
    ("get", "/notifications?view=student"),
])
def test_teachers_cannot_use_student_endpoints(teacher, method, path):
    kwargs = {"json": {}} if method == "post" else {}
    res = getattr(teacher, method)(path, **kwargs)
    assert res.status_code == 403
    assert res.json()["code"] == "forbidden"


def test_cannot_cancel_someone_elses_booking(student, signed_in):
    daniel = signed_in("daniel", "student")
    his = next(b for b in daniel.get("/bookings?view=student").json() if b["status"] == "confirmed")
    assert student.delete("/bookings/%s" % his["id"]).status_code == 404


# ---------------------------------------------------------------- booking flow

def _book(client, teacher="rivera", date=NEXT_TUE, timing="lunch", reason=REASON):
    return client.post("/bookings", json={
        "teacherId": teacher, "date": date.isoformat(), "timingId": timing,
        "reason": reason,
    })


def test_book_happy_path(student):
    # Next Thursday's Lunch: two students booked, Maya holds nothing there.
    res = _book(student, date=NEXT_THU)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "confirmed"
    assert body["studentId"] == ME_STUDENT
    assert body["studentName"] == "Maya K."
    assert body["timingId"] == "lunch"
    assert "seat" not in body
    assert body["createdAt"]


def test_booking_date_filter_is_inclusive(student):
    body = student.get(
        "/bookings",
        params={"view": "student", "from": NEXT_TUE.isoformat(), "to": NEXT_TUE.isoformat()},
    ).json()
    assert body
    assert all(item["date"] == NEXT_TUE.isoformat() for item in body)
    assert student.get(
        "/bookings",
        params={"view": "student", "from": NEXT_TUE.isoformat(), "to": (NEXT_TUE - timedelta(days=1)).isoformat()},
    ).json()["code"] == "invalid"


def test_book_full(student):
    # Seed puts four students in Ms. Brooks's first upcoming Lunch (capacity 4).
    res = _book(student, teacher="brooks")
    assert res.status_code == 409
    assert res.json()["code"] == "full"


def test_book_already_booked(student):
    # Maya already holds a spot in Rivera's first upcoming Lunch.
    res = _book(student, reason="Trying for a second spot here.")
    assert res.status_code == 409
    assert res.json()["code"] == "already_booked"


def test_database_allows_one_confirmed_booking_per_office_hour(db):
    # The last line of defence when two identical requests race past the rule check.
    mine = db.query(Booking).filter(Booking.student_id == ME_STUDENT, Booking.status == "confirmed").first()
    db.add(Booking(teacher_id=mine.teacher_id, timing_id=mine.timing_id, date=mine.date,
                   student_id=ME_STUDENT, reason=REASON, status="confirmed"))
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()
    # A cancelled duplicate is fine.
    db.add(Booking(teacher_id=mine.teacher_id, timing_id=mine.timing_id, date=mine.date,
                   student_id=ME_STUDENT, reason=REASON, status="cancelled"))
    db.flush()


def test_book_day_off(student):
    res = _book(student, date=RIVR3)  # RIVR3 is a seeded Rivera day off
    assert res.status_code == 409
    assert res.json()["code"] == "day_off"


def test_book_bad_inputs(student):
    assert _book(student, reason="short").json()["code"] == "reason"
    res = _book(student, timing="nope")
    assert res.json()["code"] == "no_office_hour"


def test_cancel_booking_flow(student):
    mine = student.get("/bookings?view=student").json()
    upcoming = next(b for b in mine if b["teacherId"] == "rivera" and b["status"] == "confirmed"
                    and b["date"] == NEXT_TUE.isoformat())
    assert student.delete("/bookings/%s" % upcoming["id"]).status_code == 204
    # The spot is open again.
    assert _book(student).status_code == 200
    # Cancelling twice is a 404.
    assert student.delete("/bookings/%s" % upcoming["id"]).status_code == 404


def test_open_bookings_hide_other_students(student):
    body = student.get("/bookings?view=open").json()
    others = [b for b in body if b["studentId"] != ME_STUDENT]
    mine = [b for b in body if b["studentId"] == ME_STUDENT]
    assert others and mine
    assert all(b["studentName"] == "" and b["reason"] == "" for b in others)
    assert all(b["studentName"] == "Maya K." for b in mine)
    assert all(b["status"] == "confirmed" for b in body)


def test_booking_notifies_teacher(student, teacher):
    _book(student, date=NEXT_THU)
    notes = teacher.get("/notifications?view=teacher").json()
    assert any("booked a spot in Lunch" in n["text"] for n in notes)


def test_request_date_filter_is_inclusive(teacher):
    body = teacher.get(
        "/requests",
        params={"view": "teacher", "from": NEXT_MON.isoformat(), "to": NEXT_MON.isoformat()},
    ).json()
    assert body
    assert all(item["date"] == NEXT_MON.isoformat() for item in body)


# ---------------------------------------------------------------- schedule

def test_save_hours_happy_path(teacher):
    res = teacher.put("/teacher/schedule", json={
        "timings": [
            {"id": "lunch", "name": "Lunch", "start": "12:10", "end": "12:40", "days": [2, 4]},
            {"id": "after", "name": "After school", "start": "15:30", "end": "16:00", "days": [2, 5]},
        ],
        "max": 6,
    })
    assert res.status_code == 200, res.text
    assert res.json()["orphaned"] >= 0
    me = teacher.get("/teacher/profile").json()
    after = next(t for t in me["timings"] if t["id"] == "after")
    assert after["days"] == [2, 5]
    assert me["max"] == 6


def test_save_hours_rejects_overlap(teacher):
    res = teacher.put("/teacher/schedule", json={
        "timings": [
            {"id": "lunch", "name": "Lunch", "start": "12:00", "end": "13:00", "days": [2]},
            {"id": "after", "name": "After school", "start": "12:30", "end": "13:30", "days": [2]},
        ],
        "max": 4,
    })
    assert res.status_code == 409
    assert res.json()["code"] == "invalid"
    assert "overlap" in res.json()["message"]


def test_save_hours_capacity_floor(teacher):
    # An upcoming office hour already has 4 students; capacity cannot drop below 4.
    res = teacher.put("/teacher/schedule", json={
        "timings": [
            {"id": "lunch", "name": "Lunch", "start": "12:10", "end": "12:40", "days": [2, 4]},
        ],
        "max": 3,
    })
    assert res.status_code == 409
    assert res.json()["code"] == "seat_floor"
    assert "4 students booked" in res.json()["message"]


def test_removed_timing_stays_as_gone(teacher):
    teacher.put("/teacher/schedule", json={
        "timings": [
            {"id": "lunch", "name": "Lunch", "start": "12:10", "end": "12:40", "days": [2, 4]},
        ],
        "max": 4,
    })
    me = teacher.get("/teacher/profile").json()
    after = next(t for t in me["timings"] if t["id"] == "after")
    assert after.get("gone") is True
    assert after["days"] == []
    # Old bookings still resolve.
    bookings = teacher.get("/bookings?view=teacher").json()
    assert any(b["timingId"] == "after" for b in bookings)


# ---------------------------------------------------------------- days off

def test_day_off_roundtrip(teacher):
    assert teacher.delete("/teacher/days-off/%s" % RIVR3.isoformat()).status_code == 204
    res = teacher.post("/teacher/days-off", json={"date": RIVR3.isoformat(), "reason": "Testing"})
    assert res.status_code == 200, res.text
    assert res.json()["dayOff"]["reason"] == "Testing"
    assert res.json()["affected"] == 1  # Tariq holds the spot that day
    dup = teacher.post("/teacher/days-off", json={"date": RIVR3.isoformat(), "reason": "Again"})
    assert dup.status_code == 409
    assert dup.json()["code"] == "duplicate_day_off"
    assert teacher.delete("/teacher/days-off/%s" % RIVR3.isoformat()).status_code == 204
    gone = teacher.delete("/teacher/days-off/%s" % RIVR3.isoformat())
    assert gone.status_code == 404


def test_day_off_past_date(teacher):
    res = teacher.post("/teacher/days-off", json={"date": (T0 - timedelta(days=2)).isoformat()})
    assert res.status_code == 409
    assert res.json()["code"] == "past"


# ---------------------------------------------------------------- requests

def test_request_flow_answer(teacher):
    requests = teacher.get("/requests?view=teacher").json()
    pending = {r["studentName"]: r for r in requests if r["status"] == "pending"}
    assert {"Aiden P.", "Sofia L.", "Marcus T."} <= set(pending)

    aiden = pending["Aiden P."]
    res = teacher.post("/requests/%s/answer" % aiden["id"], json={"answer": "accepted"})
    assert res.status_code == 200
    assert res.json()["status"] == "accepted"
    assert "accepted this time." in res.json()["note"]

    marcus = pending["Marcus T."]
    res = teacher.post("/requests/%s/answer" % marcus["id"], json={"answer": "declined"})
    assert res.status_code == 200
    assert res.json()["status"] == "declined"

    # Answering twice is a 404.
    again = teacher.post("/requests/%s/answer" % aiden["id"], json={"answer": "accepted"})
    assert again.status_code == 404


def test_cannot_answer_another_teachers_request(teacher, signed_in):
    okafor = signed_in("okafor", "teacher")
    pending = next(r for r in teacher.get("/requests?view=teacher").json() if r["status"] == "pending")
    res = okafor.post("/requests/%s/answer" % pending["id"], json={"answer": "accepted"})
    assert res.status_code == 404


def test_answer_requires_valid_value(teacher):
    requests = teacher.get("/requests?view=teacher").json()
    pending = next(r for r in requests if r["status"] == "pending")
    res = teacher.post("/requests/%s/answer" % pending["id"], json={"answer": "maybe"})
    assert res.status_code == 409
    assert res.json()["code"] == "invalid"


def test_student_request_flow(student):
    mine = student.get("/requests?view=student").json()
    assert {r["status"] for r in mine} == {"pending", "accepted", "declined"}
    pending = next(r for r in mine if r["status"] == "pending")
    assert student.delete("/requests/%s" % pending["id"]).status_code == 204
    assert student.delete("/requests/%s" % pending["id"]).status_code == 404


def test_student_sends_request(student, teacher):
    res = student.post("/requests", json={
        "teacherId": "rivera", "date": NEXT_MON.isoformat(), "time": "15:45",
        "reason": "Can we review my quiz retake plan together?",
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "pending"
    assert body["note"] == ""
    # The teacher got a notification.
    notes = teacher.get("/notifications?view=teacher").json()
    assert any("Maya K. sent a request for" in n["text"] for n in notes)


def test_send_request_rules(student):
    res = student.post("/requests", json={
        "teacherId": "rivera", "date": RIVR3.isoformat(), "time": "15:45",
        "reason": "Want to meet despite the day off.",
    })
    assert res.json()["code"] == "day_off"
    res = student.post("/requests", json={
        "teacherId": "rivera", "date": NEXT_FRI.isoformat(), "time": "15:45", "reason": "too short",
    })
    assert res.json()["code"] == "reason"


# ---------------------------------------------------------------- settings & notifications

def test_teacher_settings_roundtrip(teacher):
    body = teacher.get("/teacher/settings").json()
    assert body["name"] == "Ms. Rivera"
    body["email"] = "rivera@school.edu"
    body["morning"] = True
    res = teacher.put("/teacher/settings", json=body)
    assert res.status_code == 200
    assert res.json()["email"] == "rivera@school.edu"
    assert teacher.get("/teacher/settings").json()["morning"] is True


def test_settings_validation(teacher, student):
    bad = teacher.get("/teacher/settings").json()
    bad["name"] = "   "
    res = teacher.put("/teacher/settings", json=bad)
    assert res.status_code == 409
    assert res.json()["code"] == "invalid"

    bad["name"] = "Ms. Rivera"
    bad["email"] = "not-an-email"
    res = teacher.put("/teacher/settings", json=bad)
    assert res.status_code == 409
    assert res.json()["code"] == "invalid"

    sbad = student.get("/student/settings").json()
    sbad["email"] = "nope"
    res = student.put("/student/settings", json=sbad)
    assert res.json()["code"] == "invalid"


def test_notifications_read_all(teacher, student):
    notes = teacher.get("/notifications?view=teacher").json()
    assert len(notes) >= 3
    assert any(not n["read"] for n in notes)
    assert teacher.post("/notifications/read-all?view=teacher").status_code == 204
    assert all(n["read"] for n in teacher.get("/notifications?view=teacher").json())

    student_notes = student.get("/notifications?view=student").json()
    assert len(student_notes) >= 2


def test_error_shape(student):
    res = _book(student, teacher="brooks")
    body = res.json()
    assert set(body.keys()) == {"code", "message"}


# ---------------------------------------------------------------- deployment settings

def test_cors_allows_localhost_in_development(client):
    res = client.options("/teacher/profile", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
    res = client.options("/teacher/profile", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "GET",
    })
    assert "access-control-allow-origin" not in res.headers


def test_now_local_uses_school_time_zone(monkeypatch):
    from datetime import datetime, timezone
    from zoneinfo import ZoneInfo

    from app import deps
    monkeypatch.setattr(deps, "SCHOOL_TZ", "Pacific/Kiritimati")  # UTC+14, never the test machine's zone
    expected = datetime.now(timezone.utc).astimezone(ZoneInfo("Pacific/Kiritimati")).replace(tzinfo=None)
    assert abs((deps.now_local() - expected).total_seconds()) < 5
