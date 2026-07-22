"""ASR (Automatic Speech Recognition) module using FunASR."""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

import httpx
import numpy as np

logger = logging.getLogger(__name__)

# FunASR model cache
_model = None
_vad_model = None
# Track whether ASR provider is available
_asr_available: bool | None = None


def _get_asr_model():
    """Lazy-load FunASR paraformer model.

    Returns:
        The loaded model, or None if FunASR is not available.

    When FunASR is not available and MOCK_SPEECH_SCORING is not explicitly
    enabled, run_asr() will return an empty result with PROVIDER_NOT_CONFIGURED.
    """
    global _model, _asr_available
    if _model is None and _asr_available is None:
        try:
            from funasr import AutoModel

            _model = AutoModel(
                model="paraformer-zh",
                vad_model="fsmn-vad",
                punc_model="ct-punc",
                disable_update=True,
            )
            _asr_available = True
            logger.info("FunASR paraformer-zh model loaded")
        except ImportError:
            logger.warning("FunASR not available — ASR provider not configured")
            _model = None
            _asr_available = False
    return _model


async def download_audio(audio_url: str, timeout: float = 30.0) -> Path:
    """Download audio from presigned URL to a temporary file."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(audio_url)
        response.raise_for_status()

    suffix = ".wav"
    if "webm" in audio_url.lower():
        suffix = ".webm"
    elif "ogg" in audio_url.lower():
        suffix = ".ogg"
    elif "mp4" in audio_url.lower():
        suffix = ".mp4"

    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(response.content)
    tmp.close()

    logger.debug(f"Downloaded audio to {tmp.name} ({len(response.content)} bytes)")
    return Path(tmp.name)


def convert_to_wav(input_path: Path, output_path: Path | None = None) -> Path:
    """Convert audio to 16kHz mono WAV.

    Priority: FFmpeg → soundfile → torchaudio (requires torchcodec).
    """
    if output_path is None:
        output_path = input_path.with_suffix(".wav")

    # If input is already a WAV file and soundfile can read it, just normalize
    if str(input_path).lower().endswith(".wav"):
        try:
            import soundfile as sf
            data, sr = sf.read(str(input_path))
            # Convert to mono if stereo
            if data.ndim > 1:
                data = data.mean(axis=1)
            # Resample to 16kHz if needed
            if sr != 16000:
                import librosa
                data = librosa.resample(data, orig_sr=sr, target_sr=16000)
                sr = 16000
            sf.write(str(output_path), data, sr, subtype="PCM_16")
            logger.debug(f"Converted via soundfile: {input_path} -> {output_path}")
            return output_path
        except Exception as e:
            logger.debug(f"soundfile conversion failed: {e}, trying FFmpeg")

    # Try FFmpeg for non-WAV or if soundfile failed
    import subprocess
    cmd = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-ar", "16000", "-ac", "1", "-f", "wav", str(output_path),
    ]
    try:
        subprocess.run(cmd, capture_output=True, timeout=30, check=True)
        logger.debug(f"Converted via FFmpeg: {input_path} -> {output_path}")
        return output_path
    except FileNotFoundError:
        logger.warning("FFmpeg not available, using soundfile/torchaudio fallback")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg conversion failed: {e.stderr.decode()}")

    # Fallback: torchaudio (may require torchcodec)
    _convert_with_torchaudio(input_path, output_path)
    return output_path


def _convert_with_torchaudio(input_path: Path, output_path: Path) -> None:
    """Fallback audio conversion using torchaudio."""
    import torchaudio

    waveform, sample_rate = torchaudio.load(str(input_path))
    # Resample to 16kHz
    if sample_rate != 16000:
        resampler = torchaudio.transforms.Resample(sample_rate, 16000)
        waveform = resampler(waveform)
    # Convert to mono
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    torchaudio.save(str(output_path), waveform, 16000)


def check_audio_quality(wav_path: Path) -> dict:
    """Check audio for issues: silence, clipping, noise, etc."""
    import librosa

    issues: list[str] = []
    y, sr = librosa.load(str(wav_path), sr=16000)

    # Check duration
    duration_s = len(y) / sr
    if duration_s < 0.5:
        issues.append("too_short")

    # Check for silence
    rms = np.sqrt(np.mean(y ** 2))
    if rms < 0.001:
        issues.append("silent")

    # Check for clipping
    if np.max(np.abs(y)) > 0.99:
        issues.append("clipping")

    # Check silence ratio
    silence_threshold = 0.01
    silent_frames = np.sum(np.abs(y) < silence_threshold) / len(y)
    if silent_frames > 0.6:
        issues.append("mostly_silent")

    return {
        "duration_s": duration_s,
        "rms": float(rms),
        "max_amplitude": float(np.max(np.abs(y))),
        "silent_ratio": float(silent_frames),
        "issues": issues,
        "is_acceptable": len(issues) == 0,
    }


def run_asr(wav_path: Path) -> dict:
    """
    Run ASR on the audio file using FunASR.

    Returns:
        dict with keys: text, confidence, timestamp_ms, error (optional)

    When FunASR is unavailable:
    - If MOCK_SPEECH_SCORING=true: returns explicitly marked mock result
    - Otherwise: returns empty result with error=PROVIDER_NOT_CONFIGURED
      and confidence=0.0 so that the scoring pipeline sends the
      SpeechJob into NEEDS_REVIEW instead of producing a fake score.
    """
    model = _get_asr_model()

    # ── FunASR not available ──────────────────────────────
    if model is None:
        mock_enabled = os.environ.get("MOCK_SPEECH_SCORING", "").lower() in ("true", "1", "yes")
        if mock_enabled:
            logger.warning("MOCK_SPEECH_SCORING enabled — returning mock ASR result")
            return {
                "text": "[MOCK] 语音识别服务未启用",
                "confidence": 0.0,
                "timestamp_ms": [],
                "error": "MOCK_MODE",
            }
        # Production: return empty result with explicit error
        logger.error("FunASR not available — returning PROVIDER_NOT_CONFIGURED")
        return {
            "text": "",
            "confidence": 0.0,
            "timestamp_ms": [],
            "error": "PROVIDER_NOT_CONFIGURED",
        }

    # ── FunASR available — run inference ──────────────────
    try:
        result = model.generate(
            input=str(wav_path),
            batch_size_s=300,
        )

        if result and len(result) > 0:
            text = result[0].get("text", "")
            # FunASR doesn't always provide confidence; extract if available
            confidence = result[0].get("confidence", None)
            if confidence is None:
                # No reliable confidence from model — mark as medium confidence
                # so the scoring pipeline applies appropriate review thresholds
                confidence = 0.80
            timestamp_ms = result[0].get("timestamp", [])

            return {
                "text": text,
                "confidence": float(confidence),
                "timestamp_ms": timestamp_ms,
            }
    except Exception as e:
        logger.error(f"FunASR inference failed: {e}")

    # Inference failed — return empty result (not a fake one)
    return {
        "text": "",
        "confidence": 0.0,
        "timestamp_ms": [],
        "error": "ASR_INFERENCE_FAILED",
    }