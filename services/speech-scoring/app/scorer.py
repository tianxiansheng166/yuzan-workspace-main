"""Mandarin reading scoring engine.

Computes accuracy, completeness, fluency, tone, and overall scores
for read-aloud speech against a target text.
"""

from __future__ import annotations

import logging
import time

from .config import (
    CONFIDENCE_REVIEW_THRESHOLD,
    LOW_SCORE_REVIEW_THRESHOLD,
    MAX_SILENCE_RATIO,
    MAX_WORDS_PER_SECOND,
    MIN_RECORDING_MS,
    MIN_WORDS_PER_SECOND,
    SCORE_WEIGHTS,
    SCORER_VERSION,
)
from .models import ScoreError, ScoreReadingResponse, Scores, ToneMeta

logger = logging.getLogger(__name__)


def align_texts(recognized: str, target: str) -> dict:
    """
    Align recognized text with target text using character-level comparison.

    Returns:
        dict with keys: correct, substitutions, omissions, insertions, aligned
    """
    # Normalize: remove spaces, punctuation
    import re

    def normalize(text: str) -> str:
        return re.sub(r"[^\u4e00-\u9fff]", "", text)

    rec_chars = list(normalize(recognized))
    tgt_chars = list(normalize(target))

    # Simple alignment using edit distance approach
    correct: list[str] = []
    substitutions: list[dict] = []
    omissions: list[str] = []
    insertions: list[str] = []

    # Use simple longest common subsequence alignment
    i, j = 0, 0
    while i < len(tgt_chars) or j < len(rec_chars):
        if i < len(tgt_chars) and j < len(rec_chars):
            if tgt_chars[i] == rec_chars[j]:
                correct.append(tgt_chars[i])
                i += 1
                j += 1
            else:
                # Look ahead to see if there's a match soon
                found_match = False
                for look in range(1, min(3, len(rec_chars) - j)):
                    if tgt_chars[i] == rec_chars[j + look]:
                        # Characters in between are insertions
                        for k in range(look):
                            insertions.append(rec_chars[j + k])
                        j += look
                        found_match = True
                        break

                if not found_match:
                    for look in range(1, min(3, len(tgt_chars) - i)):
                        if tgt_chars[i + look] == rec_chars[j]:
                            # Characters in between are omissions
                            for k in range(look):
                                omissions.append(tgt_chars[i + k])
                            i += look
                            found_match = True
                            break

                if not found_match:
                    substitutions.append({
                        "target": tgt_chars[i],
                        "recognized": rec_chars[j],
                    })
                    i += 1
                    j += 1
        elif i < len(tgt_chars):
            omissions.append(tgt_chars[i])
            i += 1
        else:
            insertions.append(rec_chars[j])
            j += 1

    return {
        "correct": correct,
        "substitutions": substitutions,
        "omissions": omissions,
        "insertions": insertions,
        "target_length": len(tgt_chars),
        "recognized_length": len(rec_chars),
    }


def get_pinyin_with_tone(char: str) -> str:
    """Get pinyin with tone number for a Chinese character."""
    try:
        from pypinyin import pinyin, Style

        result = pinyin(char, style=Style.TONE3, strict=False)
        if result:
            return result[0][0]
    except ImportError:
        pass
    return char


def compute_accuracy(alignment: dict) -> float:
    """Compute accuracy score (0-100) based on alignment."""
    target_len = alignment["target_length"]
    if target_len == 0:
        return 0.0

    correct_count = len(alignment["correct"])
    sub_count = len(alignment["substitutions"])

    # Penalize substitutions more than omissions
    accuracy = (correct_count / target_len) * 100.0

    # Slight penalty for substitutions
    if sub_count > 0:
        sub_penalty = min(sub_count * 5, 30)
        accuracy = max(0, accuracy - sub_penalty)

    return round(min(100.0, max(0.0, accuracy)), 1)


def compute_completeness(alignment: dict) -> float:
    """Compute completeness score (0-100) — how much of target was read."""
    target_len = alignment["target_length"]
    if target_len == 0:
        return 0.0

    correct_count = len(alignment["correct"])
    sub_count = len(alignment["substitutions"])

    # Characters that were read (correct or substituted)
    read_count = correct_count + sub_count
    completeness = (read_count / target_len) * 100.0

    return round(min(100.0, max(0.0, completeness)), 1)


def compute_fluency(
    recognized_text: str,
    duration_ms: int,
    silence_ratio: float = 0.0,
) -> float:
    """Compute fluency score (0-100) based on speech rate and pauses."""
    if duration_ms <= 0:
        return 0.0

    duration_s = duration_ms / 1000.0
    char_count = len(recognized_text)

    if char_count == 0:
        return 0.0

    # Words per second (Chinese: ~1 char = 1 syllable)
    words_per_second = char_count / duration_s

    # Ideal range: 2-4 characters per second
    if 2.0 <= words_per_second <= 4.0:
        rate_score = 100.0
    elif words_per_second < 2.0:
        # Too slow
        rate_score = max(0, (words_per_second / 2.0) * 100.0)
    else:
        # Too fast
        rate_score = max(0, 100.0 - (words_per_second - 4.0) * 20.0)

    # Penalize excessive silence
    silence_penalty = 0.0
    if silence_ratio > 0.3:
        silence_penalty = (silence_ratio - 0.3) * 100.0

    fluency = rate_score - silence_penalty
    return round(min(100.0, max(0.0, fluency)), 1)


def compute_tone(
    wav_path: str | None = None,
    alignment: dict | None = None,
) -> dict:
    """
    Compute tone score (0-100) based on pitch analysis.

    Uses praat-parselmouth for F0 extraction when available.
    Falls back to heuristic based on alignment quality.

    Returns:
        dict with keys: score (float | None), method (str | None), reason (str | None), experimental (bool)

    When tone scoring is unavailable, returns score=None with a reason
    instead of a fake default score. The caller must redistribute the
    tone weight (0.20) to other dimensions when score is None.
    """
    # ── No audio path: tone scoring unavailable ───────────
    if wav_path is None:
        if alignment is None:
            # No audio and no alignment — cannot score tone at all
            return {
                "score": None,
                "method": None,
                "reason": "TONE_SCORING_UNAVAILABLE",
                "experimental": True,
            }
        # Heuristic fallback — mark as experimental, not exam-grade
        target_len = alignment.get("target_length", 0)
        if target_len == 0:
            return {
                "score": None,
                "method": None,
                "reason": "TONE_SCORING_UNAVAILABLE",
                "experimental": True,
            }
        correct_ratio = len(alignment.get("correct", [])) / target_len
        return {
            "score": round(50.0 + correct_ratio * 40.0, 1),
            "method": "f0_cv_heuristic",
            "reason": None,
            "experimental": True,
        }

    # ── Try parselmouth for F0 analysis ───────────────────
    try:
        import parselmouth
        from parselmouth.praat import call

        sound = parselmouth.Sound(wav_path)
        pitch = call(sound, "To Pitch", 0.0, 75, 600)  # 75-600 Hz F0 range

        # Get F0 values
        f0_values = []
        for i in range(pitch.get_number_of_frames()):
            f0 = pitch.get_value_in_frame(i + 1)
            if f0 != 0 and not np_isnan(f0):
                f0_values.append(f0)

        if len(f0_values) < 2:
            return {
                "score": None,
                "method": "parselmouth",
                "reason": "TONE_ANALYSIS_FAILED",
                "experimental": True,
            }

        # Check F0 variability (Mandarin tones should have characteristic patterns)
        import numpy as np

        f0_array = np.array(f0_values)
        f0_cv = np.std(f0_array) / np.mean(f0_array)  # coefficient of variation

        # Mandarin speech with good tones has moderate F0 variation
        # Too flat = monotone (poor tones), too variable = unstable
        if 0.05 <= f0_cv <= 0.30:
            tone_score = 80.0 + (1.0 - abs(f0_cv - 0.15) / 0.15) * 20.0
        elif f0_cv < 0.05:
            tone_score = 40.0 + f0_cv / 0.05 * 40.0
        else:
            tone_score = max(30.0, 80.0 - (f0_cv - 0.30) * 200.0)

        return {
            "score": round(min(100.0, max(0.0, tone_score)), 1),
            "method": "parselmouth",
            "reason": None,
            "experimental": True,  # Still experimental — not per-syllable analysis
        }

    except ImportError:
        logger.warning("parselmouth not available — tone scoring uses heuristic fallback")
        return compute_tone(wav_path=None, alignment=alignment)
    except Exception as e:
        logger.warning(f"Tone analysis failed: {e}")
        # Do NOT return a fake default score (was 60.0)
        return {
            "score": None,
            "method": None,
            "reason": "TONE_ANALYSIS_FAILED",
            "experimental": True,
        }


def np_isnan(val: float) -> bool:
    """Check if value is NaN without importing numpy at module level."""
    import math
    return math.isnan(val)


def score_reading(
    target_text: str,
    recognized_text: str,
    duration_ms: int,
    wav_path: str | None = None,
    audio_quality: dict | None = None,
    asr_confidence: float = 0.9,
) -> ScoreReadingResponse:
    """
    Main scoring function for read-aloud Mandarin text.

    Returns a ScoreReadingResponse with all dimensions and errors.
    """
    start_time = time.time()

    # Step 1: Align texts
    alignment = align_texts(recognized_text, target_text)

    # Step 2: Compute individual scores
    accuracy = compute_accuracy(alignment)
    completeness = compute_completeness(alignment)

    silence_ratio = 0.0
    if audio_quality and "silent_ratio" in audio_quality:
        silence_ratio = audio_quality["silent_ratio"]
    fluency = compute_fluency(recognized_text, duration_ms, silence_ratio)

    tone_result = compute_tone(wav_path=wav_path, alignment=alignment)
    tone_score = tone_result["score"]
    tone_meta = ToneMeta(
        experimental=tone_result["experimental"],
        method=tone_result.get("method"),
        reason=tone_result.get("reason"),
    )

    # Step 3: Compute weighted overall score
    # When tone is None (unavailable), redistribute tone weight to accuracy and completeness
    if tone_score is not None:
        overall = (
            accuracy * SCORE_WEIGHTS["accuracy"]
            + completeness * SCORE_WEIGHTS["completeness"]
            + fluency * SCORE_WEIGHTS["fluency"]
            + tone_score * SCORE_WEIGHTS["tone"]
        )
    else:
        # Redistribute tone weight: 0.10 to accuracy, 0.10 to completeness
        redistributed_weights = {
            "accuracy": SCORE_WEIGHTS["accuracy"] + 0.10,   # 0.40 + 0.10 = 0.50
            "completeness": SCORE_WEIGHTS["completeness"] + 0.10,  # 0.20 + 0.10 = 0.30
            "fluency": SCORE_WEIGHTS["fluency"],  # 0.20
        }
        overall = (
            accuracy * redistributed_weights["accuracy"]
            + completeness * redistributed_weights["completeness"]
            + fluency * redistributed_weights["fluency"]
        )
    overall = round(overall, 1)

    # Step 4: Build error details
    errors: list[ScoreError] = []
    for sub in alignment.get("substitutions", []):
        pinyin = get_pinyin_with_tone(sub["target"])
        errors.append(ScoreError(
            text=sub["target"],
            pinyin=pinyin,
            startMs=0,  # Would need timestamp alignment
            endMs=0,
            type="substitution",
            score=60.0,  # Default penalty score
        ))

    for omitted in alignment.get("omissions", []):
        pinyin = get_pinyin_with_tone(omitted)
        errors.append(ScoreError(
            text=omitted,
            pinyin=pinyin,
            startMs=0,
            endMs=0,
            type="omission",
            score=0.0,
        ))

    # Step 5: Determine if review is needed
    requires_review = _should_require_review(
        asr_confidence=asr_confidence,
        overall=overall,
        audio_quality=audio_quality,
        alignment=alignment,
        duration_ms=duration_ms,
    )

    processing_ms = int((time.time() - start_time) * 1000)
    logger.info(
        f"Scored reading: accuracy={accuracy}, completeness={completeness}, "
        f"fluency={fluency}, tone={tone_score}, overall={overall}, "
        f"requiresReview={requires_review}, processingMs={processing_ms}",
    )

    return ScoreReadingResponse(
        scorerVersion=SCORER_VERSION,
        transcript=recognized_text,
        confidence=asr_confidence,
        scores=Scores(
            accuracy=accuracy,
            completeness=completeness,
            fluency=fluency,
            tone=tone_score,
            overall=overall,
        ),
        errors=errors,
        requiresReview=requires_review,
        toneMeta=tone_meta,
        processingMs=processing_ms,
    )


def _should_require_review(
    asr_confidence: float,
    overall: float,
    audio_quality: dict | None,
    alignment: dict,
    duration_ms: int,
) -> bool:
    """Determine if manual teacher review is needed."""
    # Low ASR confidence
    if asr_confidence < CONFIDENCE_REVIEW_THRESHOLD:
        return True

    # Very low overall score
    if overall < LOW_SCORE_REVIEW_THRESHOLD:
        return True

    # Audio quality issues
    if audio_quality and not audio_quality.get("is_acceptable", True):
        issues = audio_quality.get("issues", [])
        if any(i in issues for i in ["silent", "mostly_silent", "too_short"]):
            return True

    # Recording too short
    if duration_ms < MIN_RECORDING_MS:
        return True

    # Very high omission rate (>50% of target text missing)
    target_len = alignment.get("target_length", 0)
    if target_len > 0:
        omission_rate = len(alignment.get("omissions", [])) / target_len
        if omission_rate > 0.5:
            return True

    return False
