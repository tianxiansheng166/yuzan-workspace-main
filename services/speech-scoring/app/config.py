"""Scoring version configuration — all weights and thresholds in one place."""

from __future__ import annotations

# ─── Version ──────────────────────────────────────────────
SCORER_VERSION = "mandarin-reading-v0.1.0"

# ─── Weights (must sum to 1.0) ────────────────────────────
SCORE_WEIGHTS = {
    "accuracy": 0.40,
    "completeness": 0.20,
    "fluency": 0.20,
    "tone": 0.20,
}

# ─── Thresholds ───────────────────────────────────────────
# Confidence below this triggers NEEDS_REVIEW
CONFIDENCE_REVIEW_THRESHOLD = 0.75

# If overall score below this, trigger NEEDS_REVIEW
LOW_SCORE_REVIEW_THRESHOLD = 40.0

# Minimum recording duration in ms
MIN_RECORDING_MS = 1000

# Maximum allowed silence ratio (fraction of total duration)
MAX_SILENCE_RATIO = 0.6

# Minimum words expected per second of audio (for fluency)
MIN_WORDS_PER_SECOND = 1.0

# Maximum words per second (rushing detection)
MAX_WORDS_PER_SECOND = 5.0