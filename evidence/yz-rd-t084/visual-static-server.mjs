import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const evidenceDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(evidenceDirectory, "../../frontend");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const segments = decodeURIComponent(url.pathname).split("/").filter(Boolean);
  const relativePath = segments.join("/");
  if (
    segments[0] === "api"
    || segments.some((segment) => segment === "question-bank" || segment === "local_sources")
    || relativePath === "student/courses/course-detail"
    || relativePath.startsWith("student/courses/course-detail/")
  ) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Unavailable in visual fixture");
    return;
  }

  let file = path.resolve(frontendRoot, ...segments);
  if (file !== frontendRoot && !file.startsWith(`${frontendRoot}${path.sep}`)) {
    response.writeHead(403);
    response.end();
    return;
  }

  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    if (!(await stat(file)).isFile()) throw new Error("not a file");
  } catch {
    response.writeHead(404);
    response.end();
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes.get(path.extname(file)) || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  if (path.extname(file) === ".html") {
    const html = await readFile(file, "utf8");
    const watermark = '<div aria-hidden="true" style="position:fixed;z-index:2147483647;top:8px;right:8px;padding:5px 8px;border-radius:4px;background:rgba(130,0,0,.9);color:#fff;font:12px/1.2 sans-serif;pointer-events:none">VISUAL_FIXTURE_ONLY · API NOT RUN</div>';
    response.end(html.replace(/<body([^>]*)>/i, `<body$1>${watermark}`));
    return;
  }
  createReadStream(file).pipe(response);
});

server.listen(0, "127.0.0.1", () => {
  process.stdout.write(`VISUAL_FIXTURE_ONLY static server; API disabled; port=${server.address().port}\n`);
});
