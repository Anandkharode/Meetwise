"""Shared dependency and classifier utilities for meeting extraction."""

from __future__ import annotations

from typing import Any

from spacy.tokens import Doc, Span, Token

from app.classification.classifier import SentenceClassifier


def predict_sentence(sentence: str, classifier: Any | None = None) -> tuple[str | None, float]:
    """Return classifier label/confidence, tolerating an unavailable model."""
    if classifier is None:
        try:
            classifier = SentenceClassifier()
        except (FileNotFoundError, OSError):
            return None, 0.0
    prediction = classifier.predict(sentence)
    return str(prediction["label"]).upper(), float(prediction["confidence"])


def sentence_doc(sentence: str, nlp: Any) -> Span:
    """Parse one sentence and return its sentence span."""
    doc: Doc = nlp(sentence)
    return next(doc.sents, doc[:])


def head_verb(token: Token) -> Token:
    """Find a verbal head for a nominal or verbal dependency token."""
    current = token
    while current.head != current and current.pos_ not in {"VERB", "AUX"}:
        current = current.head
    return current


def subject_for(verb: Token) -> Token | None:
    """Return a syntactic or passive subject associated with a verb."""
    subject_deps = {"nsubj", "nsubjpass", "csubj", "expl"}
    for child in verb.children:
        if child.dep_ in subject_deps:
            return child
    # In modal/passive auxiliary constructions, the lexical verb can be a
    # complement of the auxiliary; inspect the clause head as well.
    if verb.head != verb:
        for child in verb.head.children:
            if child.dep_ in subject_deps:
                return child
    return None


def expand_nominal(token: Token) -> str:
    """Render a nominal head with its syntactic modifiers and compounds."""
    tokens = [
        item for item in token.subtree
        if item.pos_ not in {"PUNCT"}
    ]
    return " ".join(item.text for item in sorted(tokens, key=lambda item: item.i)).strip()


def object_for(verb: Token) -> str | None:
    """Return the direct, attribute, or prepositional object of a verb."""
    object_deps = {"dobj", "obj", "attr", "oprd", "dative"}
    candidates = [child for child in verb.children if child.dep_ in object_deps]
    if not candidates:
        candidates = [
            child for child in verb.children
            if child.dep_ in {"prep", "agent"}
        ]
        if candidates:
            pobj = [grandchild for child in candidates for grandchild in child.children if grandchild.dep_ in {"pobj", "obj"}]
            candidates = pobj or candidates
    if not candidates and verb.head != verb:
        candidates = [child for child in verb.head.children if child.dep_ in object_deps]
    if not candidates:
        return None
    return expand_nominal(candidates[0])


def entity_for_token(doc: Span, token: Token, label: str = "PERSON") -> str | None:
    """Return a matching named entity associated with a dependency token."""
    for entity in doc.ents:
        if entity.label_ == label and (entity.start <= token.i < entity.end or token.i in range(entity.start, entity.end)):
            return entity.text
    # Person names can be split/under-recognized by a statistical NER model;
    # dependency noun phrases are a conservative local fallback for a subject.
    if token.pos_ == "PROPN" or token.ent_type_ == label:
        return expand_nominal(token)
    return None


def person_subject(doc: Span, verb: Token) -> str | None:
    """Return a person only when syntactically attached as task subject."""
    subject = subject_for(verb)
    if subject is None:
        return None
    # Coordinated names attached to an explicit subject share its assignment.
    parts = [subject, *[child for child in subject.children if child.dep_ == "conj"]]
    names = [entity_for_token(doc, part) for part in parts]
    names = [name for name in names if name]
    return ", ".join(dict.fromkeys(names)) or None


def action_phrase(verb: Token) -> str:
    """Return a readable verb phrase, including particles and negation."""
    parts = [verb]
    parts.extend(child for child in verb.children if child.dep_ in {"prt", "neg"})
    return " ".join(item.text for item in sorted(parts, key=lambda item: item.i))
