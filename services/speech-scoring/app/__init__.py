"""Compatibility hooks for the local speech-scoring runtime."""

import os
import tempfile
from pathlib import Path

import httpx

# The converter invokes ``ffmpeg`` by name. A machine-specific installation can
# be supplied through FFMPEG_DIR without hardcoding a workstation path.
_ffmpeg_dir_value = os.environ.get("FFMPEG_DIR", "").strip()
if _ffmpeg_dir_value:
    _ffmpeg_dir = Path(_ffmpeg_dir_value).expanduser().resolve()
    _ffmpeg_binary = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    if not _ffmpeg_dir.joinpath(_ffmpeg_binary).is_file():
        raise RuntimeError(f"FFMPEG_DIR does not contain {_ffmpeg_binary}: {_ffmpeg_dir}")
    os.environ["PATH"] = f"{_ffmpeg_dir}{os.pathsep}{os.environ.get('PATH', '')}"


async def _download_audio_with_content_type(audio_url: str, timeout: float = 30.0) -> Path:
    """Keep the source audio's actual container suffix for FFmpeg conversion."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(audio_url)
        response.raise_for_status()

    content_type = response.headers.get("content-type", "").lower()
    if "webm" in content_type:
        suffix = ".webm"
    elif "ogg" in content_type:
        suffix = ".ogg"
    elif "mp4" in content_type or "m4a" in content_type:
        suffix = ".m4a"
    elif "wav" in content_type:
        suffix = ".wav"
    else:
        # Browser MediaRecorder uploads are WebM/Opus in this runtime.  This
        # default keeps a URL without an object-key extension from becoming an
        # invalid in-place WAV conversion.
        suffix = ".webm"

    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(response.content)
    tmp.close()
    return Path(tmp.name)


# ``app.main`` imports this symbol from the canonical module after this package
# initializer has run, so the real scorer receives the corrected downloader.
from . import asr as _asr  # noqa: E402

_asr.download_audio = _download_audio_with_content_type
