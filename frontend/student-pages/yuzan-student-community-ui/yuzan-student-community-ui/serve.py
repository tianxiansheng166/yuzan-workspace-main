from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
print("语赞心声页面已启动：http://127.0.0.1:4173")
ThreadingHTTPServer(("127.0.0.1", 4173), SimpleHTTPRequestHandler).serve_forever()
