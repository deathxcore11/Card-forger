// LOCAL_TEST_NOT_DEPLOYABLE. Synthetic account/storage, actual reviewed host,
// same-image offline Docker provider, bootstrap/gateway/Forge. Not Cloudflare.
import http from 'node:http';
import {lifecycleEvidence} from './lifecycle-contract.mjs';
import { FixtureObservationCache } from './observation.mjs';
import { FixtureReceiptCache } from './receipt-observation.mjs';
import { MemoryStorage } from './fixture-storage.mjs';
import {loadEvidenceBundle} from './image-stages/load-evidence.mjs';
import {createDockerContainer} from './local-oci/docker-provider.mjs';
import {createLocalNativeAdapter} from './local-oci/local-native-adapter.mjs';
import { mkdtemp, mkdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OWNER = '00000000-0000-4000-8000-000000000001';
const BEARER = 'forge-browser-fixture-owner'; // synthetic test credential ONLY
const observations = new FixtureObservationCache({ bearer: BEARER });
const actionReceipts = new FixtureReceiptCache({ bearer: BEARER, viewerObservations: observations });
const SOURCE_SHA='7ffed6c3cf97a99bdf24579f4ac5f4950df173bd277aa76cbe35ca6da25819b2';
const HOST_MANIFEST_SHA='f9dbf9bfed380a02db8c600fecb620ed7a7fd1aa0ffec70c8e5f4a311558f93b';
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!/^--[a-z-]+$/.test(process.argv[i]) || !process.argv[i + 1]) throw Error('named fixture arguments required');
  args[process.argv[i].slice(2)] = process.argv[i + 1];
}
for (const key of ['ui-root','service-root','host-inventory','evidence-bundle','allocations','private-parent']) if(!args[key])throw Error('missing --'+key);
const [uiRoot,serviceRoot,hostInventory,bundlePath]=await Promise.all(['ui-root','service-root','host-inventory','evidence-bundle'].map(k=>realpath(args[k])));
const inventoryBytes=await readFile(hostInventory);if(createHash('sha256').update(inventoryBytes).digest('hex')!==HOST_MANIFEST_SHA)throw Error('Unreviewed host inventory');
for(const [rel,sha]of Object.entries(JSON.parse(inventoryBytes))){if(rel.startsWith('/')||rel.split('/').includes('..'))throw Error('Unsafe host inventory');const file=await realpath(path.join(serviceRoot,rel));if(!file.startsWith(serviceRoot+path.sep)||createHash('sha256').update(await readFile(file)).digest('hex')!==sha)throw Error('Host input changed');}
const {identity,policy,sourceIdentity}=await loadEvidenceBundle(bundlePath,{serviceRoot});
if(sourceIdentity.nativeSourceSHA256!==SOURCE_SHA||sourceIdentity.forgeRevision!=='e5a0f8156da70ffc7866f923bed371c0111707cd'||sourceIdentity.difficultyPolicyVersion!=='forge-heuristic-medium-beta-v1')throw Error('Actual image source/policy mismatch');
const lifetime=Number(args['lifetime-ms']||875000),requestedPort=Number(args.port||0),maxAllocations=Number(args.allocations);
if(!Number.isSafeInteger(lifetime)||lifetime<120000||lifetime>875000||!Number.isSafeInteger(requestedPort)||requestedPort<0||requestedPort>65535||![1,2].includes(maxAllocations))throw Error('invalid bounded Docker fixture settings');
const { AdmissionService, MatchService, routeHostRequest, ORIGIN, GLOBAL_NAME } = await import(pathToFileURL(path.join(serviceRoot, 'src/service-core.mjs')));

const { accountVerifier } = await import(pathToFileURL(path.join(serviceRoot, 'src/auth.mjs')));
const { abortable } = await import(pathToFileURL(path.join(serviceRoot, 'src/policy.mjs')));
const privateParent=await realpath(args['private-parent']);const privateRoot=await mkdtemp(path.join(privateParent,'forge-browser-provider-fixture-'));

const work = new Set(), entries = new Map(), receipts = [], counters = { starts: 0, destroys: 0, nativeActions: {} };
const waitUntil = promise => { work.add(promise); promise.finally(() => work.delete(promise)).catch(() => {}); };
const deadline = Date.now() + lifetime;
let origin, closing = false;
const verifyBearer = accountVerifier({}, async (url, options) => {
  if (new URL(url).pathname !== '/auth/v1/user' || options.headers.Authorization !== 'Bearer ' + BEARER) return Response.json({ error: 'fixture_auth_required' }, { status: 401 });
  return Response.json({ id: OWNER, is_anonymous: false });
});
const native=createLocalNativeAdapter({identity,policy,serviceRoot,localTestScope:'LOCAL_TEST_NOT_DEPLOYABLE'});
const confirm = native.confirmInitialization;
native.confirmInitialization = async options => {
  const result = await confirm(options);
  receipts.push({ matchId: options.allocation.matchId, requestDigest: result.requestDigest, humanDigest: result.humanDigest,
    opponentDigest: result.opponentDigest, registeredRosterVerified: result.registeredRosterVerified, nativeRosterVerified: result.nativeRosterVerified,
    viewerId: result.viewerId, policyVersion: result.policyVersion, readyAfterMs: Date.now() - options.allocation.createdAt });
  return result;
};
const env = { FORGE_TRIAL_ENABLED: 'true', FORGE_TRIAL_OWNER_IDS: OWNER,
  FORGE_TRIAL_EXPIRES_AT:new Date(deadline).toISOString(),FORGE_TRIAL_MATCH_MS:String(lifetime),
  FORGE_TRIAL_RUNTIME_BUDGET_MS:String(maxAllocations*(lifetime+7000)),FORGE_TRIAL_MAX_RESERVATIONS:String(maxAllocations) };
function makeContainer(id){if(closing)throw Error('Fixture closing');const c=createDockerContainer({identity,privateRoot,counters,id}),start=c.start.bind(c);c.start=options=>{if(closing)throw Error('Fixture closing');return start(options);};return c;}

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
    if (url.pathname.startsWith('/__fixture/receipts')) {
      const observed = actionReceipts.observe({ method: req.method, url, headers: req.headers });
      res.writeHead(observed.status, observed.headers).end(JSON.stringify(observed.body)); return;
    }
    if (url.pathname.startsWith('/__fixture/observe')) {
      const observed = observations.observe({ method: req.method, url, headers: req.headers });
      res.writeHead(observed.status, observed.headers).end(JSON.stringify(observed.body)); return;
    }
    if (url.pathname === '/fixture-config.json' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({userId:OWNER,accessToken:BEARER,fixtureOnly:true,scope:'LOCAL_TEST_NOT_DEPLOYABLE',sourceIdentity})); return;
    }
    if (url.pathname === '/__fixture/health' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ fixtureOnly: true, ready: true })); return; }
    if (url.pathname === '/__fixture/evidence' && req.method === 'GET') {
      if (req.headers.authorization !== 'Bearer ' + BEARER) { res.writeHead(401).end(); return; }
      const evidence = { fixtureOnly: true, provider:'same-image-offline-docker-local-test', account: 'synthetic-no-Supabase-user', storage: 'in-memory-not-Durable-Objects', nativeSourceSha256: SOURCE_SHA, ...counters, receipts, lifecycle:lifecycleEvidence([...entries.values()].map(e=>e.container),{imageId:identity.dockerImageId,expected:maxAllocations}),
        leases: (await admissionStorage.get('leases') || []).length, runtimeInternetEnforcement:'docker-network-none-exec-loopback-relay',scope:'LOCAL_TEST_NOT_DEPLOYABLE' };
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(evidence)); return;
    }
    if (url.pathname.startsWith('/api/play/')) {
      if (!['GET', 'DELETE', 'POST'].includes(req.method) || req.method !== 'GET' && req.headers.origin !== origin) { res.writeHead(403).end(); return; }
      const headers = new Headers();
      for (const key of ['authorization', 'content-type', 'idempotency-key', 'sec-fetch-site']) if (req.headers[key]) headers.set(key, req.headers[key]);
      if (req.headers.origin) headers.set('Origin', ORIGIN); // ONLY this local fixture boundary maps loopback
      const request = new Request(ORIGIN + url.pathname + url.search, { method: req.method, headers, ...(['POST'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}) });
      const response = await routeHostRequest(request, env, verifyBearer);
      const delivered = observations.capture({ method: req.method, url, headers: req.headers, httpStatus: response.status, response: res });
      const deliveredReceipt = actionReceipts.capture({ method: req.method, url, headers: req.headers, httpStatus: response.status, response: res });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const chunk of Readable.fromWeb(response.body)) { res.write(chunk); delivered.chunk(chunk); deliveredReceipt.chunk(chunk); }
      delivered.complete();
      deliveredReceipt.complete();
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
  const lifecycle=lifecycleEvidence([...entries.values()].map(e=>e.container),{imageId:identity.dockerImageId,expected:maxAllocations});
  confirmed=confirmed&&lifecycle.confirmed;
  if(confirmed){await rm(privateRoot,{recursive:true,force:true});try{await stat(privateRoot);confirmed=false;}catch(e){if(e.code!=='ENOENT')confirmed=false;}}
  await Promise.race([Promise.allSettled([...work]),new Promise(resolve=>setTimeout(resolve,1000))]);
  console.log(JSON.stringify({event:'fixture-stopped',confirmed,privateInputRemoved:confirmed,...counters,lifecycle}));
  // New starts are fenced, recorded native containers are gone, and listener is
  // closed. Do not leave stale local admission polling timers alive after exit.
  process.exit(confirmed?0:2);
}
const lifetimeTimer = setTimeout(shutdown, Math.max(1, deadline - Date.now()));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, shutdown);
console.log(JSON.stringify({ event: 'fixture-ready', fixtureOnly: true, origin, syntheticOwnerId: OWNER, expiresAt: deadline, nativeSourceSha256: SOURCE_SHA }));
