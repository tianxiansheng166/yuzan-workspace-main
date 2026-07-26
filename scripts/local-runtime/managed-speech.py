import argparse
import sys
from pathlib import Path

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8100)
    parser.add_argument("--yuzan-runtime-nonce", required=True)
    parser.add_argument("--yuzan-runtime-root", required=True)
    parser.add_argument("--yuzan-runtime-commit", required=True)
    args = parser.parse_args()
    service_dir = Path(args.yuzan_runtime_root) / "backend" / "speech-scoring"
    sys.path.insert(0, str(service_dir))
    uvicorn.run("app.main:app", host=args.host, port=args.port)


if __name__ == "__main__":
    main()
