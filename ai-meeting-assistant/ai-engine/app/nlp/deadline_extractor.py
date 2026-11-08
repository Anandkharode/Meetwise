"""Conservative extraction and normalization of explicit meeting deadlines."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import TypedDict

import dateparser

_DATE_PATTERN = re.compile(
    r"\b(?P<full>(?:(?:by|before|on|due|until)\s+)?(?P<date>next\s+week|next\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|"
    r"(?:this\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|"
    r"tomorrow|today|\d{1,2}(?:st|nd|rd|th)?\s+\w+|\w+\s+\d{1,2}(?:,?\s+\d{4})?))\b",
    re.I,
)
_AMBIGUOUS = {"next week"}


class Deadline(TypedDict):
    """A deadline with normalized date and its exact transcript wording."""

    date: str | None
    original_text: str | None


def _reference_datetime(meeting_date: date | datetime | str) -> datetime | None:
    """Parse an explicit meeting date to midnight; reject invalid references."""
    if isinstance(meeting_date, datetime):
        return meeting_date
    if isinstance(meeting_date, date):
        return datetime.combine(meeting_date, datetime.min.time())
    parsed = dateparser.parse(meeting_date, settings={"PREFER_DATES_FROM": "past"})
    return parsed


def extract_deadline(
    text: str,
    meeting_date: date | datetime | str,
) -> Deadline:
    """Find a date phrase and normalize it relative to the meeting date.

    Ambiguous phrases (including the range implied by ``next week``) and
    unparseable dates return ``None`` for both fields. The original matched
    wording is returned unchanged for successfully normalized dates.
    """
    reference = _reference_datetime(meeting_date)
    if reference is None:
        return {"date": None, "original_text": None}

    for match in _DATE_PATTERN.finditer(text):
        original = match.group("full")
        date_phrase = match.group("date")
        normalized = " ".join(date_phrase.casefold().split())
        if normalized in _AMBIGUOUS:
            return {"date": None, "original_text": original}
        settings = {
            "RELATIVE_BASE": reference,
            "PREFER_DATES_FROM": "future",
            "PREFER_DAY_OF_MONTH": "first",
            "STRICT_PARSING": False,
        }
        parsed = dateparser.parse(date_phrase, settings=settings)
        if parsed is None:
            return {"date": None, "original_text": original}
        # A bare weekday can refer to this week's already-past occurrence or
        # an upcoming one. Meeting deadlines conventionally mean the upcoming
        # weekday; dateparser's future preference resolves this explicitly.
        return {"date": parsed.date().isoformat(), "original_text": original}
    return {"date": None, "original_text": None}


def extract_deadlines(text: str, meeting_date: date | datetime | str) -> list[Deadline]:
    """Return a deadline record for each sentence that contains a date phrase."""
    records: list[Deadline] = []
    for sentence in re.split(r"(?<=[.!?])\s+", text.strip()):
        if sentence:
            record = extract_deadline(sentence, meeting_date)
            if record["original_text"] is not None:
                records.append(record)
    return records
