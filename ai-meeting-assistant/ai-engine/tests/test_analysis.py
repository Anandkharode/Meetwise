"""End-to-end tests for unified meeting analysis and API validation."""

import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.analysis import MeetingAnalysisRequest
from app.services.meeting_analyzer import analyze_meeting


class MeetingAnalysisTests(unittest.TestCase):
    """Exercise meeting analysis behavior using the local models."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def analyze(self, transcript: str) -> dict:
        """Call the service with the fixed reproducible meeting date."""
        request = MeetingAnalysisRequest(meeting_date="2026-11-07", transcript=transcript)
        return analyze_meeting(request).model_dump(mode="json")

    def test_multiple_tasks_and_deadlines_plus_decision(self) -> None:
        transcript = (
            "Rahul will complete the login module by Friday. "
            "Priya will test the APIs on Saturday. "
            "We decided to use JWT authentication."
        )
        result = self.analyze(transcript)
        self.assertEqual(len(result["tasks"]), 2)
        self.assertEqual(result["tasks"][0]["deadline"], {"original_text": "by Friday", "normalized_date": "2026-11-13"})
        self.assertEqual(result["tasks"][1]["deadline"]["normalized_date"], "2026-11-14")
        self.assertEqual(result["tasks"][0]["responsible_person"], "Rahul")
        self.assertEqual(result["tasks"][1]["responsible_person"], "Priya")
        self.assertEqual(len(result["decisions"]), 1)
        self.assertIn("Rahul", result["entities"]["people"])

    def test_decisions_without_tasks(self) -> None:
        result = self.analyze("The group selected the annual plan. We approved the revised schedule.")
        self.assertEqual(result["tasks"], [])
        self.assertGreaterEqual(len(result["decisions"]), 1)

    def test_suggestions_are_not_confirmed_decisions_or_tasks(self) -> None:
        result = self.analyze("Maybe we could use JWT for the next release.")
        self.assertEqual(result["decisions"], [])
        self.assertEqual(result["tasks"], [])

    def test_task_without_owner_keeps_owner_null(self) -> None:
        result = self.analyze("Please update the deployment notes by Friday.")
        self.assertTrue(result["tasks"])
        self.assertIsNone(result["tasks"][0]["responsible_person"])

    def test_task_without_deadline_keeps_deadline_null(self) -> None:
        result = self.analyze("Rahul will update the deployment notes.")
        self.assertTrue(result["tasks"])
        self.assertIsNone(result["tasks"][0]["deadline"])

    def test_ambiguous_deadline_preserves_text_and_warning(self) -> None:
        result = self.analyze("Rahul will deliver the report next week.")
        self.assertTrue(result["tasks"])
        deadline = result["tasks"][0]["deadline"]
        self.assertEqual(deadline["original_text"], "next week")
        self.assertIsNone(deadline["normalized_date"])
        self.assertTrue(result["tasks"][0]["warnings"])

    def test_duplicate_action_items_are_removed(self) -> None:
        result = self.analyze(
            "Rahul will update the deployment notes. Rahul will update the deployment notes."
        )
        self.assertEqual(len(result["tasks"]), 1)

    def test_summary_sentences_are_original_transcript_sentences(self) -> None:
        transcript = "Rahul will update the deployment notes. The group approved the release plan. Support demand rose in October."
        result = self.analyze(transcript)
        for sentence in result["summary"]["text"].split(". "):
            if sentence:
                self.assertTrue(any(sentence in original for original in transcript.split(". ")))

    def test_confidences_are_valid_probabilities(self) -> None:
        result = self.analyze("Rahul will update the deployment notes. The group approved the release plan.")
        confidences = [item["confidence"] for item in result["tasks"] + result["decisions"]]
        self.assertTrue(all(0.0 <= confidence <= 1.0 for confidence in confidences))

    def test_invalid_and_empty_requests_return_validation_errors(self) -> None:
        self.assertEqual(self.client.post("/analyze", json={"meeting_date": "2026-11-07", "transcript": " "}).status_code, 422)
        self.assertEqual(self.client.post("/analyze", json={"meeting_date": "07-11-2026", "transcript": "Text."}).status_code, 422)
        self.assertEqual(self.client.post("/analyze", json={"meeting_date": "2026-11-07"}).status_code, 422)
        self.assertEqual(self.client.post("/analyze", json={"meeting_date": "2026-11-07", "transcript": "x" * 100_001}).status_code, 422)

    def test_health_route_matches_analysis_service_contract(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "healthy", "service": "meeting-analysis-engine"})


if __name__ == "__main__":
    unittest.main()
