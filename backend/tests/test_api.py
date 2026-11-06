"""API integration tests against a seeded in-memory database.

The seed builds dates from *today*, so tests compute the same dates the seeder used
(tomorrow-onward Tue/Thu etc.) instead of hardcoding them.
"""
from datetime import date, timedelta

import pytest

from app import rules
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


def test_login_rejects_bad_password(client):
    res = client.post("/auth/login", json={
        "role": "student", "userId": "maya", "password": "wrong",
    })
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_credentials"


def test_teacher_profile(client):
    body = client.get("/teacher/profile").json()
    assert body["id"] == "rivera"
    assert body["name"] == "Ms. Rivera"
    assert body["max"] == 4
    keys = [t["id"] for t in body["timings"]]
    assert keys == ["lunch", "after"]
    assert body["timings"][0]["days"] == [2, 4]
    assert len(body["daysOff"]) == 3


def test_teachers_list(client):
    body = client.get("/teachers").json()
    assert len(body) == 6
    assert {t["group"] for t in body} >= {"Math", "Science", "Languages"}


# ---------------------------------------------------------------- booking flow

def _book(client, teacher="rivera", date=NEXT_TUE, timing="lunch", reason=REASON):
    return client.post("/bookings", json={
        "teacherId": teacher, "date": date.isoformat(), "timingId": timing,
        "reason": reason,
    })


def test_book_happy_path(client):
    # Next Thursday's Lunch: two students booked, Maya holds nothing there.
    res = _book(client, date=NEXT_THU)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "confirmed"
    assert body["studentId"] == ME_STUDENT
    assert body["studentName"] == "Maya K."
    assert body["timingId"] == "lunch"
    assert "seat" not in body


def test_book_full(client):
    # Seed puts four students in Ms. Brooks's first upcoming Lunch (capacity 4).
    res = _book(client, teacher="brooks")
    assert res.status_code == 409
    assert res.json()["code"] == "full"


def test_book_already_booked(client):
    # Maya already holds a spot in Rivera's first upcoming Lunch.
    res = _book(client, reason="Trying for a second spot here.")
    assert res.status_code == 409
    assert res.json()["code"] == "already_booked"


def test_book_day_off(client):
    res = _book(client, date=RIVR3)  # RIVR3 is a seeded Rivera day off
    assert res.status_code == 409
    assert res.json()["code"] == "day_off"


def test_book_bad_inputs(client):
    assert _book(client, reason="short").json()["code"] == "reason"
    res = _book(client, timing="nope")
    assert res.json()["code"] == "no_office_hour"


def test_cancel_booking_flow(client):
    mine = client.get("/bookings?view=student").json()
    upcoming = next(b for b in mine if b["teacherId"] == "rivera" and b["status"] == "confirmed"
                    and b["date"] == NEXT_TUE.isoformat())
    assert client.delete("/bookings/%s" % upcoming["id"]).status_code == 204
    # The spot is open again.
    assert _book(client).status_code == 200
    # Cancelling twice is a 404.
    assert client.delete("/bookings/%s" % upcoming["id"]).status_code == 404


def test_open_bookings_hide_other_students(client):
    body = client.get("/bookings?view=open").json()
    others = [b for b in body if b["studentId"] != ME_STUDENT]
    mine = [b for b in body if b["studentId"] == ME_STUDENT]
    assert others and mine
    assert all(b["studentName"] == "" and b["reason"] == "" for b in others)
    assert all(b["studentName"] == "Maya K." for b in mine)
    assert all(b["status"] == "confirmed" for b in body)


def test_booking_notifies_teacher(client):
    _book(client, date=NEXT_THU)
    notes = client.get("/notifications?view=teacher").json()
    assert any("booked a spot in Lunch" in n["text"] for n in notes)


# ---------------------------------------------------------------- schedule

def test_save_hours_happy_path(client):
    res = client.put("/teacher/schedule", json={
        "timings": [
            {"id": "lunch", "name": "Lunch", "start": "12:10", "end": "12:40", "days": [2, 4]},
            {"id": "after", "name": "After school", "start": "15:30", "end": "16:00", "days": [2, 5]},
        ],
        "max": 6,
    })
    assert res.status_code == 200, res.text
    assert res.json()["orphaned"] >= 0
    me = client.get("/teacher/profile").json()
    after = next(t for t in me["timings"] if t["id"] == "after")
    assert after["days"] == [2, 5]
    assert me["max"] == 6


def test_save_hours_rejects_overlap(client):
    res = client.put("/teacher/schedule", json={
        "timings": [
            {"id": "lunch", "name": "Lunch", "start": "12:00", "end": "13:00", "days": [2]},
            {"id": "after", "name": "After school", "start": "12:30", "end": "13:30", "days": [2]},
        ],
        "max": 4,
    })
    assert res.status_code == 409
    assert res.json()["code"] == "invalid"
    assert "overlap" in res.json()["message"]


def test_save_hours_capacity_floor(client):
    # An upcoming office hour already has 4 students; capacity cannot drop below 4.
    res = client.put("/teacher/schedule", json={
        "timings": [
            {"id": "lunch", "name": "Lunch", "start": "12:10", "end": "12:40", "days": [2, 4]},
        ],
        "max": 3,
    })
    assert res.status_code == 409
    assert res.json()["code"] == "seat_floor"
    assert "4 students booked" in res.json()["message"]


def test_removed_timing_stays_as_gone(client):
    client.put("/teacher/schedule", json={
        "timings": [
            {"id": "lunch", "name": "Lunch", "start": "12:10", "end": "12:40", "days": [2, 4]},
        ],
        "max": 4,
    })
    me = client.get("/teacher/profile").json()
    after = next(t for t in me["timings"] if t["id"] == "after")
    assert after.get("gone") is True
    assert after["days"] == []
    # Old bookings still resolve.
    bookings = client.get("/bookings?view=teacher").json()
    assert any(b["timingId"] == "after" for b in bookings)


# ---------------------------------------------------------------- days off

def test_day_off_roundtrip(client):
    assert client.delete("/teacher/days-off/%s" % RIVR3.isoformat()).status_code == 204
    res = client.post("/teacher/days-off", json={"date": RIVR3.isoformat(), "reason": "Testing"})
    assert res.status_code == 200, res.text
    assert res.json()["dayOff"]["reason"] == "Testing"
    assert res.json()["affected"] == 1  # Tariq holds the spot that day
    dup = client.post("/teacher/days-off", json={"date": RIVR3.isoformat(), "reason": "Again"})
    assert dup.status_code == 409
    assert dup.json()["code"] == "duplicate_day_off"
    assert client.delete("/teacher/days-off/%s" % RIVR3.isoformat()).status_code == 204
    gone = client.delete("/teacher/days-off/%s" % RIVR3.isoformat())
    assert gone.status_code == 404


def test_day_off_past_date(client):
    res = client.post("/teacher/days-off", json={"date": (T0 - timedelta(days=2)).isoformat()})
    assert res.status_code == 409
    assert res.json()["code"] == "past"


# ---------------------------------------------------------------- requests

def test_request_flow_answer(client):
    requests = client.get("/requests?view=teacher").json()
    pending = {r["studentName"]: r for r in requests if r["status"] == "pending"}
    assert {"Aiden P.", "Sofia L.", "Marcus T."} <= set(pending)

    aiden = pending["Aiden P."]
    res = client.post("/requests/%s/answer" % aiden["id"], json={"answer": "accepted"})
    assert res.status_code == 200
    assert res.json()["status"] == "accepted"
    assert "accepted this time." in res.json()["note"]

    marcus = pending["Marcus T."]
    res = client.post("/requests/%s/answer" % marcus["id"], json={"answer": "declined"})
    assert res.status_code == 200
    assert res.json()["status"] == "declined"

    # Answering twice is a 404.
    again = client.post("/requests/%s/answer" % aiden["id"], json={"answer": "accepted"})
    assert again.status_code == 404


def test_answer_requires_valid_value(client):
    requests = client.get("/requests?view=teacher").json()
    pending = next(r for r in requests if r["status"] == "pending")
    res = client.post("/requests/%s/answer" % pending["id"], json={"answer": "maybe"})
    assert res.status_code == 409
    assert res.json()["code"] == "invalid"


def test_student_request_flow(client):
    mine = client.get("/requests?view=student").json()
    assert {r["status"] for r in mine} == {"pending", "accepted", "declined"}
    pending = next(r for r in mine if r["status"] == "pending")
    assert client.delete("/requests/%s" % pending["id"]).status_code == 204
    assert client.delete("/requests/%s" % pending["id"]).status_code == 404


def test_student_sends_request(client):
    res = client.post("/requests", json={
        "teacherId": "rivera", "date": NEXT_MON.isoformat(), "time": "15:45",
        "reason": "Can we review my quiz retake plan together?",
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "pending"
    assert body["note"] == ""
    # The teacher got a notification.
    notes = client.get("/notifications?view=teacher").json()
    assert any("Maya K. sent a request for" in n["text"] for n in notes)


def test_send_request_rules(client):
    res = client.post("/requests", json={
        "teacherId": "rivera", "date": RIVR3.isoformat(), "time": "15:45",
        "reason": "Want to meet despite the day off.",
    })
    assert res.json()["code"] == "day_off"
    res = client.post("/requests", json={
        "teacherId": "rivera", "date": NEXT_FRI.isoformat(), "time": "15:45", "reason": "too short",
    })
    assert res.json()["code"] == "reason"


# ---------------------------------------------------------------- settings & notifications

def test_teacher_settings_roundtrip(client):
    body = client.get("/teacher/settings").json()
    assert body["name"] == "Ms. Rivera"
    body["email"] = "rivera@school.edu"
    body["morning"] = True
    res = client.put("/teacher/settings", json=body)
    assert res.status_code == 200
    assert res.json()["email"] == "rivera@school.edu"
    assert client.get("/teacher/settings").json()["morning"] is True


def test_settings_validation(client):
    bad = client.get("/teacher/settings").json()
    bad["name"] = "   "
    res = client.put("/teacher/settings", json=bad)
    assert res.status_code == 409
    assert res.json()["code"] == "invalid"

    bad["name"] = "Ms. Rivera"
    bad["email"] = "not-an-email"
    res = client.put("/teacher/settings", json=bad)
    assert res.status_code == 409
    assert res.json()["code"] == "invalid"

    sbad = client.get("/student/settings").json()
    sbad["email"] = "nope"
    res = client.put("/student/settings", json=sbad)
    assert res.json()["code"] == "invalid"


def test_notifications_read_all(client):
    notes = client.get("/notifications?view=teacher").json()
    assert len(notes) >= 3
    assert any(not n["read"] for n in notes)
    assert client.post("/notifications/read-all?view=teacher").status_code == 204
    assert all(n["read"] for n in client.get("/notifications?view=teacher").json())

    student_notes = client.get("/notifications?view=student").json()
    assert len(student_notes) >= 2


def test_error_shape(client):
    res = _book(client, teacher="brooks")
    body = res.json()
    assert set(body.keys()) == {"code", "message"}
