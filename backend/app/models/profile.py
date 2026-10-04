from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    origin_country: Mapped[str | None] = mapped_column(String(120))
    target_level: Mapped[str | None] = mapped_column(String(40))
    host_countries: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    fields_of_study: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    ielts_status: Mapped[str | None] = mapped_column(String(20))
    gpa_scale: Mapped[str | None] = mapped_column(String(20))
    gpa_value: Mapped[float | None] = mapped_column(Float)
    gpa_4_equivalent: Mapped[float | None] = mapped_column(Float)
    bs_marks_obtained: Mapped[float | None] = mapped_column(Float)
    bs_marks_total: Mapped[float | None] = mapped_column(Float)
    funding_preference: Mapped[str | None] = mapped_column(String(30))
    extra_preferences: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    intake_preference: Mapped[str | None] = mapped_column(String(40))
    budget_note: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    onboarding_step: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
