from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

WARNING_SEVERITIES = ("info", "warning", "critical")


class ConsultantWarning(Base):
    __tablename__ = "consultant_warnings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    consultant_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    issued_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    severity: Mapped[str] = mapped_column(String(20), default="warning", nullable=False)
    category: Mapped[str] = mapped_column(String(40), default="manual", nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    is_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
