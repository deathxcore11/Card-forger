// LOCAL TEST ONLY. Mock account/provider/storage; actual service, bootstrap,
// gateway and Forge rules. Never import this file from a production Worker.
import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OWNER = '00000000-0000-4000-8000-000000000001';
const BEARER = 'forge-browser-fixture-owner'; // synthetic test credential ONLY
const SOURCE_SHA = '586511f3e9bf28a6918ef696ce614e50b5dbdf55c0b14d9a54f1fd89967aeddd';
const GATEWAY_SHA = 'c15d29c16f6ad8ab259eeba07bd2a87ecf26caec00b66c10a5bc5b9174da0e52';
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!/^--[a-z-]+$/.test(process.argv[i]) || !process.argv[i + 1]) throw Error('named fixture arguments required');
  args[process.argv[i].slice(2)] = process.argv[i + 1];
}
for (const key of ['ui-root', 'service-root', 'proof-root', 'native-root', 'gateway', 'bootstrap']) if (!args[key]) throw Error('missing --' + key);
const [uiRoot, serviceRoot, proofRoot, nativeRoot, gateway, bootstrap] = await Promise.all(['ui-root', 'service-root', 'proof-root', 'native-root', 'gateway', 'bootstrap'].map(k => realpath(args[k])));
const lifetime = Number(args['lifetime-ms'] || 600000), requestedPort = Number(args.port || 0);
if (!Number.isSafeInteger(lifetime) || lifetime < 30000 || lifetime > 900000 || !Number.isSafeInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) throw Error('invalid bounded fixture settings');
if (createHash('sha256').update(await readFile(gateway)).digest('hex') !== GATEWAY_SHA) throw Error('unreviewed fixture gateway');
if (createHash('sha256').update(await readFile(bootstrap)).digest('hex') !== '28be17cd8c59441bff35934086dbf6a0a0dd1a1125a9f0fe54939910c713754f') throw Error('unreviewed fixture bootstrap');
const { AdmissionService, MatchService, routeHostRequest, ORIGIN, GLOBAL_NAME } = await import(pathToFileURL(path.join(serviceRoot, 'src/service-core.mjs')));
const { nativeAdapter } = await import(pathToFileURL(path.join(serviceRoot, 'src/native-adapter.mjs')));
const { accountVerifier } = await import(pathToFileURL(path.join(serviceRoot, 'src/auth.mjs')));
const { abortable } = await import(pathToFileURL(path.join(serviceRoot, 'src/policy.mjs')));
const privateRoot = await mkdtemp(path.join(tmpdir(), 'forge-browser-provider-fixture-'));
const distribution = path.join(privateRoot, 'distribution');
try {
  await promisify(execFile)('python3', [path.join(HERE, 'prepare-runtime.py'), proofRoot, nativeRoot, distribution], { timeout: 95000, maxBuffer: 8192 });
} catch { await rm(privateRoot, { recursive: true, force: true }); throw Error('fixture native preparation failed'); }

class MemoryStorage {
  constructor() { this.data = new Map(); this.tail = Promise.resolve(); this.alarmAt = Infinity; this.alarming = false; }
  async get(k) { return structuredClone(this.data.get(k)); }
  async put(k, v) { this.data.set(k, structuredClone(v)); }
  async delete(k) { return this.data.delete(k); }
  async list({ prefix }) { return new Map([...this.data].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  async setAlarm(t) { this.alarmAt = t; }
  transaction(fn) {
    const run = this.tail.then(async () => { const staged = new MemoryStorage(); staged.data = structuredClone(this.data); const result = await fn(staged); this.data = staged.data; return result; });
    this.tail = run.catch(() => {}); return run;
  }
}
const work = new Set(), entries = new Map(), receipts = [], counters = { starts: 0, destroys: 0, nativeActions: {} };
const waitUntil = promise => { work.add(promise); promise.finally(() => work.delete(promise)).catch(() => {}); };
const deadline = Date.now() + lifetime;
let origin, closing = false;
const verifyBearer = accountVerifier({}, async (url, options) => {
  if (new URL(url).pathname !== '/auth/v1/user' || options.headers.Authorization !== 'Bearer ' + BEARER) return Response.json({ error: 'fixture_auth_required' }, { status: 401 });
  return Response.json({ id: OWNER, is_anonymous: false });
});
const native = nativeAdapter({});
const confirm = native.confirmInitialization;
native.confirmInitialization = async options => {
  const result = await confirm(options);
  receipts.push({ matchId: options.allocation.matchId, requestDigest: result.requestDigest, humanDigest: result.humanDigest,
    opponentDigest: result.opponentDigest, registeredRosterVerified: result.registeredRosterVerified, nativeRosterVerified: result.nativeRosterVerified,
    viewerId: result.viewerId, policyVersion: result.policyVersion, readyAfterMs: Date.now() - options.allocation.createdAt });
  return result;
};
const env = { FORGE_TRIAL_ENABLED: 'true', FORGE_TRIAL_OWNER_IDS: OWNER,
  FORGE_TRIAL_EXPIRES_AT: new Date(deadline).toISOString(), FORGE_TRIAL_MATCH_MS: '180000',
  FORGE_TRIAL_RUNTIME_BUDGET_MS: '374000', FORGE_TRIAL_MAX_RESERVATIONS: '2' };
function makeContainer(id) {
  let processChild, stopped, runtime, resolvePort, rejectPort, portPromise, spawnFailed = false;
  const container = { running: false, destroyed: false,
    start(options) {
      if (processChild || this.destroyed || options.enableInternet !== false || options.entrypoint?.join(' ') !== 'python3 /opt/host-service/bootstrap.py') throw Error('invalid fixture provider start');
      runtime = path.join(privateRoot, id);
      // start() must be void just like the real platform; readiness awaits the
      // existing instance only. Directory setup never launches a replacement.
      portPromise = new Promise((resolve, reject) => { resolvePort = resolve; rejectPort = reject; }); portPromise.catch(() => {});
      this.running = true; counters.starts++;
      stopped = (async () => {
        await mkdir(runtime, { mode: 0o700 });
        processChild = spawn('python3', [path.join(HERE, 'runtime.py'), distribution, gateway, bootstrap, runtime], {
          env: { PATH: path.join(proofRoot, 'tools/jdk21/bin') + ':' + process.env.PATH,
            HOST_INTERNAL_TOKEN: options.env.HOST_INTERNAL_TOKEN, HOST_ABSOLUTE_DEADLINE_MS: options.env.HOST_ABSOLUTE_DEADLINE_MS, HOST_SEED: '20261025' },
          stdio: ['ignore', 'pipe', 'ignore'], detached: true,
        });
        let output = '';
        processChild.stdout.on('data', data => {
          output += data.toString(); if (output.length > 8192) { processChild.kill('SIGTERM'); return; }
          let index;
          while ((index = output.indexOf('\n')) >= 0) {
            const line = output.slice(0, index); output = output.slice(index + 1);
            try { const value = JSON.parse(line); if (value.event === 'bootstrap-listening' && Number.isInteger(value.port) && value.port > 0 && value.port <= 65535) resolvePort(value.port); } catch {}
          }
        });
        await new Promise(resolve => { processChild.once('exit', resolve); processChild.once('error', () => { spawnFailed = true; resolve(); }); });
        this.running = false; rejectPort(Error('fixture runtime stopped'));
      })();
      stopped.catch(() => { this.running = false; rejectPort(Error('fixture runtime failed')); });
    },
    async setInactivityTimeout(ms) { if (ms !== 600000) throw Error('unexpected native inactivity limit'); },
    getTcpPort(port) {
      if (port !== 8080 || !processChild && !stopped || this.destroyed) throw Error('no recorded existing provider');
      return { fetch: async request => {
        const localPort = await abortable(portPromise, request.signal); request.signal.throwIfAborted();
        if (!this.running || this.destroyed) throw Error('fixture runtime stopped');
        const route = new URL(request.url);
        if (!['/bootstrap-ready', '/initialize', '/ready', '/state', '/action'].includes(route.pathname) || route.search) throw Error('unexpected native route');
        let op;
        if (route.pathname === '/action') op = (await request.clone().json()).op;
        const response = await fetch(new Request('http://127.0.0.1:' + localPort + route.pathname, request));
        if (op) { const key = op + ':' + response.status; counters.nativeActions[key] = (counters.nativeActions[key] || 0) + 1; }
        return response;
      } };
    },
    async destroy() {
      if (this.destroyed) return;
      counters.destroys++;
      if (!stopped) { this.destroyed = true; this.running = false; return; }
      // A start may still be asynchronously assigning its recorded process.
      for (let i = 0; !processChild && this.running && i < 100; i++) await new Promise(r => setTimeout(r, 10));
      if (processChild && this.running) processChild.kill('SIGTERM');
      await abortable(stopped, AbortSignal.timeout(8000));
      if (!spawnFailed) {
        const receipt = JSON.parse(await readFile(path.join(runtime, 'lifecycle.json'), 'utf8'));
        if (receipt.confirmed !== true) throw Error('fixture cleanup unconfirmed');
      }
      this.destroyed = true; this.running = false;
    },
  };
  return container;
}
env.FORGE_MATCHES = { getByName(id) {
  if (!entries.has(id)) { const storage = new MemoryStorage(), container = makeContainer(id); const service = new MatchService({ ctx: { storage, container, waitUntil }, env, native, verifyBearer }); entries.set(id, { storage, container, service }); }
  return entries.get(id).service;
} };
const admissionStorage = new MemoryStorage();
const admission = new AdmissionService({ ctx: { storage: admissionStorage, waitUntil }, env, native, verifyBearer });
env.FORGE_ADMISSION = { getByName(name) { if (name !== GLOBAL_NAME) throw Error('unknown admission namespace'); return admission; } };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  try {
    if (closing || req.headers.host !== new URL(origin).host || req.headers.origin && req.headers.origin !== origin) { res.writeHead(403).end(); return; }
    const url = new URL(req.url, origin);
    if (url.pathname === '/fixture-config.json' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ userId: OWNER, accessToken: BEARER, fixtureOnly: true })); return;
    }
    if (url.pathname === '/__fixture/health' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ fixtureOnly: true, ready: true })); return; }
    if (url.pathname === '/__fixture/evidence' && req.method === 'GET') {
      if (req.headers.authorization !== 'Bearer ' + BEARER) { res.writeHead(401).end(); return; }
      const evidence = { fixtureOnly: true, provider: 'local-child-process', account: 'synthetic-no-Supabase-user', storage: 'in-memory-not-Durable-Objects', nativeSourceSha256: SOURCE_SHA, ...counters, receipts,
        leases: (await admissionStorage.get('leases') || []).length, runtimeInternetEnforcement: 'not-a-container-proof' };
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(evidence)); return;
    }
    if (url.pathname.startsWith('/api/play/')) {
      if (!['GET', 'DELETE', 'POST'].includes(req.method) || req.method !== 'GET' && req.headers.origin !== origin) { res.writeHead(403).end(); return; }
      const headers = new Headers();
      for (const key of ['authorization', 'content-type', 'idempotency-key', 'sec-fetch-site']) if (req.headers[key]) headers.set(key, req.headers[key]);
      if (req.headers.origin) headers.set('Origin', ORIGIN); // ONLY this local fixture boundary maps loopback
      const request = new Request(ORIGIN + url.pathname + url.search, { method: req.method, headers, ...(['POST'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}) });
      const response = await routeHostRequest(request, env, verifyBearer);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const chunk of Readable.fromWeb(response.body)) res.write(chunk);
      res.end(); return;
    }
    if (!['GET', 'HEAD'].includes(req.method) || url.pathname.split('/').some(piece => piece.startsWith('.'))) { res.writeHead(404).end(); return; }
    const decoded = decodeURIComponent(url.pathname), target = await realpath(path.join(uiRoot, decoded === '/' ? 'index.html' : decoded));
    if (!target.startsWith(uiRoot + path.sep) || !(await stat(target)).isFile() || !mime[path.extname(target)]) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)], 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(target));
  } catch { if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"error":"fixture_request_failed"}'); }
});
await new Promise(resolve => server.listen(requestedPort, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
const alarmTimer = setInterval(() => {
  for (const { storage, service } of [{ storage: admissionStorage, service: admission }, ...entries.values()]) {
    if (storage.alarmAt <= Date.now() && !storage.alarming) { storage.alarmAt = Infinity; storage.alarming = true; waitUntil(service.alarm().catch(() => {}).finally(() => { storage.alarming = false; })); }
  }
}, 250);
async function shutdown() {
  if (closing) return; closing = true; clearInterval(alarmTimer); clearTimeout(lifetimeTimer); server.close(); server.closeAllConnections();
  let confirmed = true;
  for (const { container } of entries.values()) { try { await container.destroy(); } catch { confirmed = false; } }
  if (confirmed) await rm(privateRoot, { recursive: true, force: true });
  console.log(JSON.stringify({ event: 'fixture-stopped', confirmed, privateInputRemoved: confirmed, ...counters }));
  process.exitCode = confirmed ? 0 : 2;
}
const lifetimeTimer = setTimeout(shutdown, Math.max(1, deadline - Date.now()));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, shutdown);
console.log(JSON.stringify({ event: 'fixture-ready', fixtureOnly: true, origin, syntheticOwnerId: OWNER, syntheticBearer: BEARER, expiresAt: deadline, nativeSourceSha256: SOURCE_SHA }));
