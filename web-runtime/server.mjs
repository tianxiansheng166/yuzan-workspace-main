import { createServer, request as httpRequest } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4175);
const apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:4000';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.webm': 'audio/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

function safePath(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^([.][.][/\\])+/, '');
  return join(root, clean.replace(/^[/\\]+/, ''));
}

function fileExists(file) {
  try { return existsSync(file) && statSync(file).isFile(); } catch { return false; }
}

function directoryExists(dir) {
  try { return existsSync(dir) && statSync(dir).isDirectory(); } catch { return false; }
}

function resolveStatic(pathname) {
  const file = safePath(pathname);
  if (fileExists(file)) return file;
  // try index.html for directory-like paths
  const indexFile = join(file, 'index.html');
  if (fileExists(indexFile)) return indexFile;
  return null;
}

function routeToSpa(pathname) {
  if (/^\/(community|support|impact|cooperation|service-system)$/.test(pathname)) return join(root, 'public-page.html');
  if (pathname === '/volunteer/links') return join(root, 'volunteer-links.html');
  if (/^\/admin\/(assessment-content|assessment-links|content-review|curriculum|privacy|product-plans|schools|system-providers|users-roles|school-operation)(?:\/|$)/.test(pathname)) return join(root, 'admin-integration.html');
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return join(root, 'admin.html');
  if (pathname === '/volunteer' || pathname.startsWith('/volunteer/')) return join(root, 'volunteer.html');
  if (pathname === '/plans' || pathname.startsWith('/plans/')) return join(root, 'plans.html');
  if (pathname === '/research' || pathname.startsWith('/research/')) return join(root, 'research.html');
  if (pathname === '/teacher-tools' || pathname.startsWith('/teacher-tools/')) return join(root, 'tools.html');
  if (pathname === '/login' || pathname.startsWith('/login/')) return join(root, 'login', 'index.html');
  if (pathname === '/select-school' || pathname.startsWith('/select-school/')) return join(root, 'select-school', 'index.html');
  if (pathname === '/assessment' || pathname.startsWith('/assessment/')) {
    // Compatibility entry: the legacy assessment center now opens the reusable
    // practice catalog without a redirect, so existing navigation keeps working.
    if (pathname === '/assessment' || pathname === '/assessment/') return { file: join(root, 'assessment', 'practice-shell.html'), page: 'catalog' };
    if (pathname === '/assessment/history' || pathname.startsWith('/assessment/history/')) return { file: join(root, 'assessment', '_shell.html'), page: 'history' };
    if (pathname === '/assessment/recordings' || pathname.startsWith('/assessment/recordings/')) return { file: join(root, 'assessment', '_shell.html'), page: 'recordings' };
    // 动态 session 路由：/assessment/sessions/:sessionId/[reading|written|submit|processing|report]
    const sessionMatch = pathname.match(/^\/assessment\/sessions\/([^/]+)(?:\/(.*)|\/?)?$/);
    if (sessionMatch) {
      const rest = (sessionMatch[2] || '').replace(/\/+$/, '');
      let page = 'prep';
      if (rest.startsWith('reading/')) page = 'reading';
      else if (rest.startsWith('written/')) page = 'written';
      else if (rest.startsWith('submit')) page = 'submit';
      else if (rest.startsWith('processing')) page = 'processing';
      else if (rest.startsWith('report')) page = 'report';
      else if (rest === '' ) page = 'prep';
      return { file: join(root, 'assessment', '_shell.html'), page };
    }
    return { file: join(root, 'assessment', 'index.html'), page: 'center' };
  }
  // `/assessment` stays a compatibility route; new entry uses the existing V4 visual language.
  if (pathname === '/student/practices' || pathname === '/student/practices/') return { file: join(root, 'assessment', 'practice-shell.html'), page: 'catalog' };
  if (/^\/student\/practices\/attempts\/[^/]+\/prepare\/?$/.test(pathname)) return { file: join(root, 'assessment', '_shell.html'), page: 'prep' };
  if (/^\/student\/practices\/[^/]+\/?$/.test(pathname)) return { file: join(root, 'assessment', 'practice-shell.html'), page: 'detail' };
  if (pathname === '/teacher' || pathname.startsWith('/teacher/')) {
    if (pathname.startsWith('/teacher/courses/')) return join(root, 'teacher', 'courses', 'spring', 'studio', 'index.html');
    if (pathname.startsWith('/teacher/assignments')) return join(root, 'teacher', 'assignments', 'index.html');
    if (pathname.startsWith('/teacher/reviews/')) return join(root, 'teacher', 'reviews', 'submission-1', 'index.html');
    if (pathname.startsWith('/teacher/assessments/create')) return join(root, 'teacher', 'assessments', 'create', 'index.html');
    if (pathname.startsWith('/teacher/assessments/detail')) return join(root, 'teacher', 'assessments', 'detail', 'index.html');
    if (pathname.startsWith('/teacher/assessments/tasks')) return join(root, 'teacher', 'assessments', 'tasks', 'index.html');
    if (pathname.startsWith('/teacher/assessments')) return join(root, 'teacher', 'assessments', 'tasks', 'index.html');
    if (pathname.startsWith('/teacher/classes/detail')) return join(root, 'teacher', 'classes', 'detail', 'index.html');
    if (pathname.startsWith('/teacher/classes')) return join(root, 'teacher', 'classes', 'index.html');
    if (pathname.startsWith('/teacher/students/detail')) return join(root, 'teacher', 'students', 'detail', 'index.html');
    if (pathname.startsWith('/teacher/students')) return join(root, 'teacher', 'students', 'demo', 'index.html');
    if (pathname.startsWith('/teacher/ai-tools')) return join(root, 'teacher', 'ai-tools', 'index.html');
    if (pathname.startsWith('/teacher/translation')) return join(root, 'teacher', 'translation', 'index.html');
    return join(root, 'teacher-home', 'index.html');
  }
  if (pathname === '/student' || pathname.startsWith('/student/')) {
    if (/^\/student\/(assignments|community|course-center|exercises|offline|recommendations)(?:\/|$)/.test(pathname)) return join(root, 'student-integration.html');
    if (pathname === '/student/courses' || pathname.startsWith('/student/courses/')) return join(root, 'student', 'courses', 'index.html');
    if (pathname === '/student/growth' || pathname.startsWith('/student/growth/')) return join(root, 'student', 'growth', 'index.html');
    if (pathname === '/student/profile' || pathname.startsWith('/student/profile/')) return join(root, 'student', 'profile', 'index.html');
    if (pathname === '/student/learn') return join(root, 'student', 'learn', 'spring-2', 'index.html');
    if (pathname.startsWith('/student/learn/')) return join(root, 'student', 'learn', 'spring-2', 'index.html');
    return join(root, 'student', 'today', 'index.html');
  }
  if (pathname === '/') return join(root, 'index.html');
  return join(root, 'login', 'index.html');
}

function proxyToApi(req, res) {
  const target = new URL(req.url, apiBaseUrl);
  const options = {
    hostname: target.hostname,
    port: target.port,
    path: target.pathname + target.search,
    method: req.method,
    headers: { ...req.headers },
  };
  delete options.headers.host;
  options.headers.host = target.host;

  const proxyReq = httpRequest(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error(`API 代理失败 ${req.url}:`, err.message);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'API_UNAVAILABLE', message: '后端服务暂不可用' }));
  });
  req.pipe(proxyReq);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    proxyToApi(req, res);
    return;
  }

  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Redirect directory-like routes without trailing slash to trailing slash
  // so relative asset paths (./styles.css, ./assets/...) resolve correctly.
  const hasExt = extname(pathname).length > 0;
  if (!hasExt && pathname !== '/' && !pathname.endsWith('/')) {
    const asDir = join(root, pathname.replace(/^[/\\]+/, ''));
    if (directoryExists(asDir)) {
      res.writeHead(301, { Location: pathname + '/' + url.search });
      res.end();
      return;
    }
  }

  // Explicit static assets and files with extensions
  if (pathname.startsWith('/assets/') || pathname.startsWith('/login/') || pathname.startsWith('/select-school/') || hasExt) {
    const staticFile = resolveStatic(pathname);
    if (staticFile) {
      serveFile(staticFile, req, res);
      return;
    }
  }

  // These application routes deliberately shadow matching on-disk directories.
  // In particular, /assessment/ must not fall through to assessment/index.html:
  // it is the non-redirecting compatibility entry for the practice catalog.
  const isAssessmentApplicationRoute = pathname === '/assessment'
    || pathname === '/assessment/'
    || pathname.startsWith('/assessment/history')
    || pathname.startsWith('/assessment/recordings')
    || pathname.startsWith('/assessment/sessions/');
  const isPracticeApplicationRoute = pathname === '/student/practices'
    || pathname.startsWith('/student/practices/');
  if (isAssessmentApplicationRoute || isPracticeApplicationRoute) {
    const spaResult = routeToSpa(pathname);
    const spaFile = typeof spaResult === 'string' ? spaResult : spaResult?.file;
    const spaPage = typeof spaResult === 'string' ? null : spaResult?.page;
    if (spaFile && fileExists(spaFile)) {
      if (spaPage) serveShell(spaFile, spaPage, req, res);
      else serveFile(spaFile, req, res);
      return;
    }
  }

  // For directory-like routes, prefer static file if it exists, otherwise SPA fallback.
  const staticFile = resolveStatic(pathname);
  if (staticFile) {
    serveFile(staticFile, req, res);
    return;
  }

  const spaResult = routeToSpa(pathname);
  const spaFile = typeof spaResult === 'string' ? spaResult : spaResult?.file;
  const spaPage = typeof spaResult === 'string' ? null : spaResult?.page;
  if (spaFile && fileExists(spaFile)) {
    if (spaPage) {
      serveShell(spaFile, spaPage, req, res);
    } else {
      serveFile(spaFile, req, res);
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

function serveShell(file, page, req, res) {
  if (!fileExists(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.writeHead(200);
  if (req.method === 'HEAD') { res.end(); return; }
  const html = readFileSync(file, 'utf8').replace(/__ASSESSMENT_PAGE__/g, page);
  res.end(html);
}

function serveFile(file, req, res) {
  if (!fileExists(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', types[extname(file).toLowerCase()] || 'application/octet-stream');
  res.writeHead(200);
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
}

server.listen(port, '0.0.0.0', () => {
  console.log(`语赞心声统一演示站点已启动：http://127.0.0.1:${port}`);
  console.log(`入口页面：http://127.0.0.1:${port}/`);
});
