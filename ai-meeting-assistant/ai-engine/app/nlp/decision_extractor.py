"""Extract confirmed decisions, suggestions, and rejected proposals."""

from __future__ import annotations

import re
from typing import Any, TypedDict

from spacy.language import Language

from app.nlp.extraction_utils import action_phrase, object_for, predict_sentence, sentence_doc, subject_for
from app.nlp.pipeline import get_nlp

_REJECTED = re.compile(
    r"\b(?:reject(?:ed)?|declin(?:e|ed)|dismiss(?:ed)?|rule[ds]?\s+out|veto(?:ed)?|"
    r"decid(?:e|ed)\s+against|won't|will not|do not|don't)\b",
    re.I,
)
_SUGGESTION = re.compile(
    r"\b(?:suggest(?:s|ed|ion)?|recommend(?:s|ed|ation)?|propos(?:e|es|ed|al)|"
    r"could|might|perhaps|maybe|one option|alternative|why not|consider)\b",
    re.I,
)
_CONFIRMATION = re.compile(
    r"\b(?:decid(?:e|es|ed|ing)|agreed?\s+to|approved?|selected|chose|chosen|"
    r"settled\s+on|going\s+with|voted\s+to|will\s+(?:use|keep|launch|adopt|remain|pause)|"
    r"final\s+(?:choice|decision)|ruled\s+in)\b",
    re.I,
)


class DecisionRecord(TypedDict):
    """A decision-like statement with class, content, confidence, and evidence."""

    type: str
    status: str
    description: str
    subject: str | None
    action_verb: str | None
    object: str | None
    confidence: float
    evidence_sentence: str


def _decision_structure(sentence: str, nlp: Language) -> tuple[str | None, str | None, str | None]:
    """Extract dependency subject, action, and object for the main decision."""
    doc = sentence_doc(sentence, nlp)
    verbs = [token for token in doc if token.pos_ == "VERB" and token.dep_ not in {"aux", "auxpass", "conj"}]
    if not verbs:
        return None, None, None
    # In 'team decided to use JWT', prefer the content action 'use' while the
    # governing decision verb still anchors the clause subject.
    content = next((verb for verb in verbs if verb.lemma_.lower() not in {"decide", "agree", "choose", "select", "recommend", "suggest", "propose"}), verbs[-1])
    governing = content.head if content.head in verbs else content
    subject_token = subject_for(governing) or subject_for(content)
    subject = subject_token.text if subject_token is not None else None
    obj = object_for(content)
    return subject, content.lemma_.lower(), obj


def extract_decisions(
    text: str,
    nlp: Language | None = None,
    classifier: Any | None = None,
) -> list[DecisionRecord]:
    """Classify decision-related statements without promoting proposals.

    Returns only confirmed, suggested, or rejected proposal statements. The
    sentence classifier is used as supporting evidence; linguistic patterns
    determine the decision status so a suggestion is never silently confirmed.
    """
    pipeline = nlp or get_nlp()
    output: list[DecisionRecord] = []
    for span in pipeline(text).sents:
        sentence = span.text.strip()
        if not sentence:
            continue
        label, model_confidence = predict_sentence(sentence, classifier)
        rejected = bool(_REJECTED.search(sentence))
        suggested = bool(_SUGGESTION.search(sentence))
        confirmed = bool(_CONFIRMATION.search(sentence))

        if rejected:
            status, record_type = "REJECTED", "REJECTED_PROPOSAL"
            confidence = max(0.55, model_confidence if label == "DECISION" else 0.0)
        elif suggested:
            status, record_type = "PROPOSED", "SUGGESTION"
            confidence = max(0.55, model_confidence if label == "SUGGESTION" else 0.0)
        elif confirmed:
            status, record_type = "CONFIRMED", "DECISION"
            confidence = max(0.55, model_confidence if label == "DECISION" else 0.0)
        else:
            continue

        subject, action, obj = _decision_structure(sentence, pipeline)
        output.append(
            {
                "type": record_type,
                "status": status,
                "description": sentence,
                "subject": subject,
                "action_verb": action,
                "object": obj,
                "confidence": round(confidence, 4),
                "evidence_sentence": sentence,
            }
        )
    return output
