from datetime import date
from typing import Any

from sqlalchemy import JSON, Boolean, Date, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Scholarship(Base):
    __tablename__ = "scholarships"
    __table_args__ = (
        Index("ix_scholarships_level", "level"),
        Index("ix_scholarships_host_country", "host_country"),
        Index("ix_scholarships_ielts_tier", "ielts_tier"),
        Index("ix_scholarships_deadline_date", "deadline_date"),
        Index("ix_scholarships_scholarship_type", "scholarship_type"),
    )

    scholarship_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    level: Mapped[str | None] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    university_name: Mapped[str | None] = mapped_column(String(500))
    scholarship_type: Mapped[str | None] = mapped_column(String(120))
    host_country: Mapped[str] = mapped_column(String(120), default="Unknown", nullable=False)
    ielts_required: Mapped[bool | None] = mapped_column(Boolean)
    ielts_band: Mapped[str | None] = mapped_column(String(40))
    ielts_tier: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fields_list: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    docs_list: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    deadline_date: Mapped[date | None] = mapped_column(Date)
    deadline_kind: Mapped[str] = mapped_column(String(30), default="unspecified", nullable=False)
    selection_ratio_percent: Mapped[float | None] = mapped_column(Float)
    application_url: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description_html: Mapped[str | None] = mapped_column(Text)
    description_text: Mapped[str | None] = mapped_column(Text)
    search_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    source_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
