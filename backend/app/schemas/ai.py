from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    session_id: int | None = None
    scholarship_id: str | None = Field(default=None, max_length=80)


class SopReviewRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50000)
    scholarship_id: str | None = Field(default=None, max_length=80)


class ImproveTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    instruction: str = Field(default="clarity and grammar", max_length=500)


class FillTemplateRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    answers: dict[str, str] = Field(default_factory=dict)
