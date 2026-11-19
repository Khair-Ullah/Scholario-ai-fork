from pydantic import BaseModel, Field, model_validator


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    origin_country: str | None = Field(default=None, max_length=120)
    target_level: str | None = Field(default=None, max_length=40)
    host_countries: list[str] | None = Field(default=None, max_length=50)
    fields_of_study: list[str] | None = Field(default=None, max_length=50)
    ielts_status: str | None = Field(default=None, pattern="^(not_taking|taking_6|taking_7|taking_8)$")
    gpa_scale: str | None = Field(default=None, pattern="^(4.0|5.0|10|percentage)$")
    gpa_value: float | None = Field(default=None, ge=0)
    gpa_4_equivalent: float | None = Field(default=None, ge=0, le=4)
    bs_marks_obtained: float | None = Field(default=None, ge=0)
    bs_marks_total: float | None = Field(default=None, gt=0)
    funding_preference: str | None = Field(default=None, max_length=30)
    extra_preferences: dict | None = Field(default=None, max_length=100)
    intake_preference: str | None = Field(default=None, max_length=40)
    budget_note: str | None = Field(default=None, max_length=1000)
    bio: str | None = Field(default=None, max_length=5000)
    onboarding_step: int | None = Field(default=None, ge=1, le=10)

    @model_validator(mode="after")
    def validate_marks(self):
        if (
            self.bs_marks_obtained is not None
            and self.bs_marks_total is not None
            and self.bs_marks_obtained > self.bs_marks_total
        ):
            raise ValueError("marks obtained cannot exceed total marks")
        return self


class MatchRequest(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    profile: ProfileUpdate | None = None
    q: str | None = Field(default=None, max_length=200)
    country: list[str] | None = Field(default=None, max_length=50)
    field: list[str] | None = Field(default=None, max_length=50)
    award_type: str | None = Field(default=None, max_length=80)
    ielts_tier: int | None = Field(default=None, ge=0, le=3)
    sort: str = Field(default="best_chance", pattern="^(best_chance|deadline|funding|newest)$")


class GpaConvertRequest(BaseModel):
    scale: str = Field(pattern="^(4.0|5.0|10|percentage)$")
    value: float = Field(ge=0)
    marks_total: float | None = Field(default=None, gt=0)
    marks_obtained: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_input_range(self):
        maximum = {"4.0": 4, "5.0": 5, "10": 10, "percentage": 100}[self.scale]
        if self.value > maximum:
            raise ValueError(f"value cannot exceed {maximum} for this scale")
        if self.marks_obtained is not None and self.marks_total is not None and self.marks_obtained > self.marks_total:
            raise ValueError("marks obtained cannot exceed total marks")
        return self
