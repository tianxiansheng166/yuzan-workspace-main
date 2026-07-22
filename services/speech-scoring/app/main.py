"""FastAPI application for Mandarin reading speech scoring."""

from __future__ import annotations

import logging
import os
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .asr import check_audio_quality, convert_to_wav, download_audio, run_asr
from .config import SCORER_VERSION
from .models import HealthResponse, ScoreReadingRequest, ScoreReadingResponse, Scores, ToneMeta
from .scorer import score_reading

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


# Import httpx at module level for error handling
import httpx  # noqa: E402


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("SPEECH_API_PORT", "8100"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
