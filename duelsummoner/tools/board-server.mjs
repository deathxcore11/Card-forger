// Local reference leaderboard service (design/leaderboard-server.md, step 1). Not the live service: no keys, a JSON file for tables.
//   node tools/board-server.mjs            -> http://localhost:8766/   (data file: BOARD_DATA or the temp folder)
// POST /ds/runs {record,name}  GET /ds/runs/:id  GET /ds/board?map&difficulty&period  GET /ds/replay/:id
// The player is named by the x-ds-user header (stand-in for the Supabase bearer token the live Worker checks).
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Board } from './board-core.mjs';

export function createServer(board, { checkEveryMs = 1500 } = {}) {
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-ds-user', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', ...CORS }); res.end(JSON.stringify(obj)); };
  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    const u = new URL(req.url, 'http://x'), user = String(req.headers['x-ds-user'] || '').slice(0, 64) || 'anon';
    const q = Object.fromEntries(u.searchParams);
    if (req.method === 'POST' && u.pathname === '/ds/runs') {
      let body = ''; req.on('data', d => { body += d; if (body.length > 200000) req.destroy(); });
      req.on('end', () => { let j; try { j = JSON.parse(body); } catch (e) { return send(res, 400, { error: 'bad json' }); } const r = board.submit(user, j.record, j.name); send(res, r.code || 200, r.error ? { error: r.error } : { ...r, message: 'Score sent, checking it' }); });
      return;
    }
    let m;
    if (req.method === 'GET' && (m = /^\/ds\/runs\/(\w+)$/.exec(u.pathname))) { const r = board.status(m[1], user); return send(res, r.code || 200, r); }
    if (req.method === 'GET' && u.pathname === '/ds/board') return send(res, 200, board.board(q.map || 'run', q.difficulty || 'medium', q.period || 'all', user === 'anon' ? null : user));
    if (req.method === 'GET' && (m = /^\/ds\/replay\/(\w+)$/.exec(u.pathname))) { const r = board.replay(m[1]); return r ? send(res, 200, r) : send(res, 404, { error: 'not found' }); }
    send(res, 404, { error: 'no route' });
  });
  const timer = checkEveryMs ? setInterval(() => board.checkPending(), checkEveryMs) : null;
  server.on('close', () => timer && clearInterval(timer));
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.env.BOARD_DATA || join(tmpdir(), 'ds-board.json'), port = Number(process.env.PORT || 8766);
  createServer(new Board(file)).listen(port, () => console.log('Duel Summoner board (local reference) on http://localhost:' + port + '/  data: ' + file));
}
