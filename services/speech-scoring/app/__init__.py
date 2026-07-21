"""Compatibility package for the local speech-scoring runtime.

The canonical scorer source remains read-only in ``yuzan-next``.  This package
only repairs its truncated package marker and extends Python's module path so
the real scorer modules are loaded without copying or modifying that source.
"""

import os
import tempfile
from pathlib import Path
from pkgutil import extend_path

import httpx

__path__ = extend_path(__path__, __name__)

# The Windows development image already provides FFmpeg here.  The canonical
# converter invokes ``ffmpeg`` by name, so expose that existing binary without
# changing the read-only scorer source or installing another codec stack.
_ffmpeg_dir = Path(r"D:\soft\FR")
if _ffmpeg_dir.joinpath("ffmpeg.exe").is_file():
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
