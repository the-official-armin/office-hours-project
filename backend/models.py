from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, Time, 
    Boolean, ForeignKey, Enum, Table
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class UserRole(str, PyEnum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"

class WeekType(str, PyEnum):
    ALL = "all"
    BLUE_ONLY = "blue_only"
    ORANGE_ONLY = "orange_only"

class AppointmentStatus(str, PyEnum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"

# Many-to-many relationship for users and clubs
user_clubs = Table(
    'user_clubs',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('club_id', Integer, ForeignKey('clubs.id'), primary_key=True)
)

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Club(Base):
    __tablename__ = 'clubs'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

class TeacherProfile(Base):
    __tablename__ = 'teacher_profiles'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False)
    default_max_students = Column(Integer, default=10, nullable=False)

class TeacherWeeklyTemplate(Base):
    __tablename__ = 'teacher_weekly_templates'
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey('teacher_profiles.id'), nullable=False)
    day_of_week = Column(Integer, nullable=False)
    week_type = Column(Enum(WeekType), default=WeekType.ALL, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

class TeacherScheduleOverride(Base):
    __tablename__ = 'teacher_schedule_overrides'
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey('teacher_profiles.id'), nullable=False)
    override_date = Column(Date, nullable=False)
    is_cancelled = Column(Boolean, default=True, nullable=False)
    new_start_time = Column(Time, nullable=True)

class Appointment(Base):
    __tablename__ = 'appointments'
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    teacher_id = Column(Integer, ForeignKey('teacher_profiles.id'), nullable=False)
    appointment_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    summary_of_reasons = Column(Text, nullable=False)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.CONFIRMED, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)