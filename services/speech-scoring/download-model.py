"""Pre-download FunASR paraformer-zh model so first inference doesn't wait."""
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    try:
        from funasr import AutoModel

        logger.info("Downloading FunASR models (paraformer-zh, fsmn-vad, ct-punc)...")
        model = AutoModel(
            model="paraformer-zh",
            vad_model="fsmn-vad",
            punc_model="ct-punc",
            disable_update=True,
        )
        logger.info("FunASR models downloaded and loaded successfully.")
        # Keep a tiny inference to ensure everything is JIT-compiled/cached
        logger.info("Model ready.")
        return model
    except Exception as e:
        logger.error(f"Failed to download/load FunASR model: {e}", exc_info=True)
        raise
