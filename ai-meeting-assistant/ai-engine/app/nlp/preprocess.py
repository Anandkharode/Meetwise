"""Transcript cleanup, sentence splitting, tokenization, and normalization."""

import re
from typing import Any

from spacy.language import Language

from app.nlp.pipeline import get_nlp

_WHITESPACE_RE = re.compile(r"\s+")
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def normalize_whitespace(text: str) -> str:
    """Remove control characters and collapse all whitespace to single spaces."""
    return _WHITESPACE_RE.sub(" ", _CONTROL_RE.sub("", text)).strip()


def clean_text(text: str) -> str:
    """Clean transcript text while preserving punctuation and Unicode content."""
    return normalize_whitespace(text)


def preprocess_text(text: str, nlp: Language | None = None) -> dict[str, Any]:
    """Clean text and return sentence strings and normalized token strings."""
    cleaned_text = clean_text(text)
    if not cleaned_text:
        return {"cleaned_text": "", "sentences": [], "tokens": []}

    doc = (nlp or get_nlp())(cleaned_text)
    sentences = [sentence.text.strip() for sentence in doc.sents if sentence.text.strip()]
    tokens = [token.text.lower() for token in doc if not token.is_space]
    return {"cleaned_text": cleaned_text, "sentences": sentences, "tokens": tokens}
