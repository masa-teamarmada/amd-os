// 本の読者向け月次評価アプリ: 127.0.0.1 専用の配信。許可した固定ファイルだけを返す。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.BZM_PWA_PORT || 8765);
const HOST = '127.0.0.1';

const FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json; charset=utf-8']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']],
  ['/icon.svg', ['icon.svg', 'image/svg+xml']],
]);

const BASE_HEADERS = {
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-cache',
};

async function loadBuilder() {
  for (const spec of ['./app-data.mjs', '../app-data.mjs']) {
    try {
      const mod = await import(spec);
      if (typeof mod.buildDemoData === 'function') return mod.buildDemoData;
    } catch (e) {
      if (e && e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    }
  }
  return null;
}

function send(res, status, type, body, extra = {}) {
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': type, ...extra });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const host = String(req.headers.host || '');
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(res, 403, 'text/plain; charset=utf-8', '許可されていない宛先です');
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', '許可されていない操作です', { Allow: 'GET, HEAD' });
    const pathname = new URL(req.url, `http://${HOST}`).pathname;

    if (pathname === '/data.json') {
      const build = await loadBuilder();
      if (!build) return send(res, 503, 'application/json; charset=utf-8', JSON.stringify({ error: 'データ出力(app-data.mjs)が見つかりません' }));
      const data = await build();
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(data));
    }
    const entry = FILES.get(pathname);
    if (!entry) return send(res, 404, 'text/plain; charset=utf-8', '見つかりません');
    const body = await readFile(path.join(dir, entry[0]));
    const extra = pathname === '/sw.js' ? { 'Service-Worker-Allowed': '/' } : {};
    return send(res, 200, entry[1], req.method === 'HEAD' ? '' : body, extra);
  } catch (e) {
    return send(res, 500, 'application/json; charset=utf-8', JSON.stringify({ error: 'データを作成できませんでした' }));
  }
});

server.listen(port, HOST, () => {
  console.log(`BZM 月次評価 http://${HOST}:${port}/`);
});
