import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./scholario.db")
SEVEN_PLUS_SEES_ALL = os.getenv("SEVEN_PLUS_SEES_ALL", "false").lower() == "true"

GPA_THRESHOLDS = {
    "Undergraduate": (3.0, 3.5),
    "Master": (3.2, 3.6),
    "PhD": (3.4, 3.7),
}
