"""Load the trained scikit-learn pipeline and predict sentence categories."""

from __future__ import annotations

from pathlib import Path
from typing import TypedDict

import joblib
from sklearn.pipeline import Pipeline

DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "sentence_classifier.joblib"


class Prediction(TypedDict):
    """Predicted label and its Logistic Regression probability estimate."""

    label: str
    confidence: float


class SentenceClassifier:
    """Inference wrapper around the persisted TF-IDF/logistic pipeline."""

    def __init__(self, model_path: Path | str = DEFAULT_MODEL_PATH) -> None:
        """Load a fitted joblib pipeline from disk."""
        path = Path(model_path)
        if not path.is_file():
            raise FileNotFoundError(f"Trained classifier not found at {path}; run train_classifier.py first")
        self._model: Pipeline = joblib.load(path)

    def predict(self, sentence: str) -> Prediction:
        """Return the most likely category and its model probability estimate."""
        if not sentence.strip():
            raise ValueError("sentence must contain non-whitespace text")
        probabilities = self._model.predict_proba([sentence])[0]
        index = int(probabilities.argmax())
        return {"label": str(self._model.classes_[index]), "confidence": float(probabilities[index])}

    def predict_many(self, sentences: list[str]) -> list[Prediction]:
        """Predict labels and confidence estimates for multiple sentences."""
        if not sentences:
            return []
        if any(not sentence.strip() for sentence in sentences):
            raise ValueError("sentences must not contain blank text")
        probabilities = self._model.predict_proba(sentences)
        return [
            {"label": str(self._model.classes_[int(row.argmax())]), "confidence": float(row.max())}
            for row in probabilities
        ]

    def class_probability(self, sentence: str, label: str) -> float:
        """Return the fitted model's probability for one requested class."""
        if not sentence.strip():
            raise ValueError("sentence must contain non-whitespace text")
        try:
            class_index = list(self._model.classes_).index(label.upper())
        except ValueError as exc:
            raise ValueError(f"Unknown classifier label: {label}") from exc
        return float(self._model.predict_proba([sentence])[0][class_index])
