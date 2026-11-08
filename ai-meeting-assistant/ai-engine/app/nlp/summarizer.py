"""Extractive meeting summarization using TF-IDF sentence similarity."""

from __future__ import annotations

import re
from typing import Any, TypedDict

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.nlp.pipeline import get_nlp

_TASK_CUE = re.compile(r"\b(?:will|must|should|has to|have to|needs? to|assigned|action item|follow up|please)\b", re.I)
_DECISION_CUE = re.compile(r"\b(?:decided|agreed|approved|selected|chose|chosen|settled on|final decision|rejected)\b", re.I)


class SummarySentence(TypedDict):
    """A selected original sentence with its relative importance score."""

    sentence: str
    importance: float


def _split_sentences(text: str, nlp: Any | None = None) -> list[str]:
    """Split text into sentences and discard empty spans."""
    pipeline = nlp or get_nlp()
    return [span.text.strip() for span in pipeline(text).sents if span.text.strip()]


def _special_relevance(sentence: str) -> float:
    """Give action and decision sentences a modest, overlapping boost."""
    score = 0.0
    if _TASK_CUE.search(sentence):
        score += 0.20
    if _DECISION_CUE.search(sentence):
        score += 0.20
    return score


def summarize_meeting(
    text: str,
    top_n: int = 5,
    nlp: Any | None = None,
    similarity_threshold: float = 0.88,
) -> dict[str, Any]:
    """Select high-importance original sentences in their transcript order.

    Sentence importance combines normalized TF-IDF term weights with a small
    explicit task/decision relevance boost. Redundant candidates are removed
    using cosine similarity between TF-IDF sentence vectors.
    """
    if top_n < 0:
        raise ValueError("top_n must be non-negative")
    sentences = _split_sentences(text, nlp)
    if not sentences or top_n == 0:
        return {"summary": "", "sentences": [], "sentence_count": len(sentences)}

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", sublinear_tf=True)
    try:
        vectors = vectorizer.fit_transform(sentences)
    except ValueError:  # all sentences contain only stop words or punctuation
        return {"summary": "", "sentences": [], "sentence_count": len(sentences)}

    matrix = vectors.toarray()
    norms = np.linalg.norm(matrix, axis=1)
    tfidf_scores = np.divide(matrix.sum(axis=1), norms, out=np.zeros_like(norms), where=norms != 0)
    relevance = np.array([_special_relevance(sentence) for sentence in sentences])
    raw_scores = tfidf_scores + relevance
    max_score = float(raw_scores.max()) if raw_scores.size else 0.0
    scores = raw_scores / max_score if max_score else raw_scores

    ranking = sorted(range(len(sentences)), key=lambda index: (-float(scores[index]), index))
    selected: list[int] = []
    similarities = cosine_similarity(vectors)
    for index in ranking:
        if any(similarities[index, prior] >= similarity_threshold for prior in selected):
            continue
        selected.append(index)
        if len(selected) >= top_n:
            break
    selected.sort()
    records: list[SummarySentence] = [
        {"sentence": sentences[index], "importance": round(float(scores[index]), 4)}
        for index in selected
    ]
    return {
        "summary": " ".join(record["sentence"] for record in records),
        "sentences": records,
        "sentence_count": len(sentences),
    }
