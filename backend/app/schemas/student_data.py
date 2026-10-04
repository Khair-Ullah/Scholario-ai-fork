from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

ApplicationStatus = Literal["planning", "in_progress", "submitted", "interview", "accepted", "rejected", "withdrawn"]


class SavedCreate(BaseModel):
    scholarship_id: str = Field(min_length=1, max_length=80)
    note: str | None = Field(default=None, max_length=5000)


class ApplicationCreate(BaseModel):
    scholarship_id: str = Field(min_length=1, max_length=80)
    status: ApplicationStatus = "planning"
    applied_on: date | None = None
    next_step: str | None = Field(default=None, max_length=300)
    next_step_date: date | None = None
    notes: str | None = Field(default=None, max_length=10000)


class ApplicationUpdate(BaseModel):
    status: ApplicationStatus | None = None
    applied_on: date | None = None
    next_step: str | None = Field(default=None, max_length=300)
    next_step_date: date | None = None
    notes: str | None = Field(default=None, max_length=10000)


class ChecklistCreate(BaseModel):
    scholarship_id: str | None = Field(default=None, max_length=80)
    title: str = Field(min_length=1, max_length=300)
    is_done: bool = False
    due_date: date | None = None
    category: str | None = Field(default=None, max_length=80)


class ChecklistUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    is_done: bool | None = None
    due_date: date | None = None
    category: str | None = Field(default=None, max_length=80)
