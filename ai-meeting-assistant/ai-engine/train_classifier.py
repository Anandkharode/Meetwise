"""Train and evaluate a TF-IDF plus Logistic Regression sentence classifier."""

from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "training_data.csv"
MODEL_PATH = ROOT / "models" / "sentence_classifier.joblib"
EXPECTED_LABELS = {"TASK", "DECISION", "SUGGESTION", "DISCUSSION"}


def load_training_data(path: Path = DATA_PATH) -> pd.DataFrame:
    """Load and validate labeled sentence examples, rejecting duplicates."""
    data = pd.read_csv(path)
    if not {"sentence", "label"}.issubset(data.columns):
        raise ValueError("CSV must contain 'sentence' and 'label' columns")
    data = data[["sentence", "label"]].dropna().copy()
    data["sentence"] = data["sentence"].astype(str).str.strip()
    data["label"] = data["label"].astype(str).str.strip().str.upper()
    data = data[data["sentence"].ne("")]
    normalized = data["sentence"].str.casefold().str.replace(r"\s+", " ", regex=True)
    if normalized.duplicated().any():
        duplicates = data.loc[normalized.duplicated(keep=False), "sentence"].tolist()
        raise ValueError(f"Duplicate sentence examples found: {duplicates}")
    labels = set(data["label"])
    if labels != EXPECTED_LABELS:
        raise ValueError(f"Expected exactly {sorted(EXPECTED_LABELS)}, got {sorted(labels)}")
    if data["label"].value_counts().min() < 2:
        raise ValueError("Each class needs at least two examples for a stratified split")
    return data.reset_index(drop=True)


def train_and_evaluate(
    data_path: Path = DATA_PATH,
    model_path: Path = MODEL_PATH,
    test_size: float = 0.25,
    random_state: int = 42,
) -> dict[str, object]:
    """Stratify data, fit an unfitted-on-test pipeline, print metrics, and save."""
    data = load_training_data(data_path)
    x_train, x_test, y_train, y_test = train_test_split(
        data["sentence"], data["label"],
        test_size=test_size,
        random_state=random_state,
        stratify=data["label"],
    )
    model = Pipeline(
        steps=[
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), lowercase=True, sublinear_tf=True)),
            ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=random_state)),
        ]
    )
    model.fit(x_train, y_train)
    predictions = model.predict(x_test)
    classes = sorted(EXPECTED_LABELS)
    report = classification_report(y_test, predictions, labels=classes, output_dict=True, zero_division=0)
    matrix = confusion_matrix(y_test, predictions, labels=classes)

    print(f"Rows: {len(data)} | train: {len(x_train)} | test: {len(x_test)}")
    print("Class counts:\n", data["label"].value_counts().sort_index().to_string())
    print("\nHeld-out classification report:\n", classification_report(y_test, predictions, labels=classes, zero_division=0))
    print("Confusion matrix (rows=true, columns=predicted; order=" + ", ".join(classes) + "):\n", matrix)

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)
    print(f"Saved model: {model_path}")
    return {"model": model, "report": report, "confusion_matrix": matrix, "classes": classes}


def main() -> None:
    """Parse optional paths and run model training."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA_PATH, help="Labeled CSV path")
    parser.add_argument("--model", type=Path, default=MODEL_PATH, help="Output joblib path")
    parser.add_argument("--test-size", type=float, default=0.25, help="Fraction reserved for test")
    args = parser.parse_args()
    train_and_evaluate(args.data, args.model, args.test_size)


if __name__ == "__main__":
    main()
