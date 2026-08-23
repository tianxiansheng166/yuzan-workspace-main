from pathlib import Path

import pytest
from fastapi import HTTPException

from app import main
from app.models import AnalyzeOpenResponseRequest, ScoreReadingRequest


@pytest.mark.asyncio
async def test_health_exposes_real_scorer_version():
    response = await main.health()

    assert response.status == "ok"
    assert response.scorerVersion


@pytest.mark.asyncio
async def test_provider_unavailable_remains_explicit(monkeypatch, tmp_path: Path):
    raw_path = tmp_path / "recording.webm"
    wav_path = tmp_path / "recording.wav"
    raw_path.write_bytes(b"audio")
    wav_path.write_bytes(b"wav")

    async def fake_download(_url: str):
        return raw_path

    monkeypatch.setattr(main, "download_audio", fake_download)
    monkeypatch.setattr(main, "convert_to_wav", lambda _path: wav_path)
    monkeypatch.setattr(
        main,
        "check_audio_quality",
        lambda _path: {
            "duration_s": 1.0,
            "issues": [],
            "is_acceptable": True,
        },
    )
    monkeypatch.setattr(
        main,
        "run_asr",
        lambda _path: {
            "text": "",
            "confidence": 0.0,
            "error": "PROVIDER_NOT_CONFIGURED",
        },
    )

    with pytest.raises(HTTPException) as error:
        await main.score_reading_endpoint(
            ScoreReadingRequest(
                audioUrl="http://127.0.0.1/example.webm",
                targetText="万里赴戎机",
            ),
        )

    assert error.value.status_code == 503
    assert "not configured" in str(error.value.detail).lower()


@pytest.mark.asyncio
async def test_open_response_returns_only_reviewable_audio_evidence(monkeypatch, tmp_path: Path):
    raw_path = tmp_path / "picture.webm"
    wav_path = tmp_path / "picture.wav"
    raw_path.write_bytes(b"audio")
    wav_path.write_bytes(b"wav")

    async def fake_download(_url: str):
        return raw_path

    monkeypatch.setattr(main, "download_audio", fake_download)
    monkeypatch.setattr(main, "convert_to_wav", lambda _path: wav_path)
    monkeypatch.setattr(
        main,
        "check_audio_quality",
        lambda _path: {
            "duration_s": 5.0,
            "speech_duration_s": 4.0,
            "silent_ratio": 0.2,
            "issues": [],
            "is_acceptable": True,
        },
    )
    monkeypatch.setattr(
        main,
        "run_asr",
        lambda _path: {"text": "图片里的孩子在公园里玩耍", "confidence": 0.88},
    )

    result = await main.analyze_open_response_endpoint(
        AnalyzeOpenResponseRequest(audioUrl="http://127.0.0.1/example.webm")
    )

    assert result.strategy == "SPEECH_OPEN_RESPONSE"
    assert result.requiresReview is True
    assert result.experimental is True
    assert result.diagnostics.speechRate is not None
    assert result.diagnostics.fluency is not None
    assert not hasattr(result, "scores")
    assert not hasattr(result, "targetText")


@pytest.mark.asyncio
async def test_open_response_provider_unavailable_is_not_mock_scored(monkeypatch, tmp_path: Path):
    raw_path = tmp_path / "picture.webm"
    wav_path = tmp_path / "picture.wav"
    raw_path.write_bytes(b"audio")
    wav_path.write_bytes(b"wav")

    async def fake_download(_url: str):
        return raw_path

    monkeypatch.setattr(main, "download_audio", fake_download)
    monkeypatch.setattr(main, "convert_to_wav", lambda _path: wav_path)
    monkeypatch.setattr(
        main,
        "check_audio_quality",
        lambda _path: {"duration_s": 1.0, "speech_duration_s": 0.0, "issues": [], "is_acceptable": True},
    )
    monkeypatch.setattr(
        main,
        "run_asr",
        lambda _path: {"text": "", "confidence": 0.0, "error": "PROVIDER_NOT_CONFIGURED"},
    )

    with pytest.raises(HTTPException) as error:
        await main.analyze_open_response_endpoint(
            AnalyzeOpenResponseRequest(audioUrl="http://127.0.0.1/example.webm")
        )

    assert error.value.status_code == 503
