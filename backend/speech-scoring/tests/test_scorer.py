from app.scorer import (
    align_texts,
    compute_accuracy,
    compute_completeness,
    compute_fluency,
    compute_tone,
    score_reading,
)


def test_alignment_and_dimension_scores_are_deterministic():
    alignment = align_texts("你好世界", "你好世界")

    assert alignment["correct"] == list("你好世界")
    assert alignment["substitutions"] == []
    assert alignment["omissions"] == []
    assert compute_accuracy(alignment) == 100.0
    assert compute_completeness(alignment) == 100.0
    assert compute_fluency("你好世界", 1000) == 100.0


def test_alignment_tracks_substitutions_omissions_and_insertions():
    alignment = align_texts("你啊世", "你好世界")

    assert alignment["target_length"] == 4
    assert alignment["recognized_length"] == 3
    assert alignment["substitutions"] or alignment["omissions"]
    assert 0.0 <= compute_accuracy(alignment) <= 100.0
    assert 0.0 <= compute_completeness(alignment) <= 100.0


def test_tone_is_explicitly_unavailable_without_audio():
    result = compute_tone()

    assert result == {
        "score": None,
        "method": None,
        "reason": "TONE_SCORING_UNAVAILABLE",
        "experimental": True,
    }


def test_reading_score_preserves_experimental_tone_and_bounds():
    result = score_reading(
        target_text="你好世界",
        recognized_text="你好世界",
        duration_ms=1000,
        wav_path=None,
        asr_confidence=0.9,
    )

    assert result.scores.tone is not None
    assert result.toneMeta is not None
    assert result.toneMeta.experimental is True
    assert 0.0 <= result.scores.accuracy <= 100.0
    assert 0.0 <= result.scores.completeness <= 100.0
    assert 0.0 <= result.scores.fluency <= 100.0
    assert 0.0 <= result.scores.tone <= 100.0
    assert 0.0 <= result.scores.overall <= 100.0


def test_low_confidence_and_bad_audio_require_review():
    result = score_reading(
        target_text="你好世界",
        recognized_text="你好",
        duration_ms=500,
        wav_path=None,
        audio_quality={
            "is_acceptable": False,
            "issues": ["silent"],
            "silent_ratio": 0.9,
        },
        asr_confidence=0.4,
    )

    assert result.requiresReview is True
    assert 0.0 <= result.scores.overall <= 100.0
