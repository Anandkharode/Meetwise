"""Shared spaCy pipeline configured for local English NLP."""

from functools import lru_cache

import spacy
from spacy.language import Language


@lru_cache(maxsize=1)
def get_nlp() -> Language:
    """Load and cache the local ``en_core_web_sm`` pipeline."""
    try:
        return spacy.load("en_core_web_sm")
    except OSError as exc:
        raise RuntimeError(
            "spaCy model 'en_core_web_sm' is not installed. Run: "
            "python -m spacy download en_core_web_sm"
        ) from exc
