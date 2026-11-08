"""FastAPI application exposing the local NLP engine."""

import logging

from fastapi import FastAPI, HTTPException

from app.nlp.entity_extractor import extract_entities
from app.nlp.preprocess import preprocess_text
from app.routes.analysis import router as analysis_router
from app.schemas.preprocessing import PreprocessRequest, PreprocessResponse

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Meeting-to-Action NLP Engine",
    description="Local, deterministic transcript preprocessing and entity extraction.",
    version="0.1.0",
)
app.include_router(analysis_router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Return a lightweight process health status."""
    return {"status": "healthy", "service": "meeting-analysis-engine"}


@app.post("/preprocess", response_model=PreprocessResponse, tags=["nlp"])
def preprocess(request: PreprocessRequest) -> PreprocessResponse:
    """Clean a transcript and return its sentences, tokens, and entities."""
    try:
        result = preprocess_text(request.text)
        entities = extract_entities(result["cleaned_text"])
        return PreprocessResponse(**result, entities=entities)
    except RuntimeError as exc:
        logger.exception("NLP pipeline is unavailable")
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Transcript preprocessing failed")
        raise HTTPException(status_code=500, detail="Transcript preprocessing failed") from exc
