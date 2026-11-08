"""Named entity extraction from locally processed text."""

from spacy.language import Language

from app.nlp.pipeline import get_nlp
from app.nlp.preprocess import clean_text

_SUPPORTED_LABELS = {"PERSON", "DATE", "ORG"}


def extract_entities(
    text: str,
    nlp: Language | None = None,
    include_other: bool = False,
) -> list[dict[str, str]]:
    """Extract PERSON, DATE, and ORG, optionally retaining all NER labels."""
    cleaned_text = clean_text(text)
    if not cleaned_text:
        return []
    doc = (nlp or get_nlp())(cleaned_text)
    return [
        {"text": entity.text, "label": entity.label_}
        for entity in doc.ents
        if include_other or entity.label_ in _SUPPORTED_LABELS
    ]
