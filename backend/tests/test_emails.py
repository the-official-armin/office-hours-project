"""Step 5: the news people get in the app also arrives by email, if they have that email on in Settings, and only once the
change is saved. Emails are captured at mailer.send_many (one batch per saved change), never sent."""
import pytest

from app import mailer
from app.models import Student, Teacher
from tests.test_api import NEXT_MON, OPEN_DAY, RIVR3, _book


@pytest.fixture()
def sent(monkeypatch):
    """Each batch the app hands to Postmark, as a list of emails."""
    batches = []
    monkeypatch.setattr(mailer, "send_many", lambda messages: batches.append(list(messages)) or len(messages))
    return batches


def emails(batches):
    return [m for batch in batches for m in batch]


def test_a_booking_emails_the_teacher_and_confirms_to_the_student(student, sent):
    assert _book(student, date=OPEN_DAY).status_code == 200
    assert len(sent) == 1  # one batch, sent after the booking was saved
    by_to = {m.to: m for m in sent[0]}
    teacher_mail, student_mail = by_to["rivera@example.com"], by_to["maya@example.com"]
    assert teacher_mail.subject.startswith("New booking: Maya K., ")
    assert "Maya K. booked a spot in Lunch" in teacher_mail.text
    assert "/teacher/calendar" in teacher_mail.text and "/teacher/settings" in teacher_mail.text
    assert student_mail.subject.startswith("Booked: Ms. Rivera, ")
    assert "Lunch (12:10 – 12:40 PM)" in student_mail.text
    assert (teacher_mail.tag, student_mail.tag) == ("booking", "booked")


def test_a_refused_booking_sends_nothing(student, sent):
    assert _book(student, date=OPEN_DAY).status_code == 200
    sent.clear()
    again = _book(student, date=OPEN_DAY)
    assert again.json()["code"] == "already_booked"
    assert sent == []


def test_emails_follow_each_persons_settings(student, db, sent):
    db.get(Teacher, "rivera").booking = False
    db.get(Student, "maya").booked = False
    db.commit()
    assert _book(student, date=OPEN_DAY).status_code == 200
    assert emails(sent) == []


def test_cancelling_emails_the_teacher(student, sent):
    booking = _book(student, date=OPEN_DAY).json()
    sent.clear()
    assert student.delete("/bookings/%s" % booking["id"]).status_code == 204
    [mail] = emails(sent)
    assert mail.to == "rivera@example.com" and mail.subject.startswith("Cancelled: Maya K., ") and mail.tag == "cancel"


def test_requests_email_the_teacher_and_the_answer_emails_the_student(student, teacher, sent):
    r = student.post("/requests", json={
        "teacherId": "rivera", "date": NEXT_MON.isoformat(), "time": "15:45",
        "reason": "Can we review my quiz retake plan together?",
    }).json()
    [mail] = emails(sent)
    assert (mail.to, mail.subject) == ("rivera@example.com", "New request from Maya K.")
    sent.clear()

    teacher.post("/requests/%s/answer" % r["id"], json={"answer": "accepted"})
    [mail] = emails(sent)
    assert (mail.to, mail.subject) == ("maya@example.com", "Ms. Rivera accepted your request")
    assert "/student/bookings" in mail.text


def test_cancelling_a_request_emails_the_teacher(student, sent):
    r = student.post("/requests", json={
        "teacherId": "rivera", "date": NEXT_MON.isoformat(), "time": "15:45",
        "reason": "Can we review my quiz retake plan together?",
    }).json()
    sent.clear()
    assert student.delete("/requests/%s" % r["id"]).status_code == 204
    [mail] = emails(sent)
    assert mail.subject == "Request cancelled: Maya K."


def test_a_day_off_emails_every_student_booked_that_day_in_one_batch(teacher, sent):
    assert teacher.delete("/teacher/days-off/%s" % RIVR3.isoformat()).status_code == 204
    back = emails(sent)
    assert back and all(m.subject.startswith("Ms. Rivera is back on ") for m in back)
    sent.clear()

    res = teacher.post("/teacher/days-off", json={"date": RIVR3.isoformat(), "reason": "Conference"})
    assert len(sent) == 1 and len(sent[0]) == res.json()["affected"] == 1  # Tariq holds the spot that day
    assert sent[0][0].to == "tariq@example.com" and sent[0][0].subject.startswith("Ms. Rivera is out on ")


def test_reading_and_settings_send_nothing(student, teacher, sent):
    student.get("/bookings?view=student")
    teacher.post("/notifications/read-all?view=teacher")
    body = teacher.get("/teacher/settings").json()
    teacher.put("/teacher/settings", json=body)
    assert emails(sent) == []
