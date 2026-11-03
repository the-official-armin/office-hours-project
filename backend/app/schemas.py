"""Pydantic request bodies — field names match the frontend's fetch calls exactly."""
from datetime import date
from typing import List

from pydantic import BaseModel, Field

_LEAD_PATTERN = r"^(30 minutes|1 hour|1 day)$"


_TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


class TimingDraftIn(BaseModel):
    id: str
    name: str
    start: str = Field(pattern=_TIME_PATTERN)
    end: str = Field(pattern=_TIME_PATTERN)
    days: List[int]


class HoursInputIn(BaseModel):
    timings: List[TimingDraftIn]
    max: int


class DayOffIn(BaseModel):
    date: date
    reason: str = ""


class TeacherSettingsIn(BaseModel):
    name: str
    subject: str = ""
    email: str = ""
    remind: bool = True
    booking: bool = True
    cancel: bool = True
    request: bool = True
    morning: bool = False
    lead: str = Field(default="1 hour", pattern=_LEAD_PATTERN)


class StudentSettingsIn(BaseModel):
    name: str
    grade: str = ""
    email: str = ""
    remind: bool = True
    booked: bool = True
    answer: bool = True
    out: bool = True
    lead: str = Field(default="1 hour", pattern=_LEAD_PATTERN)


class BookSeatIn(BaseModel):
    teacherId: str
    date: date
    timingId: str
    reason: str


class SendRequestIn(BaseModel):
    teacherId: str
    date: date
    time: str = Field(pattern=_TIME_PATTERN)
    reason: str
