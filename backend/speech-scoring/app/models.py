"""Pydantic models for the speech scoring API."""

from __future__ import annotations

from typing import Literal

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


class AnalyzeOpenResponseRequest(BaseModel):
    """Request body for POST /v1/analyze/open-response.

    There is intentionally no target text. Picture-speaking is an open
    response and the local service only returns audio/ASR evidence for a
    teacher; it does not attempt semantic scoring.
    """

    audioUrl: str = Field(..., description="Presigned download URL for the recording")
    language: str = Field(default="zh-CN", description="Language code")
    scorerVersion: str = Field(
        default="mandarin-open-response-v0.1.0",
        description="Version of the open-response diagnostic model",
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


class OpenResponseAudioQuality(BaseModel):
    """Bounded audio-quality evidence; this is not a semantic score."""

    acceptable: bool
    status: Literal["ACCEPTABLE", "REVIEW_REQUIRED"]
    issues: list[str] = Field(default_factory=list)


class OpenResponseDiagnostics(BaseModel):
    """Acoustic/ASR evidence for teacher review only."""

    durationMs: int = Field(..., ge=0)
    speechDurationMs: int | None = Field(default=None, ge=0)
    speechRate: float | None = Field(default=None, ge=0, le=20)
    silenceRatio: float | None = Field(default=None, ge=0, le=1)
    fluency: float | None = Field(default=None, ge=0, le=100)
    audioQuality: OpenResponseAudioQuality


class AnalyzeOpenResponseResponse(BaseModel):
    """Provider-neutral open-response diagnostic response.

    The response is explicitly experimental and always reviewable. It has no
    accuracy/completeness/tone-against-target fields because an open response
    has no target text.
    """

    provider: Literal["local"] = "local"
    strategy: Literal["SPEECH_OPEN_RESPONSE"] = "SPEECH_OPEN_RESPONSE"
    experimental: Literal[True] = True
    scorerVersion: str
    transcript: str = Field(..., description="ASR transcript retained server-side")
    confidence: float = Field(..., ge=0, le=1, description="ASR confidence")
    diagnostics: OpenResponseDiagnostics
    requiresReview: Literal[True] = True
    reasonCodes: list[str] = Field(default_factory=list)
    processingMs: int | None = Field(default=None, ge=0)


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    scorerVersion: str
