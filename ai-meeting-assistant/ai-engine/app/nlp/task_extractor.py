"""Extract explicit tasks from meeting sentences using spaCy and ML labels."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, TypedDict

from spacy.language import Language

from app.nlp.extraction_utils import (
    action_phrase,
    object_for,
    person_subject,
    predict_sentence,
    sentence_doc,
    subject_for,
)
from app.nlp.pipeline import get_nlp
from app.nlp.deadline_extractor import extract_deadline

_PRIORITY_PATTERNS = {
    "HIGH": re.compile(r"\b(?:high priority|urgent(?:ly)?|asap|immediately|critical priority)\b", re.I),
    "LOW": re.compile(r"\b(?:low priority|when convenient|no rush|non[- ]urgent)\b", re.I),
}


class TaskRecord(TypedDict):
    """Structured task fields with evidence and confidence."""

    action_verb: str
    description: str
    responsible_person: str | None
    deadline: str | None
    deadline_text: str | None
    priority: str | None
    confidence: float
    evidence_sentence: str


def _sentences(text: str, nlp: Language) -> list[str]:
    """Split transcript into sentence strings with spaCy."""
    return [span.text.strip() for span in nlp(text).sents if span.text.strip()]


def _priority(sentence: str) -> str | None:
    """Return priority only when the sentence states it explicitly."""
    for priority, pattern in _PRIORITY_PATTERNS.items():
        if pattern.search(sentence):
            return priority
    return "MEDIUM" if re.search(r"\bmedium priority\b", sentence, re.I) else None


def extract_tasks(
    text: str,
    nlp: Language | None = None,
    classifier: Any | None = None,
    reference_time: datetime | None = None,
) -> list[TaskRecord]:
    """Extract explicit task actions, owners, deadlines, and stated priority.

    Person ownership is assigned only from an explicit task subject (including
    imperative requests where the addressee is not inferable and stays unknown).
    """
    pipeline = nlp or get_nlp()
    results: list[TaskRecord] = []
    for sentence in _sentences(text, pipeline):
        label, model_confidence = predict_sentence(sentence, classifier)
        doc = sentence_doc(sentence, pipeline)
        candidates = [token for token in doc if token.pos_ == "VERB" and token.dep_ not in {"aux", "auxpass", "conj"}]
        candidates = [
            token for token in candidates
            if not (token.lemma_.lower() in {"have", "need", "want"} and any(child.pos_ == "VERB" and child.dep_ in {"xcomp", "ccomp"} for child in token.children))
        ]
        if not candidates:
            continue
        # Keep task-bearing lexical verbs; ignore reporting/speech wrappers if
        # a subordinate action is present.
        selected = [verb for verb in candidates if subject_for(verb) is not None or verb.tag_ == "VB"]
        if not selected:
            continue
        for verb in selected:
            subject = subject_for(verb)
            governing = verb.head if verb.head.pos_ == "VERB" and verb.head.lemma_.lower() in {"have", "need", "want", "ask", "assign", "expect"} else None
            if subject is None and governing is not None:
                subject = subject_for(governing)
            # A named mention elsewhere in the sentence is not an owner.
            owner = person_subject(doc, governing or verb) if subject is not None else None
            obj = object_for(verb)
            description = action_phrase(verb)
            if obj:
                description = f"{description} {obj}"
            # Avoid treating generic reporting clauses as tasks without an
            # action object or an explicit assignment/modal construction.
            has_task_cue = (
                any(child.dep_ in {"aux", "auxpass", "mark"} and child.lemma_.lower() in {"will", "shall", "should", "can", "could", "must", "have", "need", "to"} for child in verb.children)
                or (governing is not None and governing.lemma_.lower() in {"have", "need", "want", "ask", "assign", "expect"})
                or (verb.dep_ == "ROOT" and bool(re.search(r"\b(?:will|shall|should|must|has to|have to|needs? to|please)\b", sentence, re.I)))
            )
            is_imperative = verb.tag_ == "VB" and subject is None
            if not (has_task_cue or is_imperative):
                continue
            deadline = extract_deadline(sentence, reference_time or datetime.now())
            syntactic_confidence = min(0.78, 0.48 + (0.12 if owner else 0.0) + (0.12 if obj else 0.0) + (0.08 if has_task_cue else 0.0))
            confidence = round(0.7 * syntactic_confidence + 0.3 * model_confidence, 4) if label == "TASK" else syntactic_confidence
            results.append(
                {
                    "action_verb": verb.lemma_.lower(),
                    "description": description,
                    "responsible_person": owner,
                    "deadline": deadline["date"],
                    "deadline_text": deadline["original_text"],
                    "priority": _priority(sentence),
                    "confidence": round(confidence, 4),
                    "evidence_sentence": sentence,
                }
            )
    return results
