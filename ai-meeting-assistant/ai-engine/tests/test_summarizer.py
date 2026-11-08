"""Tests for TF-IDF extractive summarization."""

import unittest

from app.nlp.pipeline import get_nlp
from app.nlp.summarizer import summarize_meeting


class SummarizerTests(unittest.TestCase):
    """Check length handling, ordering, scoring, and duplicate removal."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.nlp = get_nlp()

    def test_empty_and_one_sentence_transcripts(self) -> None:
        empty = summarize_meeting("", nlp=self.nlp)
        self.assertEqual(empty["sentences"], [])
        short = summarize_meeting("The launch date is Monday.", nlp=self.nlp)
        self.assertEqual(short["sentences"][0]["sentence"], "The launch date is Monday.")

    def test_prioritizes_actions_and_decisions_but_keeps_relevant_context(self) -> None:
        transcript = (
            "The project serves customers in three regions. "
            "The team decided to use the existing support portal. "
            "Rahul will prepare the migration checklist by Friday. "
            "The latest survey found that response times vary by region. "
            "The project began after the winter planning cycle. "
            "Priya will review the accessibility results next week."
        )
        result = summarize_meeting(transcript, top_n=4, nlp=self.nlp)
        chosen = [item["sentence"] for item in result["sentences"]]
        self.assertIn("The team decided to use the existing support portal.", chosen)
        self.assertIn("Rahul will prepare the migration checklist by Friday.", chosen)
        self.assertIn("The latest survey found that response times vary by region.", chosen)
        self.assertEqual(chosen, sorted(chosen, key=transcript.index))
        self.assertTrue(all(0.0 <= item["importance"] <= 1.0 for item in result["sentences"]))

    def test_near_duplicate_sentences_are_not_repeated(self) -> None:
        transcript = (
            "The team decided to adopt the new access review policy. "
            "The team decided to adopt the new access review policy. "
            "Customer feedback described slower page loading."
        )
        result = summarize_meeting(transcript, top_n=3, nlp=self.nlp)
        selected = [item["sentence"] for item in result["sentences"]]
        self.assertEqual(selected.count("The team decided to adopt the new access review policy."), 1)

    def test_top_n_zero_returns_no_summary(self) -> None:
        result = summarize_meeting("A useful short note.", top_n=0, nlp=self.nlp)
        self.assertEqual(result["summary"], "")
        self.assertEqual(result["sentences"], [])


if __name__ == "__main__":
    unittest.main()
