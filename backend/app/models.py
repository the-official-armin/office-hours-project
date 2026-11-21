"""SQLAlchemy models — designed to mirror frontend-teacher/src/types/index.ts.

Shapes the frontend consumes (Teacher, Timing, DayOff, Booking, BookingRequest, Note)
are serialized in app/views.py; these tables are the storage behind them.
"""
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from .database import Base


# Account status. People are invited by a developer (python -m app.invite), activate from the email by choosing a
# password, and can be deactivated when they leave (bookings stay on record, sign-in stops).
STATUS_INVITED = "invited"
STATUS_ACTIVE = "active"
STATUS_DEACTIVATED = "deactivated"


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(String, primary_key=True)  # frontend-visible id, e.g. "rivera"
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    subject_group = Column(String, nullable=False)  # "group" in the frontend Teacher type
    capacity = Column(Integer, nullable=False, default=4)  # "max" — students per office hour

    # Email/notification preferences (TeacherPrefs in the frontend types).
    # The school email is also the sign-in: stored lowercase, unique here and (checked in app/accounts.py) across students.
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False, default="")  # "" until the person activates their account
    status = Column(String(20), nullable=False, default=STATUS_ACTIVE, server_default=STATUS_ACTIVE)
    # In every sign-in token; bumping it (log out, new password, deactivate) ends all of the person's sessions at once.
    session_version = Column(Integer, nullable=False, default=0, server_default="0")
    remind = Column(Boolean, nullable=False, default=True)
    booking = Column(Boolean, nullable=False, default=True)
    cancel = Column(Boolean, nullable=False, default=True)
    request = Column(Boolean, nullable=False, default=True)
    morning = Column(Boolean, nullable=False, default=False)
    lead = Column(String, nullable=False, default="1 hour")  # 30 minutes | 1 hour | 1 day

    timings = relationship("Timing", back_populates="teacher", order_by="Timing.id",
                           cascade="all, delete-orphan")
    days_off = relationship("DayOff", back_populates="teacher", order_by="DayOff.date",
                            cascade="all, delete-orphan")


class Timing(Base):
    """A named office-hour block (e.g. "Lunch" Tue/Thu 12:10-12:40).

    A removed timing is kept with gone=True and days=[] so old bookings still resolve.
    `key` is the id the frontend knows ("lunch", "after", or a client-generated id).
    """

    __tablename__ = "timings"
    __table_args__ = (UniqueConstraint("teacher_id", "key"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    teacher_id = Column(String, ForeignKey("teachers.id"), nullable=False, index=True)
    key = Column(String, nullable=False)
    name = Column(String, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    days = Column(JSON, nullable=False, default=list)  # JS weekday numbers: 1=Mon ... 5=Fri
    gone = Column(Boolean, nullable=False, default=False)

    teacher = relationship("Teacher", back_populates="timings")


class DayOff(Base):
    __tablename__ = "days_off"

    id = Column(Integer, primary_key=True, autoincrement=True)
    teacher_id = Column(String, ForeignKey("teachers.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    reason = Column(String, nullable=False, default="")

    teacher = relationship("Teacher", back_populates="days_off")


class Student(Base):
    __tablename__ = "students"

    id = Column(String, primary_key=True)  # e.g. "maya"
    name = Column(String, nullable=False)
    grade = Column(String, nullable=False, default="")
    email = Column(String, nullable=False, unique=True, index=True)  # sign-in, lowercase (see Teacher.email)
    password_hash = Column(String, nullable=False, default="")  # "" until the person activates their account
    status = Column(String(20), nullable=False, default=STATUS_ACTIVE, server_default=STATUS_ACTIVE)
    session_version = Column(Integer, nullable=False, default=0, server_default="0")  # see Teacher.session_version

    # StudentPrefs in the frontend types.
    remind = Column(Boolean, nullable=False, default=True)
    booked = Column(Boolean, nullable=False, default=True)
    answer = Column(Boolean, nullable=False, default=True)
    out = Column(Boolean, nullable=False, default=True)
    lead = Column(String, nullable=False, default="1 hour")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        # One confirmed booking per student per office hour, even when two requests arrive at once.
        Index("uq_bookings_one_per_student", "student_id", "date", "timing_id", unique=True,
              sqlite_where=text("status = 'confirmed'"), postgresql_where=text("status = 'confirmed'")),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    teacher_id = Column(String, ForeignKey("teachers.id"), nullable=False, index=True)
    timing_id = Column(Integer, ForeignKey("timings.id"), nullable=False)
    date = Column(Date, nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    reason = Column(Text, nullable=False, default="")
    status = Column(String(20), nullable=False, default="confirmed")  # confirmed | cancelled
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    timing = relationship("Timing")
    student = relationship("Student")


class BookingRequest(Base):
    """"Request a different time": a student asks for a time outside the teacher's office hours."""

    __tablename__ = "booking_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    teacher_id = Column(String, ForeignKey("teachers.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    date = Column(Date, nullable=False)
    time = Column(String(5), nullable=False)  # "HH:MM", school local time
    reason = Column(Text, nullable=False, default="")
    status = Column(String(20), nullable=False, default="pending")  # pending | accepted | declined
    note = Column(Text, nullable=False, default="")

    student = relationship("Student")


class Notification(Base):
    """App notification (Note in the frontend types). Exactly one recipient is set."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    teacher_id = Column(String, ForeignKey("teachers.id"), nullable=True, index=True)
    student_id = Column(String, ForeignKey("students.id"), nullable=True, index=True)
    text = Column(Text, nullable=False)
    at = Column(BigInteger, nullable=False)  # epoch milliseconds, matches Note.at
    read = Column(Boolean, nullable=False, default=False)
    key = Column(String, nullable=True)  # dedupe key for generated reminders


class AccountLink(Base):
    """A one-time link sent by email: activate a new account, or reset a forgotten password.

    Only a SHA-256 hash of the token is stored, so a copy of the database can't be used to sign in.
    """

    __tablename__ = "account_links"
    __table_args__ = (Index("ix_account_links_person", "role", "user_id"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    token_hash = Column(String(64), nullable=False, unique=True)
    purpose = Column(String(20), nullable=False)  # activate | reset
    role = Column(String(10), nullable=False)  # teacher | student
    user_id = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)  # UTC
    used_at = Column(DateTime, nullable=True)  # UTC; set when used or replaced by a newer link
    created_at = Column(DateTime, nullable=False)  # UTC


class AuthAttempt(Base):
    """One sign-in, password-link or forgot-password attempt, for rate limits (app/ratelimit.py).

    Kept in the database, not in memory, because on Vercel every request may run in a different process.
    Rows older than a day are deleted by the reminder job.
    """

    __tablename__ = "auth_attempts"
    __table_args__ = (Index("ix_auth_attempts_bucket_at", "bucket", "at"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    bucket = Column(String(200), nullable=False)  # what is counted, e.g. "login-email:maya@waprep.org", "login-ip:1.2.3.4"
    at = Column(DateTime, nullable=False)  # UTC
