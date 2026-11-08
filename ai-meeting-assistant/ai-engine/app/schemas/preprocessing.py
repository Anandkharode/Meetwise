"""Pydantic schemas for transcript preprocessing API operations."""

from pydantic import BaseModel, Field


class PreprocessRequest(BaseModel):
    """Transcript text submitted for deterministic local preprocessing."""

    text: str = Field(..., min_length=1, description="Raw meeting transcript text")


class EntitySchema(BaseModel):
    """A recognized named entity."""

    text: str
    label: str


class PreprocessResponse(BaseModel):
    """Normalized text, sentences, tokens, and supported named entities."""

    cleaned_text: str
    sentences: list[str]
    tokens: list[str]
    entities: list[EntitySchema]
