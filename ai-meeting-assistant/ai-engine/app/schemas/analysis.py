"""Validated meeting analysis API request and response schemas."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MeetingAnalysisRequest(BaseModel):
    """Validated request for analysis of an already-transcribed meeting."""

    model_config = ConfigDict(extra="forbid")

    meeting_title: str | None = Field(default=None, max_length=300)
    meeting_date: date
    transcript: str = Field(..., min_length=1, max_length=100_000)

    @field_validator("meeting_date", mode="before")
    @classmethod
    def validate_meeting_date(cls, value: object) -> date:
        """Accept only an ISO YYYY-MM-DD string or date object."""
        if isinstance(value, date):
            return value
        if not isinstance(value, str) or len(value) != 10:
            raise ValueError("meeting_date must use YYYY-MM-DD format")
        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("meeting_date must be a valid YYYY-MM-DD date") from exc
        if parsed.isoformat() != value:
            raise ValueError("meeting_date must use YYYY-MM-DD format")
        return parsed

    @field_validator("transcript")
    @classmethod
    def validate_transcript_not_blank(cls, value: str) -> str:
        """Reject whitespace-only transcripts with a clear validation message."""
        if not value.strip():
            raise ValueError("transcript must contain non-whitespace text")
        return value


class DeadlineOutput(BaseModel):
    """Original deadline phrase and normalized date when unambiguous."""

    original_text: str
    normalized_date: date | None


class TaskOutput(BaseModel):
    """Normalized action item with transcript evidence."""

    task_id: str
    description: str
    action: str
    responsible_person: str | None
    deadline: DeadlineOutput | None
    priority: Literal["HIGH", "MEDIUM", "LOW"] | None
    status: Literal["pending"] = "pending"
    source_sentence: str
    confidence: float = Field(ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)


class DecisionOutput(BaseModel):
    """Confirmed decision with original sentence evidence."""

    decision_id: str
    description: str
    source_sentence: str
    confidence: float = Field(ge=0.0, le=1.0)


class SummaryOutput(BaseModel):
    """Extractive summary text and source-backed key points."""

    text: str
    key_points: list[str]


class EntityOutput(BaseModel):
    """Entity groups recognized by the local spaCy model."""

    people: list[str]
    organizations: list[str]
    dates: list[str]
    other: list[str]


class SentenceClassification(BaseModel):
    """Classifier result for an original transcript sentence."""

    sentence: str
    label: Literal["TASK", "DECISION", "SUGGESTION", "DISCUSSION"]
    confidence: float = Field(ge=0.0, le=1.0)


class AnalysisMetadata(BaseModel):
    """Counts and runtime warnings for a completed analysis."""

    total_sentences: int
    tasks_found: int
    decisions_found: int
    processing_time_ms: int
    warnings: list[str]


class MeetingInfo(BaseModel):
    """Meeting title and date supplied by the caller."""

    title: str | None
    meeting_date: date


class MeetingAnalysisResponse(BaseModel):
    """Complete validated output from the meeting analysis service."""

    success: Literal[True] = True
    meeting: MeetingInfo
    summary: SummaryOutput
    entities: EntityOutput
    classifications: list[SentenceClassification]
    tasks: list[TaskOutput]
    decisions: list[DecisionOutput]
    analysis_metadata: AnalysisMetadata
