// Static server for local play: node serve.mjs  (or double-click start-server.cmd).
// It listens on every IPv4 interface, port 8765 (override with PORT), and prints the addresses a phone or handheld on the same Wi-Fi can type.
// '/' with no query shows the plain start page (start.html); '/?anything' is the game, so every test and link that passes a query is unchanged.
import http from 'node:http';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 8765);

http.createServer(async (req, res) => {
  console.log(new Date().toISOString(), req.method, req.url, req.socket.remoteAddress);           // one line per request, so a device test can be watched
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = u.search ? '/index.html' : '/start.html';
  const file = normalize(join(root, p));
  if (!file.startsWith(root) || file.includes('_orig') || /[\\/]\.git[\\/]/.test(file)) { res.writeHead(403); return res.end('no'); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, '0.0.0.0', () => {
  console.log('Duel Summoner is running. On this PC: http://localhost:' + port + '/');
  const lan = []; for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) lan.push([name, a.address]);
  if (!lan.length) console.log('No network address found: this PC is not on a network.');
  for (const [name, addr] of lan) console.log('On your Wi-Fi (' + name + '): http://' + addr + ':' + port + '/');
  console.log('Leave this window open. If Windows asks about the firewall, allow private networks.');
});
