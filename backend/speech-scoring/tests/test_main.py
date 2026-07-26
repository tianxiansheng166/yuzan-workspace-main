from pathlib import Path

import pytest
from fastapi import HTTPException

from app import main
from app.models import ScoreReadingRequest


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
