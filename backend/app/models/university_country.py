from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UniversityCountry(Base):
    __tablename__ = "university_country"

    university_name: Mapped[str] = mapped_column(String(500), primary_key=True)
    host_country: Mapped[str] = mapped_column(String(120), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
