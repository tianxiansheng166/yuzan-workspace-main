import argparse
import base64
import hashlib
import json
import msvcrt
import os
import signal
import subprocess
import sys
from pathlib import Path


def atomic_json(path: Path, value: dict) -> None:
    temp = path.with_suffix(path.suffix + f".{os.getpid()}.tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--role", required=True)
    parser.add_argument("--attestation-dir", required=True)
    parser.add_argument("--nonce", required=True)
    parser.add_argument("--repository-root", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--command-base64", required=True)
    args = parser.parse_args()
    command_json = base64.b64decode(args.command_base64).decode("utf-8")
    command = json.loads(command_json)
    command_hash = hashlib.sha256(command_json.encode("utf-8")).hexdigest()
    directory = Path(args.attestation_dir)
    directory.mkdir(parents=True, exist_ok=True)
    lock_path = directory / f"{args.role}.lock"
    attestation_path = directory / f"{args.role}.json"
    lock_file = lock_path.open("a+b")
    lock_file.seek(0); lock_file.write(b"0"); lock_file.flush(); lock_file.seek(0)
    msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
    child = subprocess.Popen(command, cwd=args.repository_root)
    atomic_json(attestation_path, {
        "schema_version": 1, "role": args.role, "nonce": args.nonce,
        "repository_root": args.repository_root, "commit": args.commit,
        "wrapper_pid": os.getpid(), "child_pid": child.pid,
        "command_argv_sha256": command_hash,
    })

    def terminate(*_):
        if child.poll() is None:
            child.terminate()

    signal.signal(signal.SIGTERM, terminate)
    signal.signal(signal.SIGINT, terminate)
    try:
        return child.wait()
    finally:
        terminate()
        lock_file.close()


if __name__ == "__main__":
    raise SystemExit(main())
