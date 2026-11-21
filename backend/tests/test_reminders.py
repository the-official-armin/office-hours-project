"""Step 6: reminder emails (app/reminders.py) and the timer endpoint. The clock is passed in, emails are captured.

The office hour used throughout: Ms. Rivera's Lunch (12:10) next Thursday, where the seed has two students booked and Maya
books a third spot. Everyone's reminder time is the default, 1 hour.
"""
from datetime import datetime, time

import pytest

from app import config, mailer, reminders
from app.models import DayOff, Notification, Student, Teacher
from tests.test_api import NEXT_THU, _book


@pytest.fixture()
def sent(monkeypatch):
    batches = []
    monkeypatch.setattr(mailer, "send_many", lambda messages: batches.append(list(messages)) or len(messages))
    return batches


def at(hour, minute=0, day=NEXT_THU):
    return datetime.combine(day, time(hour, minute))


def mails(batches, to=None):
    return [m for batch in batches for m in batch if to is None or m.to == to]


@pytest.fixture()
def booked(student, sent):
    """Maya books next Thursday's Lunch with Ms. Rivera."""
    assert _book(student, date=NEXT_THU).status_code == 200
    sent.clear()


def test_nothing_is_sent_before_the_reminder_time(db, booked, sent):
    assert reminders.run(db, now=at(11, 0)) == {}  # 70 minutes before: a 1-hour reminder isn't due yet
    assert mails(sent) == []


def test_students_and_the_teacher_are_reminded_within_their_lead_time(db, booked, sent):
    reminders.run(db, now=at(11, 30))
    # (Other teachers' 12:10 office hours that day get their reminders too; these checks look at Ms. Rivera's.)
    rivera_students = [m for m in mails(sent) if m.subject == "Reminder: Math office hour at 12:10 PM"]
    assert len(rivera_students) == 3

    [maya] = mails(sent, "maya@example.com")
    assert maya.subject == "Reminder: Math office hour at 12:10 PM"
    assert "Your lunch office hour with Ms. Rivera starts at 12:10 PM" in maya.text
    assert "You're booked: Need help with integrals" in maya.text

    [rivera] = mails(sent, "rivera@example.com")
    assert rivera.subject == "Office hours at 12:10 PM, 3 students booked"
    assert "Maya K.: Need help with integrals" in rivera.text
    assert rivera.tag == "reminder"

    notes = db.query(Notification).filter(Notification.student_id == "maya", Notification.key.like("reminder:%")).all()
    assert [n.text for n in notes] == ["Reminder: Ms. Rivera's Lunch starts at 12:10 PM. You are booked."]


def test_running_again_sends_nothing_twice(db, booked, sent):
    reminders.run(db, now=at(11, 30))
    sent.clear()
    assert reminders.run(db, now=at(11, 40)) == {}
    assert mails(sent) == []


def test_each_person_chooses_how_long_before(db, booked, sent):
    db.get(Student, "maya").lead = "1 day"
    db.get(Teacher, "rivera").lead = "30 minutes"
    db.commit()
    result = reminders.run(db, now=at(9, 0))  # 3 hours before
    assert mails(sent, "maya@example.com") and not mails(sent, "rivera@example.com")
    assert result["student"] == 1


def test_reminders_follow_the_settings_switch(db, booked, sent):
    db.get(Student, "maya").remind = False
    db.get(Teacher, "rivera").remind = False
    db.commit()
    reminders.run(db, now=at(11, 30))
    assert not mails(sent, "maya@example.com") and not mails(sent, "rivera@example.com")


def test_no_reminder_once_it_started_after_a_cancel_or_on_a_day_off(db, student, booked, sent):
    assert reminders.run(db, now=at(12, 15)) == {}  # already started

    maya = next(b for b in student.get("/bookings?view=student").json()
                if b["date"] == NEXT_THU.isoformat() and b["status"] == "confirmed")
    student.delete("/bookings/%s" % maya["id"])
    db.add(DayOff(teacher_id="rivera", date=NEXT_THU, reason="Conference"))
    db.commit()
    sent.clear()
    reminders.run(db, now=at(11, 30))
    assert not mails(sent, "maya@example.com") and not mails(sent, "rivera@example.com")
    assert not [m for m in mails(sent) if "Ms. Rivera" in m.text]


def test_deactivated_people_get_no_reminders(db, booked, sent):
    db.get(Student, "maya").status = "deactivated"
    db.commit()
    reminders.run(db, now=at(11, 30))
    assert not mails(sent, "maya@example.com")


def test_the_morning_summary_comes_once_from_seven(db, booked, sent):
    db.get(Teacher, "rivera").morning = True
    db.commit()
    assert "morning" not in reminders.run(db, now=at(6, 45))
    assert reminders.run(db, now=at(7, 5))["morning"] == 1
    [summary] = [m for m in mails(sent, "rivera@example.com") if m.tag == "morning"]
    assert summary.subject.startswith("Office hours today: ")
    assert "Lunch at 12:10 PM: 3 students booked" in summary.text
    sent.clear()
    assert "morning" not in reminders.run(db, now=at(8, 0))


def test_teachers_without_the_morning_summary_get_none(db, booked, sent):
    reminders.run(db, now=at(7, 5))
    assert not [m for m in mails(sent) if m.tag == "morning"]


# ------------------------------------------------------------------------------------------------ the timer endpoint

def test_the_job_endpoint_is_off_without_a_secret(client, monkeypatch):
    monkeypatch.setattr(config, "CRON_SECRET", "")
    assert client.get("/jobs/reminders").status_code == 404


def test_the_job_endpoint_needs_the_secret(client, monkeypatch, sent):
    monkeypatch.setattr(config, "CRON_SECRET", "s3cret-value")
    assert client.get("/jobs/reminders").status_code == 401
    assert client.get("/jobs/reminders", headers={"Authorization": "Bearer wrong"}).status_code == 401
    # A student's sign-in token is not the job secret either.
    res = client.get("/jobs/reminders", headers={"Authorization": "Bearer s3cret-value"})
    assert res.status_code == 200 and isinstance(res.json()["sent"], dict)
    assert client.post("/jobs/reminders", headers={"Authorization": "Bearer s3cret-value"}).status_code == 200
