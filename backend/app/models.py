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


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(String, primary_key=True)  # frontend-visible id, e.g. "rivera"
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    subject_group = Column(String, nullable=False)  # "group" in the frontend Teacher type
    capacity = Column(Integer, nullable=False, default=4)  # "max" — students per office hour

    # Email/notification preferences (TeacherPrefs in the frontend types).
    email = Column(String, nullable=False, default="")
    password_hash = Column(String, nullable=False, default="")
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
    email = Column(String, nullable=False, default="")
    password_hash = Column(String, nullable=False, default="")

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
