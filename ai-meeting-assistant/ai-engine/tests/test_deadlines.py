"""Tests for meeting-date-relative deadline extraction."""

import unittest
from datetime import date

from app.nlp.deadline_extractor import extract_deadline


class DeadlineTests(unittest.TestCase):
    """Verify normalized values and exact source date phrases."""

    def test_relative_phrases_use_each_meeting_date(self) -> None:
        cases = [
            ("Finish the draft by Friday.", date(2025, 1, 6), "2025-01-10", "by Friday"),
            ("Send the notes tomorrow.", date(2025, 1, 6), "2025-01-07", "tomorrow"),
            ("Review this next Monday.", date(2025, 1, 8), "2025-01-13", "next Monday"),
        ]
        for text, meeting_date, expected, original in cases:
            with self.subTest(text=text, meeting_date=meeting_date):
                self.assertEqual(
                    extract_deadline(text, meeting_date),
                    {"date": expected, "original_text": original},
                )

    def test_same_weekday_relative_to_different_meeting_dates(self) -> None:
        first = extract_deadline("Due Friday", date(2025, 1, 6))
        second = extract_deadline("Due Friday", date(2025, 1, 13))
        self.assertEqual(first["date"], "2025-01-10")
        self.assertEqual(second["date"], "2025-01-17")

    def test_ambiguous_next_week_and_missing_dates_are_null(self) -> None:
        self.assertEqual(
            extract_deadline("We should finish next week", date(2025, 1, 6)),
            {"date": None, "original_text": "next week"},
        )
        self.assertEqual(
            extract_deadline("We should finish the work", date(2025, 1, 6)),
            {"date": None, "original_text": None},
        )


if __name__ == "__main__":
    unittest.main()
