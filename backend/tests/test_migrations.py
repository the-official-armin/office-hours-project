"""Migration 0004 on an existing database: sign-in emails must be unique across teachers *and* students."""
import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config


@pytest.fixture()
def at_0003(tmp_path, monkeypatch):
    """A database file migrated up to just before 0004, and an engine on it."""
    monkeypatch.delenv("DATABASE_URL", raising=False)  # alembic/env.py then uses the URL set here
    url = "sqlite:///%s" % (tmp_path / "old.db")
    cfg = Config()
    cfg.set_main_option("script_location", "alembic")
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "0003_one_booking_per_student")
    engine = sa.create_engine(url)
    yield cfg, engine
    engine.dispose()


def add_teacher(conn, id, email):
    conn.execute(sa.text(
        "INSERT INTO teachers (id, name, subject, subject_group, capacity, email, remind, booking, cancel, request, morning, lead) "
        "VALUES (:id, :id, 'Math', 'Math', 4, :email, 1, 1, 1, 1, 0, '1 hour')"), {"id": id, "email": email})


def add_student(conn, id, email):
    conn.execute(sa.text(
        "INSERT INTO students (id, name, grade, email, remind, booked, answer, out, lead) "
        "VALUES (:id, :id, '', :email, 1, 1, 1, 1, '1 hour')"), {"id": id, "email": email})


def version(engine):
    with engine.connect() as conn:
        return conn.execute(sa.text("SELECT version_num FROM alembic_version")).scalar()


def test_a_teacher_and_a_student_sharing_an_email_stop_the_upgrade(at_0003):
    cfg, engine = at_0003
    with engine.begin() as conn:
        add_teacher(conn, "kim", "Kim@WAPREP.org")
        add_student(conn, "kim-s", " kim@waprep.org")
        add_student(conn, "lee", "lee@waprep.org")
    with pytest.raises(RuntimeError, match="kim@waprep.org"):
        command.upgrade(cfg, "head")
    assert version(engine) == "0003_one_booking_per_student"  # nothing changed


def test_two_students_sharing_an_email_stop_the_upgrade(at_0003):
    cfg, engine = at_0003
    with engine.begin() as conn:
        add_student(conn, "a", "same@waprep.org")
        add_student(conn, "b", "SAME@waprep.org")
    with pytest.raises(RuntimeError, match="same@waprep.org"):
        command.upgrade(cfg, "head")


def test_distinct_and_empty_emails_upgrade_fine(at_0003):
    cfg, engine = at_0003
    with engine.begin() as conn:
        add_teacher(conn, "rivera", "Rivera@waprep.org")
        add_student(conn, "maya", "")
        add_student(conn, "daniel", "")
    command.upgrade(cfg, "head")
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT email FROM teachers")).scalar() == "rivera@waprep.org"
        assert sorted(conn.execute(sa.text("SELECT email FROM students")).scalars()) == ["daniel@example.com", "maya@example.com"]
