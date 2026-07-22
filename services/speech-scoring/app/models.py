"""Pydantic models for the speech scoring API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ScoreReadingRequest(BaseModel):
    """Request body for POST /v1/score/reading."""

    audioUrl: str = Field(..., description="Presigned download URL for the recording")
    targetText: str = Field(..., description="The text the student was supposed to read")
    language: str = Field(default="zh-CN", description="Language code")
    scorerVersion: str = Field(
        default="mandarin-reading-v0.1.0",
        description="Version of the scoring model",
    )


class ScoreError(BaseModel):
    """A single scoring error (mispronunciation, tone deviation, etc.)."""

    text: str = Field(..., description="The character or word with the error")
    pinyin: str = Field(..., description="Pinyin with tone number")
    startMs: int = Field(..., description="Start time in milliseconds")
    endMs: int = Field(..., description="End time in milliseconds")
    type: str = Field(..., description="Error type: substitution, omission, insertion, tone-deviation, etc.")
    score: float = Field(..., description="Score for this specific item (0-100)")


class Scores(BaseModel):
    """Multi-dimensional scoring result."""

    accuracy: float = Field(..., ge=0, le=100, description="Pronunciation accuracy")
    completeness: float = Field(..., ge=0, le=100, description="Text completeness")
    fluency: float = Field(..., ge=0, le=100, description="Reading fluency")
    tone: float | None = Field(
        default=None,
        description="Tone accuracy (null when tone scoring unavailable or experimental)",
    )
    overall: float = Field(..., ge=0, le=100, description="Weighted overall score")


class ToneMeta(BaseModel):
    """Metadata about tone scoring method and reliability."""

    experimental: bool = Field(
        default=True,
        description="Whether tone scoring is experimental (not exam-grade)",
    )
    method: str | None = Field(
        default=None,
        description="Scoring method: 'parselmouth', 'f0_cv_heuristic', or null if unavailable",
    )
    reason: str | None = Field(
        default=None,
        description="Reason when tone score is null: TONE_SCORING_UNAVAILABLE, TONE_ANALYSIS_FAILED",
    )


class ScoreReadingResponse(BaseModel):
    """Response body for POST /v1/score/reading."""

    scorerVersion: str
    transcript: str = Field(..., description="ASR recognized text")
    confidence: float = Field(..., ge=0, le=1, description="ASR confidence")
    scores: Scores
    errors: list[ScoreError] = Field(default_factory=list)
    requiresReview: bool = Field(
        default=False,
        description="Whether manual teacher review is needed",
    )
    toneMeta: ToneMeta | None = Field(
        default=None,
        description="Tone scoring metadata (experimental status, method, reason if unavailable)",
    )
    processingMs: int | None = Field(
        default=None,
        description="Processing time in milliseconds",
    )


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    scorerVersion: str
