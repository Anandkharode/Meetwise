"""Orchestrate the local NLP modules into a validated meeting analysis."""

from __future__ import annotations

import time
import re
from datetime import datetime, time as day_time
from typing import Any
from uuid import uuid4

from rapidfuzz import fuzz

from app.classification.classifier import SentenceClassifier
from app.nlp.deadline_extractor import extract_deadline
from app.nlp.decision_extractor import extract_decisions
from app.nlp.entity_extractor import extract_entities
from app.nlp.pipeline import get_nlp
from app.nlp.preprocess import preprocess_text
from app.nlp.summarizer import summarize_meeting
from app.nlp.task_extractor import extract_tasks
from app.schemas.analysis import (
    AnalysisMetadata,
    DeadlineOutput,
    DecisionOutput,
    EntityOutput,
    MeetingAnalysisRequest,
    MeetingAnalysisResponse,
    MeetingInfo,
    SentenceClassification,
    SummaryOutput,
    TaskOutput,
)


class AnalysisDependencyError(RuntimeError):
    """A required local model or package is unavailable."""


class AnalysisProcessingError(RuntimeError):
    """A required analysis step failed before a complete result was possible."""


def _unique(values: list[str]) -> list[str]:
    """Deduplicate strings case-insensitively while retaining first order."""
    found: set[str] = set()
    result: list[str] = []
    for value in values:
        key = value.casefold()
        if key not in found:
            found.add(key)
            result.append(value)
    return result


def _deduplicate_tasks(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove repeated action records using RapidFuzz description similarity."""
    selected: list[dict[str, Any]] = []
    for task in tasks:
        duplicate = any(
            task["action_verb"] == prior["action_verb"]
            and (task["responsible_person"] or "").casefold() == (prior["responsible_person"] or "").casefold()
            and fuzz.ratio(task["description"].casefold(), prior["description"].casefold()) >= 92
            for prior in selected
        )
        if not duplicate:
            selected.append(task)
    return selected


def _deduplicate_decisions(decisions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove repeated confirmed decision descriptions using RapidFuzz."""
    selected: list[dict[str, Any]] = []
    for decision in decisions:
        if not any(fuzz.ratio(decision["description"].casefold(), prior["description"].casefold()) >= 92 for prior in selected):
            selected.append(decision)
    return selected


def _make_task_output(raw: dict[str, Any], classifier: SentenceClassifier, meeting_date: datetime) -> TaskOutput:
    """Map an extractor task to the stable API shape with evidence-backed dates."""
    deadline_phrase = raw.get("deadline_text")
    deadline_output = None
    warnings: list[str] = []
    if deadline_phrase:
        parsed = extract_deadline(deadline_phrase, meeting_date)
        # Task extraction preserves the complete phrase (for example, "by Friday").
        normalized_date = parsed["date"] or raw.get("deadline")
        deadline_output = DeadlineOutput(
            original_text=deadline_phrase,
            normalized_date=normalized_date,
        )
        if normalized_date is None:
            warnings.append(f"Deadline phrase '{deadline_phrase}' is ambiguous and was not normalized.")

    confidence = classifier.class_probability(raw["evidence_sentence"], "TASK")
    return TaskOutput(
        task_id=str(uuid4()),
        description=raw["description"],
        action=raw["action_verb"].capitalize(),
        responsible_person=raw["responsible_person"],
        deadline=deadline_output,
        priority=raw["priority"],
        source_sentence=raw["evidence_sentence"],
        confidence=confidence,
        warnings=warnings,
    )


def analyze_meeting(request: MeetingAnalysisRequest) -> MeetingAnalysisResponse:
    """Run preprocessing, classification, extraction, deduplication, and validation."""
    started = time.perf_counter()
    try:
        nlp = get_nlp()
        classifier = SentenceClassifier()
    except (RuntimeError, FileNotFoundError, OSError) as exc:
        raise AnalysisDependencyError(str(exc)) from exc

    try:
        cleaned = preprocess_text(request.transcript, nlp=nlp)
        transcript = cleaned["cleaned_text"]
        sentences = cleaned["sentences"]
        if not transcript or not sentences:
            raise ValueError("transcript contains no analyzable sentences")

        predictions = classifier.predict_many(sentences)
        classifications = [
            SentenceClassification(sentence=sentence, label=prediction["label"], confidence=prediction["confidence"])
            for sentence, prediction in zip(sentences, predictions, strict=True)
        ]
        label_by_sentence = {item.sentence: item.label for item in classifications}

        entities_raw = extract_entities(transcript, nlp=nlp, include_other=True)
        entities = EntityOutput(
            people=_unique([entity["text"] for entity in entities_raw if entity["label"] == "PERSON"]),
            organizations=_unique([entity["text"] for entity in entities_raw if entity["label"] == "ORG"]),
            dates=_unique([entity["text"] for entity in entities_raw if entity["label"] == "DATE"]),
            other=_unique([entity["text"] for entity in entities_raw if entity["label"] not in {"PERSON", "ORG", "DATE"}]),
        )

        meeting_reference = datetime.combine(request.meeting_date, day_time.min)
        raw_tasks = extract_tasks(transcript, nlp=nlp, classifier=classifier, reference_time=meeting_reference)
        suggestion_or_decision = re.compile(
            r"\b(?:maybe|perhaps|could|might|suggest(?:s|ed|ion)?|recommend(?:s|ed|ation)?|"
            r"propos(?:e|es|ed|al)|decid(?:e|es|ed)|approved?|selected|chose|agreed)\b",
            re.I,
        )
        raw_tasks = [
            task for task in raw_tasks
            if label_by_sentence.get(task["evidence_sentence"]) == "TASK"
            and not suggestion_or_decision.search(task["evidence_sentence"])
        ]
        raw_tasks = _deduplicate_tasks(raw_tasks)
        entities.people = _unique(
            entities.people + [task["responsible_person"] for task in raw_tasks if task["responsible_person"]]
        )
        people_keys = {person.casefold() for person in entities.people}
        entities.organizations = [org for org in entities.organizations if org.casefold() not in people_keys]
        tasks = [_make_task_output(raw, classifier, meeting_reference) for raw in raw_tasks]

        raw_decisions = extract_decisions(transcript, nlp=nlp, classifier=classifier)
        confirmed = [decision for decision in raw_decisions if decision["status"] == "CONFIRMED"]
        confirmed = _deduplicate_decisions(confirmed)
        decisions: list[DecisionOutput] = []
        for decision in confirmed:
            action = decision.get("action_verb")
            obj = decision.get("object")
            description = f"{action.capitalize()} {obj}" if action and obj else decision["evidence_sentence"]
            decisions.append(
                DecisionOutput(
                    decision_id=str(uuid4()),
                    description=description,
                    source_sentence=decision["evidence_sentence"],
                    confidence=classifier.class_probability(decision["evidence_sentence"], "DECISION"),
                )
            )

        summary_raw = summarize_meeting(transcript, top_n=5, nlp=nlp)
        action_points = [task.description for task in tasks] + [decision.description for decision in decisions]
        action_evidence = {task.source_sentence for task in tasks} | {decision.source_sentence for decision in decisions}
        context_points = [
            item["sentence"] for item in summary_raw["sentences"]
            if item["sentence"] not in action_evidence
        ]
        key_points = _unique(action_points + context_points)

        elapsed_ms = round((time.perf_counter() - started) * 1000)
        return MeetingAnalysisResponse(
            meeting=MeetingInfo(title=request.meeting_title, meeting_date=request.meeting_date),
            summary=SummaryOutput(text=summary_raw["summary"], key_points=key_points),
            entities=entities,
            classifications=classifications,
            tasks=tasks,
            decisions=decisions,
            analysis_metadata=AnalysisMetadata(
                total_sentences=len(sentences),
                tasks_found=len(tasks),
                decisions_found=len(decisions),
                processing_time_ms=elapsed_ms,
                warnings=[],
            ),
        )
    except (AnalysisDependencyError, AnalysisProcessingError):
        raise
    except Exception as exc:
        raise AnalysisProcessingError(f"Meeting analysis failed: {exc}") from exc
