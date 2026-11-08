# AI Meeting-to-Action NLP Engine

A local, deterministic NLP service built with Python 3.11, spaCy, and FastAPI. It does not call LLMs or cloud NLP services.

## Modules

- `app/nlp/pipeline.py`: loads and caches spaCy's `en_core_web_sm` model.
- `app/nlp/preprocess.py`: removes control characters, normalizes whitespace, splits sentences, and returns lowercase token strings.
- `app/nlp/entity_extractor.py`: extracts spaCy `PERSON`, `DATE`, and `ORG` entities.
- `app/classification/classifier.py`: loads the saved TF-IDF and Logistic Regression pipeline and returns a label with its probability estimate.
- `app/nlp/task_extractor.py`: extracts task actions, dependency-linked owners, explicit deadlines, and stated priorities.
- `app/nlp/decision_extractor.py`: separates confirmed decisions, suggestions, and rejected proposals.
- `app/nlp/deadline_extractor.py`: parses explicit dates relative to a meeting date, returning ISO dates and original wording.
- `app/nlp/summarizer.py`: ranks and deduplicates original transcript sentences with TF-IDF and cosine similarity.
- `app/services/meeting_analyzer.py`: orchestrates preprocessing, classification, entity/task/decision/deadline extraction, summarization, deduplication, and output validation.
- `app/routes/analysis.py`: exposes the business service through `POST /analyze`.
- `app/schemas/analysis.py`: validates analysis inputs and typed output structures.
- `app/schemas/preprocessing.py`: defines validated Pydantic request and response shapes.
- `app/main.py`: exposes `/health` and `/preprocess`, with clear model-unavailable and generic error responses.
- `tests/test_preprocess.py`: preprocessing unit tests using Python's standard `unittest` framework.
- `training_data.csv`: balanced labeled sentence examples for TASK, DECISION, SUGGESTION, and DISCUSSION.
- `train_classifier.py`: validates the dataset, creates a stratified holdout split, fits a TF-IDF/Logistic Regression pipeline, prints evaluation metrics, and saves it to `models/sentence_classifier.joblib`.
- `tests/test_classifier.py`: checks dataset integrity and inference on newly written sentences.

## Sentence classification

The classifier is traditional supervised machine learning. TF-IDF (term frequency–inverse document frequency) turns sentences into sparse numeric features: words or word pairs receive higher weights when they are useful for distinguishing examples and are less common across the corpus. The vectorizer uses unigrams and bigrams. Logistic Regression learns class weights from those features and returns a probability distribution; the highest probability supplies the predicted class and the `confidence` value. This probability is a model estimate, not a guarantee of correctness or a calibrated confidence score.

Train and evaluate from this directory:

```powershell
python train_classifier.py
```

Load and use it in Python after training:

```python
from app.classification.classifier import SentenceClassifier

classifier = SentenceClassifier()
print(classifier.predict("Please send the draft to Noor before Thursday."))
```

The script holds out 25% of rows using a stratified split, fits TF-IDF only on the training portion, and reports per-class precision, recall, F1, and a confusion matrix. Its current synthetic set has 158 unique rows (39–40 per class). The observed held-out accuracy is about 0.57 (macro F1 about 0.58); these are baseline diagnostics on generated examples, not evidence of production performance. Synthetic writing is narrow and may not represent real meeting language, class boundaries can be ambiguous, and a random sentence split can overstate generalization to new speakers or organizations. Validate on representative, human-labeled meetings and preferably split by meeting before deployment.

Run all tests with `python -m unittest discover -s tests -v`.

## Deadline extraction and extractive summaries

```python
from datetime import date
from app.nlp.deadline_extractor import extract_deadline
from app.nlp.summarizer import summarize_meeting

deadline = extract_deadline("Rahul will finish the module by next Monday.", date(2025, 1, 8))
summary = summarize_meeting(transcript, top_n=5)
```

Deadline extraction uses the supplied meeting date as the reference for relative dates and returns `{"date": "YYYY-MM-DD", "original_text": "..."}`. Missing, invalid, and ambiguous dates return null fields; `next week` is treated as ambiguous because it describes a range rather than one date. A bare weekday resolves to its upcoming occurrence relative to the meeting date.

Summarization is extractive: it returns verbatim transcript sentences, their normalized importance scores, and a combined summary string. TF-IDF sentence scores represent term relevance in that transcript; cosine similarity suppresses redundant sentences. Explicit task and decision phrasing gets a modest boost, while other high-scoring context can still be selected. Selected sentences are returned in original order. No generated text is added.

## Task and decision extraction

```python
from app.nlp.task_extractor import extract_tasks
from app.nlp.decision_extractor import extract_decisions

tasks = extract_tasks("Rahul will complete the login module by Friday.")
decisions = extract_decisions("The team decided to use JWT.")
```

Both functions return JSON-serializable lists with `confidence` and the original `evidence_sentence`. Task owners are taken from syntactic subjects, not every person mentioned in the sentence; missing owners, dates, and priorities remain `null`. Priority is returned only for explicit high/medium/low wording. Decision status comes from linguistic cues, with the trained sentence classifier used as supporting confidence evidence. Suggestions remain `PROPOSED`; rejection cues are represented as `REJECTED`.

These are heuristic extraction rules over spaCy's statistical dependency parser and NER, not a guarantee of correct interpretation. In particular, reported speech, implicit subjects, negation scope, and relative dates can be ambiguous. Date strings are normalized using the current date unless a `reference_time` is passed to `extract_tasks`; provide a fixed reference time for reproducible relative-date interpretation. Review extracted records before treating them as authoritative actions or decisions.

## Setup and run (PowerShell)

```powershell
cd ai-meeting-assistant\ai-engine
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app.main:app --reload
```

The workspace's existing virtual environment already has the dependencies and model. From the `ai-engine` directory, run unit tests with `python -m unittest discover -s tests -v`. Interactive API documentation is at `http://127.0.0.1:8000/docs`.

## Endpoints

- `GET /health` returns `{"status":"ok"}`.
- `POST /preprocess` accepts `{"text":"..."}` and returns `cleaned_text`, `sentences`, `tokens`, and `entities`.

Example request:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/preprocess -ContentType 'application/json' -Body '{"text":"Alice will send the notes to Acme on Friday."}'
```

## Unified meeting analysis API

`POST /analyze` accepts JSON with optional `meeting_title`, a required ISO `meeting_date`, and a required non-empty transcript (maximum 100,000 characters). Audio input is intentionally not accepted. The service uses the supplied meeting date for relative deadline parsing and returns 422 for invalid input, 503 when a required local model is unavailable, and 500 when a required analysis step fails.

Start the service from this directory:

```powershell
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Example PowerShell request:

```powershell
$payload = @{
    meeting_title = 'Project Development Meeting'
    meeting_date = '2026-11-07'
    transcript = 'Rahul will complete the login module by Friday. Priya will test the APIs on Saturday. We decided to use JWT authentication.'
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/analyze -ContentType 'application/json' -Body $payload
```

The analyzer uses the existing local spaCy model, trained scikit-learn classifier, extraction modules, dateparser, and TF-IDF summarizer. RapidFuzz removes near-duplicate tasks and decisions. Classifier confidence fields are the saved model's class probabilities; this small synthetic training corpus has weak held-out performance (about 0.57 accuracy), so those scores are not calibrated confidence or a production guarantee. spaCy NER and dependency parsing can also mislabel entities or relationships; review outputs for high-impact use.
