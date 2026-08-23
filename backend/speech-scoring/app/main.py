"""FastAPI application for Mandarin reading speech scoring."""

from __future__ import annotations

import logging
import os
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .asr import check_audio_quality, convert_to_wav, download_audio, run_asr
from .config import OPEN_RESPONSE_SCORER_VERSION, SCORER_VERSION
from .models import (
    AnalyzeOpenResponseRequest,
    AnalyzeOpenResponseResponse,
    HealthResponse,
    OpenResponseAudioQuality,
    OpenResponseDiagnostics,
    ScoreReadingRequest,
    ScoreReadingResponse,
    Scores,
    ToneMeta,
)
from .scorer import score_reading
from .scorer import compute_fluency

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup/shutdown."""
    logger.info(f"Speech scoring service starting (version={SCORER_VERSION})")
    yield
    logger.info("Speech scoring service shutting down")


app = FastAPI(
    title="Mandarin Reading Speech Scoring",
    version=SCORER_VERSION,
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(scorerVersion=SCORER_VERSION)


@app.post("/v1/score/reading", response_model=ScoreReadingResponse)
async def score_reading_endpoint(req: ScoreReadingRequest):
    """
    Score a Mandarin reading recording against target text.

    Flow:
    1. Download audio from presigned URL
    2. Convert to 16kHz mono WAV
    3. Check audio quality
    4. Run ASR (FunASR)
    5. Score against target text
    6. Return multi-dimensional results
    """
    tmp_files: list[str] = []

    try:
        # Step 1: Download audio
        raw_path = await download_audio(req.audioUrl)
        tmp_files.append(str(raw_path))

        # Step 2: Convert to WAV
        wav_path = convert_to_wav(raw_path)
        tmp_files.append(str(wav_path))

        # Step 3: Check audio quality
        audio_quality = check_audio_quality(wav_path)
        if not audio_quality["is_acceptable"]:
            logger.warning(f"Audio quality issues: {audio_quality['issues']}")

        # Step 4: Run ASR
        asr_result = run_asr(wav_path)
        recognized_text = asr_result["text"]
        asr_confidence = asr_result["confidence"]

        if not recognized_text:
            # ASR returned empty — audio likely has no speech or ASR provider unavailable
            asr_error = asr_result.get("error")
            if asr_error == "PROVIDER_NOT_CONFIGURED":
                # FunASR not available — cannot score, must not produce fake results
                logger.error("ASR provider not configured — returning PROVIDER_NOT_CONFIGURED error")
                raise HTTPException(
                    status_code=503,
                    detail="ASR provider not configured. Speech scoring is unavailable.",
                )
            if asr_error == "ASR_INFERENCE_FAILED":
                logger.error("ASR inference failed — returning error")
                raise HTTPException(
                    status_code=500,
                    detail="ASR inference failed. The audio could not be processed.",
                )
            if asr_error == "MOCK_MODE":
                # Mock mode — return zero scores with explicit review flag
                return ScoreReadingResponse(
                    scorerVersion=SCORER_VERSION,
                    transcript="",
                    confidence=0.0,
                    scores=Scores(
                        accuracy=0.0,
                        completeness=0.0,
                        fluency=0.0,
                        tone=None,
                        overall=0.0,
                    ),
                    errors=[],
                    requiresReview=True,
                    toneMeta=ToneMeta(
                        experimental=True,
                        method=None,
                        reason="MOCK_MODE",
                    ),
                )
            # Normal empty ASR result (no speech detected)
            return ScoreReadingResponse(
                scorerVersion=SCORER_VERSION,
                transcript="",
                confidence=0.0,
                scores=Scores(
                    accuracy=0.0,
                    completeness=0.0,
                    fluency=0.0,
                    tone=None,
                    overall=0.0,
                ),
                errors=[],
                requiresReview=True,
                toneMeta=ToneMeta(
                    experimental=True,
                    method=None,
                    reason="NO_SPEECH_DETECTED",
                ),
            )

        # Step 5: Score
        duration_ms = int(audio_quality["duration_s"] * 1000)
        result = score_reading(
            target_text=req.targetText,
            recognized_text=recognized_text,
            duration_ms=duration_ms,
            wav_path=str(wav_path),
            audio_quality=audio_quality,
            asr_confidence=asr_confidence,
        )

        return result

    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error(f"Failed to download audio: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to download audio: {e}")
    except Exception as e:
        logger.error(f"Scoring failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")
    finally:
        # Cleanup temp files
        for tmp_file in tmp_files:
            try:
                os.unlink(tmp_file)
            except OSError:
                pass


@app.post("/v1/analyze/open-response", response_model=AnalyzeOpenResponseResponse)
async def analyze_open_response_endpoint(req: AnalyzeOpenResponseRequest):
    """Return audio/ASR evidence for an open speaking response.

    This endpoint deliberately does not accept target text and never computes
    semantic completeness, keyword coverage, or an examination score. Any
    formal points are assigned later by an authorized teacher.
    """

    tmp_files: list[str] = []
    started_at = __import__("time").time()

    try:
        raw_path = await download_audio(req.audioUrl)
        tmp_files.append(str(raw_path))

        wav_path = convert_to_wav(raw_path)
        tmp_files.append(str(wav_path))

        audio_quality = check_audio_quality(wav_path)
        asr_result = run_asr(wav_path)
        recognized_text = asr_result["text"]
        asr_confidence = float(asr_result.get("confidence", 0.0))
        asr_error = asr_result.get("error")

        if not recognized_text and asr_error == "PROVIDER_NOT_CONFIGURED":
            raise HTTPException(
                status_code=503,
                detail="ASR provider not configured. Open-response diagnostics are unavailable.",
            )
        if not recognized_text and asr_error == "ASR_INFERENCE_FAILED":
            raise HTTPException(
                status_code=500,
                detail="ASR inference failed. The audio could not be processed.",
            )

        duration_ms = int(float(audio_quality.get("duration_s", 0.0)) * 1000)
        speech_duration_ms = int(float(audio_quality.get("speech_duration_s", 0.0)) * 1000)
        speech_rate = None
        fluency = None
        if recognized_text and speech_duration_ms > 0:
            # This is a rate/pausing signal only. It is not a semantic score.
            speech_rate = round(len(recognized_text) / (speech_duration_ms / 1000.0), 3)
            fluency = compute_fluency(
                recognized_text,
                duration_ms,
                float(audio_quality.get("silent_ratio", 0.0)),
            )

        issues = [str(issue) for issue in audio_quality.get("issues", [])]
        if asr_error == "MOCK_MODE":
            issues.append("MOCK_MODE")
        reason_codes = ["SEMANTIC_REVIEW_REQUIRED", "LOCAL_BASELINE_UNCALIBRATED"]
        if asr_error == "MOCK_MODE":
            reason_codes.append("MOCK_MODE")
        if asr_error == "NO_SPEECH_DETECTED" or not recognized_text:
            reason_codes.append("NO_SPEECH_DETECTED")
        if asr_confidence < 0.75:
            reason_codes.append("LOW_CONFIDENCE")

        return AnalyzeOpenResponseResponse(
            scorerVersion=req.scorerVersion or OPEN_RESPONSE_SCORER_VERSION,
            transcript=recognized_text,
            confidence=asr_confidence,
            diagnostics=OpenResponseDiagnostics(
                durationMs=duration_ms,
                speechDurationMs=speech_duration_ms if speech_duration_ms > 0 else None,
                speechRate=speech_rate,
                fluency=fluency,
                silenceRatio=float(audio_quality.get("silent_ratio", 0.0)),
                audioQuality=OpenResponseAudioQuality(
                    acceptable=bool(audio_quality.get("is_acceptable", False)),
                    status="ACCEPTABLE" if audio_quality.get("is_acceptable", False) else "REVIEW_REQUIRED",
                    issues=issues,
                ),
            ),
            reasonCodes=reason_codes,
            processingMs=int((__import__("time").time() - started_at) * 1000),
        )
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error(f"Failed to download audio: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to download audio: {e}")
    except Exception as e:
        logger.error(f"Open-response diagnostic failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Open-response diagnostic failed: {e}")
    finally:
        for tmp_file in tmp_files:
            try:
                os.unlink(tmp_file)
            except OSError:
                pass


# Import httpx at module level for error handling
import httpx  # noqa: E402


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("SPEECH_API_PORT", "8100"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
