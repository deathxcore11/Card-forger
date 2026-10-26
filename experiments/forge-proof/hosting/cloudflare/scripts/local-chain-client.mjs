// Called only by local-chain.py. Every request goes to its loopback HTTP server.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { nativeAdapter } from '../src/native-adapter.mjs';
import { digest, GatewayDriver } from '../src/policy.mjs';
const [baseURL, inputFile] = process.argv.slice(2);
const input = JSON.parse(readFileSync(inputFile, 'utf8')).input;
const internalToken = 'synthetic-local-chain-capability-not-a-persistent-secret';
const fetchExisting = request => {
  const url = new URL(request.url); const target = new URL(url.pathname, baseURL);
  assert.equal(target.hostname, '127.0.0.1');
  return fetch(new Request(target, request));
};
const native = nativeAdapter({});
const allocation = { requestDigest: await digest(input), deckDigests: { human: await digest(input.humanDeck), opponent: await digest(input.opponentDeck) }, expiresAt: Date.now() + 180000 };
const deadline = Date.now() + 120000;
await native.bootstrapExisting({ input, allocation, internalToken, fetchExisting, deadline, now: Date.now, wait: ms => new Promise(r => setTimeout(r, ms)) });
let epoch;
while (Date.now() < deadline) {
  try {
    const response = await fetchExisting(new Request('http://host001.internal/ready', { headers: { Authorization: 'Bearer ' + internalToken }, signal: AbortSignal.timeout(5000) }));
    const status = response.status; epoch = response.headers.get('X-Host-Epoch'); await response.body?.cancel();
    if (status === 200 && epoch) break;
    if (epoch) { const failed = await native.readStartupFailure({ epoch, internalToken, fetchExisting }); if (failed) throw Object.assign(new Error('actual_native_validation_failed:' + JSON.stringify(failed)), { fatal: true }); }
  } catch (e) { if (e.fatal) throw e; }
  await new Promise(r => setTimeout(r, 100));
}
assert(epoch, 'real gateway readiness timeout');
const receipt = await native.confirmInitialization({ allocation, input, epoch, internalToken, fetchExisting });
const driver = new GatewayDriver({ internalToken, fetchExisting, isRunning: async () => true, stopExisting: async () => ({ confirmed: false }) });
let { snapshot } = await driver.readExisting({ expectedEpoch: epoch });
assert.equal(snapshot.viewer, receipt.viewerId);
for (const player of snapshot.players || []) if (!player.isViewer) for (const zone of ['Hand', 'Library']) assert.equal(player.zones[zone].cards.length, 0);
assert.equal((await driver.submitExisting({ revision: -1, op: 'controlMode', value: 'full' }, { expectedEpoch: epoch })).status, 409);
assert.equal((await driver.submitExisting({ revision: snapshot.revision, op: 'controlMode', value: 'arbitrary' }, { expectedEpoch: epoch })).status, 400);
if (snapshot.prompt || snapshot.busy) assert.equal((await driver.submitExisting({ revision: snapshot.revision, op: 'controlMode', value: 'full' }, { expectedEpoch: epoch })).status, 409);
let nativeAction = 'not_available';
const prompt = snapshot.prompt;
if (prompt?.supported && ['getChoices', 'showOptionDialog'].includes(prompt.method)) {
  const indexes = prompt.options.slice(0, prompt.min).map(option => option.index);
  const action = { revision: snapshot.revision, op: 'reply', promptId: prompt.id, indexes };
  assert.equal((await driver.submitExisting(action, { expectedEpoch: epoch })).status, 202);
  assert.equal((await driver.submitExisting(action, { expectedEpoch: epoch })).status, 409);
  nativeAction = 'real_engine_offered_startup_reply_accepted_duplicate_rejected';
}
console.log(JSON.stringify({ result: 'PASS', chain: 'actual bootstrap HTTP -> private exact input file -> exact Java JVM -> actual Python gateway -> real host nativeAdapter + GatewayDriver', schema: receipt.schema, policy: receipt.policyVersion, viewerId: receipt.viewerId, sourceDigestsMatch: true, registeredRosterVerified: receipt.registeredRosterVerified, nativeRosterVerified: receipt.nativeRosterVerified, nativeAction, nativeControlModeGuards: 'stale409/invalid400/busy409', note: 'Temporary local path/port substitutions; not Docker or Cloudflare runtime proof.' }));
