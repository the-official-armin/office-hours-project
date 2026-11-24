"""Invite-only accounts: invite -> activation email -> choose a password -> signed in; sign-in by email; forgot password;
deactivation; the developer command. Emails are captured, never sent."""
import re
from datetime import date, timedelta

import pytest

from app import accounts, config, invite, mailer
from app.models import AccountLink, Student, Teacher
from tests.test_api import OPEN_DAY, _book


@pytest.fixture()
def outbox(monkeypatch):
    """Every email the code tries to send."""
    sent = []
    monkeypatch.setattr(mailer, "send_email", lambda message: sent.append(message) or True)
    monkeypatch.setattr(config, "APP_URL", "http://app.test")
    return sent


def token_in(message, path="activate"):
    match = re.search(r"http://app\.test/%s\?token=([\w-]+)" % path, message.text)
    assert match, message.text
    return match.group(1)


def login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


def invite_ava(db, role="student"):
    return accounts.invite(db, "Ava Chen", "  Ava.Chen@WAPREP.org ", role, grade="Grade 9", subject="Physics")[0]


def test_the_whole_journey_invite_activate_sign_in(client, db, outbox):
    ava = invite_ava(db)
    assert (ava.id, ava.email, ava.status, ava.password_hash) == ("ava-chen", "ava.chen@waprep.org", "invited", "")
    assert len(outbox) == 1 and outbox[0].to == "ava.chen@waprep.org" and outbox[0].tag == "invite"
    token = token_in(outbox[0])

    # Not signed in before activation, even with the right email.
    assert login(client, "ava.chen@waprep.org", "").status_code == 422
    assert login(client, "ava.chen@waprep.org", "anything-at-all").json()["code"] == "invalid_credentials"

    info = client.get("/auth/link/" + token).json()
    assert info == {"purpose": "activate", "name": "Ava Chen", "email": "ava.chen@waprep.org", "role": "student"}

    res = client.post("/auth/set-password", json={"token": token, "password": "a good long password"})
    assert res.status_code == 200
    assert res.json()["user"] == {"id": "ava-chen", "role": "student", "name": "Ava Chen"}
    me = client.get("/auth/me", headers={"Authorization": "Bearer " + res.json()["accessToken"]})
    assert me.status_code == 200

    # Sign in later with the email, any capitalisation.
    assert login(client, "AVA.CHEN@waprep.org", "a good long password").status_code == 200
    # The link worked once.
    assert client.get("/auth/link/" + token).status_code == 410
    again = client.post("/auth/set-password", json={"token": token, "password": "another long password"})
    assert again.status_code == 410 and again.json()["code"] == "link_invalid"


def test_a_new_teacher_gets_no_office_hours_and_a_filter_group(db, outbox):
    t, _ = accounts.invite(db, "Ana Rivera", "ana.rivera@waprep.org", "teacher", subject="Mathematics", group="Math")
    assert isinstance(t, Teacher) and (t.subject, t.subject_group, t.timings) == ("Mathematics", "Math", [])
    other, _ = accounts.invite(db, "Bo Li", "bo.li@waprep.org", "teacher", subject="Art")
    assert other.subject_group == "Art"


@pytest.mark.parametrize("password,why", [
    ("short", "at least"),
    ("ava.chen@waprep.org", "email"),
    ("Ava.Chen", "at least"),
    ("x" * 129, "at most"),
])
def test_weak_passwords_are_refused(client, db, outbox, password, why):
    invite_ava(db)
    res = client.post("/auth/set-password", json={"token": token_in(outbox[0]), "password": password})
    assert res.status_code == 422 and res.json()["code"] == "weak_password"
    assert why in res.json()["message"]


def test_the_local_part_alone_is_refused_when_long_enough(client, db, outbox):
    accounts.invite(db, "Long Name", "averylongname@waprep.org", "student")
    res = client.post("/auth/set-password", json={"token": token_in(outbox[0]), "password": "AveryLongName"})
    assert res.json()["code"] == "weak_password"


def test_expired_and_unknown_links(client, db, outbox):
    invite_ava(db)
    token = token_in(outbox[0])
    link = db.query(AccountLink).one()
    link.expires_at = accounts.utcnow() - timedelta(minutes=1)
    db.commit()
    assert client.get("/auth/link/" + token).status_code == 410
    assert client.get("/auth/link/not-a-real-token").status_code == 410


def test_resending_an_invite_replaces_the_old_link(client, db, outbox):
    invite_ava(db)
    accounts.resend_invite(db, "ava.chen@waprep.org")
    old, new = token_in(outbox[0]), token_in(outbox[1])
    assert client.get("/auth/link/" + old).status_code == 410
    assert client.get("/auth/link/" + new).status_code == 200


def test_only_the_hash_of_a_link_is_stored(db, outbox):
    invite_ava(db)
    token = token_in(outbox[0])
    stored = db.query(AccountLink).one().token_hash
    assert token not in stored and len(stored) == 64


def test_emails_are_unique_across_teachers_and_students(db, outbox):
    invite_ava(db)
    with pytest.raises(accounts.RuleError) as err:
        accounts.invite(db, "Someone", "ava.chen@waprep.org", "teacher")
    assert err.value.code == "email_taken"
    with pytest.raises(accounts.RuleError):
        accounts.invite(db, "Maya again", "MAYA@example.com", "student")  # a demo account's email
    with pytest.raises(accounts.RuleError) as err:
        accounts.invite(db, "No Email", "not-an-email", "student")
    assert err.value.code == "invalid"


def test_forgot_password_for_an_active_account(client, db, outbox):
    res = client.post("/auth/forgot-password", json={"email": "Maya@Example.com"})
    assert res.status_code == 204
    assert outbox[0].to == "maya@example.com" and outbox[0].tag == "reset"
    token = token_in(outbox[0], "reset-password")
    assert client.get("/auth/link/" + token).json()["purpose"] == "reset"

    assert client.post("/auth/set-password", json={"token": token, "password": "brand new password"}).status_code == 200
    assert login(client, "maya@example.com", "demo-password").status_code == 401
    assert login(client, "maya@example.com", "brand new password").status_code == 200


def test_forgot_password_never_says_whether_an_email_exists(client, outbox):
    res = client.post("/auth/forgot-password", json={"email": "nobody@waprep.org"})
    assert res.status_code == 204 and outbox == []


def test_forgot_password_before_activating_sends_a_new_invite(client, db, outbox):
    invite_ava(db)
    client.post("/auth/forgot-password", json={"email": "ava.chen@waprep.org"})
    assert outbox[1].tag == "invite"
    assert client.get("/auth/link/" + token_in(outbox[0])).status_code == 410
    assert client.get("/auth/link/" + token_in(outbox[1])).status_code == 200


def test_an_activated_account_cannot_get_another_invite(client, db, outbox):
    invite_ava(db)
    client.post("/auth/set-password", json={"token": token_in(outbox[0]), "password": "a good long password"})
    with pytest.raises(accounts.RuleError):
        accounts.resend_invite(db, "ava.chen@waprep.org")


def test_deactivating_stops_sign_in_and_open_sessions_at_once(client, db, signed_in, outbox):
    maya = signed_in("maya", "student")
    assert maya.get("/auth/me").status_code == 200
    client.post("/auth/forgot-password", json={"email": "maya@example.com"})
    reset = token_in(outbox[0], "reset-password")

    accounts.set_status(db, "maya@example.com", "deactivated")
    assert maya.get("/auth/me").status_code == 401
    assert login(client, "maya@example.com", "demo-password").status_code == 401
    assert client.get("/auth/link/" + reset).status_code == 410
    # Bookings stay on record.
    assert db.get(Student, "maya") is not None

    accounts.set_status(db, "maya@example.com", "active")
    assert login(client, "maya@example.com", "demo-password").status_code == 200


def test_an_account_that_is_not_active_yet_has_no_access(signed_in, db, outbox):
    invite_ava(db)
    # Even a valid token for an invited account is refused until they choose a password.
    assert signed_in("ava-chen", "student").get("/student/settings").status_code == 401


# ------------------------------------------------------------------------------------------------ the command

def test_invite_command_with_a_csv(tmp_path, db, outbox, capsys, monkeypatch):
    # The command opens its own sessions on the same test database.
    csv_file = tmp_path / "people.csv"
    csv_file.write_text(
        "Name,Email,Role,Grade,Subject,Group\n"
        "Ava Chen,ava.chen@waprep.org,student,Grade 9,,\n"
        "Ana Rivera,ana.rivera@waprep.org,Teacher,,Mathematics,Math\n"
        "Maya Again,maya@example.com,student,,,\n"
        "Broken,not-an-email,student,,,\n"
    )
    assert invite.main([str(csv_file)]) == 1  # one row had an error
    out = capsys.readouterr().out
    assert "2 invited, 1 already had an account, 1 with errors." in out
    assert sorted(m.to for m in outbox) == ["ana.rivera@waprep.org", "ava.chen@waprep.org"]
    db.expire_all()
    assert db.query(Teacher).filter(Teacher.email == "ana.rivera@waprep.org").one().status == "invited"

    assert invite.main(["--resend", "ava.chen@waprep.org"]) == 0
    assert invite.main(["--deactivate", "ava.chen@waprep.org"]) == 0
    assert invite.main(["--reactivate", "ava.chen@waprep.org"]) == 0
    db.expire_all()
    assert db.query(Student).filter(Student.email == "ava.chen@waprep.org").one().status == "invited"  # never activated
    assert invite.main(["--list"]) == 0
    assert "ana.rivera@waprep.org" in capsys.readouterr().out


def test_invite_command_needs_the_header(tmp_path, capsys):
    csv_file = tmp_path / "people.csv"
    csv_file.write_text("Ava Chen,ava@waprep.org,student\n")
    assert invite.main([str(csv_file)]) == 2
    assert "header row" in capsys.readouterr().out


# ------------------------------------------------------------------------------------------------ deactivation frees spots

def _upcoming(db, **who):
    from app.models import Booking
    return db.query(Booking).filter_by(status="confirmed", **who).filter(Booking.date >= date.today()).all()


def test_deactivating_a_student_cancels_their_upcoming_bookings_and_tells_the_teacher(student, db, monkeypatch):
    batches = []
    monkeypatch.setattr(mailer, "send_many", lambda messages: batches.append(list(messages)) or len(messages))
    assert _book(student, date=OPEN_DAY).status_code == 200
    held = _upcoming(db, student_id="maya")
    assert held
    batches.clear()

    person, cancelled = accounts.set_status(db, "maya@example.com", "deactivated")
    assert cancelled == len(held) and _upcoming(db, student_id="maya") == []
    rivera = [m for b in batches for m in b if m.to == "rivera@example.com"]
    assert rivera and rivera[0].subject.startswith("Cancelled: Maya K., ")
    assert "account was closed" in rivera[0].text
    # Past bookings stay on record.
    from app.models import Booking
    assert db.query(Booking).filter(Booking.student_id == "maya", Booking.date < date.today()).count() > 0
    # Reactivating doesn't bring the spots back.
    accounts.set_status(db, "maya@example.com", "active")
    assert _upcoming(db, student_id="maya") == []


def test_deactivating_a_teacher_cancels_bookings_with_them_and_tells_the_students(db, monkeypatch):
    batches = []
    monkeypatch.setattr(mailer, "send_many", lambda messages: batches.append(list(messages)) or len(messages))
    booked = {b.student_id for b in _upcoming(db, teacher_id="rivera")}
    assert booked
    person, cancelled = accounts.set_status(db, "rivera@example.com", "deactivated")
    assert cancelled > 0 and _upcoming(db, teacher_id="rivera") == []
    told = {m.to for b in batches for m in b}
    assert told == {"%s@example.com" % s for s in booked}
    assert all("no longer holds office hours" in m.text for b in batches for m in b)


def test_the_command_says_how_many_bookings_were_cancelled(db, capsys):
    assert invite.main(["--deactivate", "rivera@example.com"]) == 0
    out = capsys.readouterr().out
    assert "rivera@example.com is now deactivated." in out and "upcoming booking" in out


def test_an_invite_email_that_fails_is_reported_and_the_command_fails(tmp_path, db, monkeypatch, capsys):
    monkeypatch.setattr(mailer, "send_email", lambda message: False)  # e.g. Postmark refused it
    csv_file = tmp_path / "people.csv"
    csv_file.write_text("name,email,role\nAva Chen,ava.chen@waprep.org,student\n")
    assert invite.main([str(csv_file)]) == 1
    out = capsys.readouterr().out
    assert "ava.chen@waprep.org (ava-chen)  EMAIL NOT SENT" in out
    assert "1 invite email NOT sent" in out and "--resend" in out
    db.expire_all()
    assert db.query(Student).filter(Student.email == "ava.chen@waprep.org").one().status == "invited"  # account kept

    assert invite.main(["--resend", "ava.chen@waprep.org"]) == 1
    assert "was NOT sent" in capsys.readouterr().out

    monkeypatch.setattr(mailer, "send_email", lambda message: True)
    assert invite.main(["--resend", "ava.chen@waprep.org"]) == 0
    assert "New activation link sent to ava.chen@waprep.org." in capsys.readouterr().out


# ------------------------------------------------------------------------------------------------ one link wins

def _open_link(db, purpose, user_id="maya", role="student"):
    """An unused link added straight to the table, as two "forgot password" requests at the same moment would leave."""
    token = "tok-%s-%d" % (purpose, db.query(AccountLink).count())
    now = accounts.utcnow()
    db.add(AccountLink(token_hash=accounts._hash(token), purpose=purpose, role=role, user_id=user_id,
                       expires_at=now + timedelta(hours=1), created_at=now))
    db.commit()
    return token


def test_using_one_reset_link_burns_its_siblings(client, db):
    first, second = _open_link(db, "reset"), _open_link(db, "reset")
    assert client.get("/auth/link/" + second).status_code == 200  # both live, as after a race
    assert client.post("/auth/set-password", json={"token": first, "password": "a good long password"}).status_code == 200
    assert client.get("/auth/link/" + second).status_code == 410
    res = client.post("/auth/set-password", json={"token": second, "password": "another long password"})
    assert res.status_code == 410
    assert login(client, "maya@example.com", "a good long password").status_code == 200


def test_a_link_used_at_the_same_moment_only_works_once(client, db, monkeypatch):
    token = _open_link(db, "reset")
    real_read = accounts.read_link

    def read_then_lose_the_race(db_, token_):
        found = real_read(db_, token_)
        # Another request spends the link between our read and our claim.
        db_.query(AccountLink).filter(AccountLink.id == found[0].id).update({AccountLink.used_at: accounts.utcnow()})
        return found

    monkeypatch.setattr(accounts, "read_link", read_then_lose_the_race)
    res = client.post("/auth/set-password", json={"token": token, "password": "a good long password"})
    assert res.status_code == 410 and res.json()["code"] == "link_invalid"
    monkeypatch.setattr(accounts, "read_link", real_read)
    assert login(client, "maya@example.com", "demo-password").status_code == 200  # password unchanged
