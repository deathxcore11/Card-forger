// Tiny static server for local play: node serve.mjs  ->  http://localhost:8765/
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const port = Number(process.env.PORT || 8765);

http.createServer(async (req, res) => {
  console.log(new Date().toISOString(), req.method, req.url, req.socket.remoteAddress);           // one line per request, so a device test can be watched
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = normalize(join(root, p));
  if (!file.startsWith(root) || file.includes('_orig')) { res.writeHead(403); return res.end('no'); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, '0.0.0.0', () => console.log('Duel Summoner on http://localhost:' + port + '/ (all IPv4 interfaces)'));
