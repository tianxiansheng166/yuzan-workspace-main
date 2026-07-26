import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--role", choices=("api", "frontend_proxy", "speech", "worker"), required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int)
    parser.add_argument("--yuzan-runtime-nonce", required=True)
    parser.add_argument("--yuzan-runtime-root", required=True)
    parser.add_argument("--yuzan-runtime-commit", required=True)
    args = parser.parse_args()
    if args.role == "worker":
        while True:
            time.sleep(30)

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            valid = self.path == "/health" if args.role == "speech" else self.path == "/api/v1/health/ready"
            body = json.dumps({"status": "ok" if valid else "not_found"}).encode()
            self.send_response(200 if valid else 404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_):
            return

    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
