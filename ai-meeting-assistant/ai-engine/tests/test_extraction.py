"""Tests for dependency-based task and decision extraction edge cases."""

import unittest
from datetime import date, datetime

from app.nlp.decision_extractor import extract_decisions
from app.nlp.pipeline import get_nlp
from app.nlp.task_extractor import extract_tasks


class ExtractionTests(unittest.TestCase):
    """Ensure extraction preserves explicit evidence and avoids inference."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.nlp = get_nlp()

    def test_task_patterns_extract_owner_action_and_object(self) -> None:
        cases = [
            ("Rahul will complete the login module.", "Rahul", "complete", "login module"),
            ("Priya has to test the application.", "Priya", "test", "application"),
        ]
        for sentence, owner, action, expected_object in cases:
            with self.subTest(sentence=sentence):
                task = extract_tasks(sentence, nlp=self.nlp)[0]
                self.assertEqual(task["responsible_person"], owner)
                self.assertEqual(task["action_verb"], action)
                self.assertIn(expected_object, task["description"])
                self.assertEqual(task["evidence_sentence"], sentence)

    def test_person_merely_mentioned_is_not_assigned_owner(self) -> None:
        tasks = extract_tasks("Rahul said that the team will complete the login module.", nlp=self.nlp)
        self.assertTrue(tasks)
        self.assertIsNone(tasks[-1]["responsible_person"])

    def test_missing_deadline_and_priority_remain_unknown(self) -> None:
        task = extract_tasks("Priya has to test the application.", nlp=self.nlp)[0]
        self.assertIsNone(task["deadline"])
        self.assertIsNone(task["priority"])

    def test_explicit_priority_and_deadline_are_captured(self) -> None:
        task = extract_tasks(
            "Rahul will urgently complete the login module by Friday.",
            nlp=self.nlp,
            reference_time=datetime.combine(date(2025, 1, 6), datetime.min.time()),
        )[0]
        self.assertEqual(task["priority"], "HIGH")
        self.assertEqual(task["deadline"], "2025-01-10")
        self.assertEqual(task["deadline_text"], "by Friday")

    def test_decided_to_use_jwt_is_confirmed(self) -> None:
        decisions = extract_decisions("The team decided to use JWT.", nlp=self.nlp)
        self.assertEqual(len(decisions), 1)
        self.assertEqual(decisions[0]["status"], "CONFIRMED")
        self.assertEqual(decisions[0]["action_verb"], "use")
        self.assertEqual(decisions[0]["object"], "JWT")

    def test_suggestion_is_not_promoted_to_decision(self) -> None:
        decisions = extract_decisions("Maybe we could use JWT for the next release.", nlp=self.nlp)
        self.assertEqual(len(decisions), 1)
        self.assertEqual(decisions[0]["status"], "PROPOSED")
        self.assertEqual(decisions[0]["type"], "SUGGESTION")

    def test_rejected_proposal_is_distinguished(self) -> None:
        decisions = extract_decisions("The team rejected the proposal to use JWT.", nlp=self.nlp)
        self.assertEqual(len(decisions), 1)
        self.assertEqual(decisions[0]["status"], "REJECTED")

    def test_ordinary_discussion_is_not_a_decision(self) -> None:
        self.assertEqual(extract_decisions("The team discussed JWT during the call.", nlp=self.nlp), [])


if __name__ == "__main__":
    unittest.main()
