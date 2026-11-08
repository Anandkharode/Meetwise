"""Train a temporary model and check predictions on held-out novel examples."""

import tempfile
import unittest
from pathlib import Path

from app.classification.classifier import SentenceClassifier
from train_classifier import DATA_PATH, load_training_data, train_and_evaluate


class ClassifierTests(unittest.TestCase):
    """Smoke tests for dataset integrity, held-out training, and inference."""

    def test_dataset_has_at_least_100_unique_balanced_examples(self) -> None:
        data = load_training_data(DATA_PATH)
        self.assertGreaterEqual(len(data), 100)
        self.assertEqual(set(data.label), {"TASK", "DECISION", "SUGGESTION", "DISCUSSION"})
        self.assertTrue((data.label.value_counts() >= 25).all())

    def test_unseen_sentences_return_valid_classes_and_confidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            model_path = Path(temporary_directory) / "model.joblib"
            train_and_evaluate(model_path=model_path)
            classifier = SentenceClassifier(model_path)
            unseen = [
                "Before the next review, Lena will upload the accessibility findings.",
                "Our final choice is the shorter renewal period.",
                "Perhaps adding a glossary would make the handbook easier to use.",
                "The latest survey included responses from three offices.",
            ]
            results = classifier.predict_many(unseen)
            self.assertEqual(len(results), 4)
            self.assertTrue(
                all(result["label"] in {"TASK", "DECISION", "SUGGESTION", "DISCUSSION"} for result in results)
            )
            self.assertTrue(all(0.0 <= result["confidence"] <= 1.0 for result in results))


if __name__ == "__main__":
    unittest.main()
