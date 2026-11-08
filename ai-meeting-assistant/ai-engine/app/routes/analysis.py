"""HTTP routes for complete meeting analysis."""

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.analysis import MeetingAnalysisRequest, MeetingAnalysisResponse
from app.services.meeting_analyzer import (
    AnalysisDependencyError,
    AnalysisProcessingError,
    analyze_meeting,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["meeting analysis"])


@router.post("/analyze", response_model=MeetingAnalysisResponse)
def analyze(request: MeetingAnalysisRequest) -> MeetingAnalysisResponse:
    """Validate and analyze a provided transcript through the service layer."""
    try:
        return analyze_meeting(request)
    except AnalysisDependencyError as exc:
        logger.error("Analysis dependency unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AnalysisProcessingError as exc:
        logger.exception("Meeting analysis pipeline failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
