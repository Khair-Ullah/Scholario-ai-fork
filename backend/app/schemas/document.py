from typing import Any, Literal

from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    template_id: int | None = None
    scholarship_id: str | None = Field(default=None, max_length=80)
    doc_type: str | None = Field(default=None, max_length=80)
    content_html: str = Field(max_length=200_000)
    content_json: dict[str, Any] | None = None
    placeholders_json: dict[str, Any] = Field(default_factory=dict)
    status: Literal["draft", "final"] = "draft"


class DocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    scholarship_id: str | None = Field(default=None, max_length=80)
    content_html: str | None = Field(default=None, max_length=200_000)
    content_json: dict[str, Any] | None = None
    placeholders_json: dict[str, Any] | None = None
    status: Literal["draft", "final"] | None = None
