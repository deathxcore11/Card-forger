// Checks actual JVM-generated artifacts against host code. Only the private HTTP
// envelope/epoch is a fixture; no deck or initialization receipt is fabricated.
import { readFileSync } from 'node:fs';
import { nativeAdapter } from '../src/native-adapter.mjs';
import { digest } from '../src/policy.mjs';
const [inputPath, statePath] = process.argv.slice(2);
if (!inputPath || !statePath) throw new Error('Usage: node scripts/verify-native-receipt.mjs BOOTSTRAP_JSON NATIVE_STATE_JSON');
const { input } = JSON.parse(readFileSync(inputPath, 'utf8'));
const state = JSON.parse(readFileSync(statePath, 'utf8'));
const epoch = '00000000-0000-4000-8000-000000000004';
const allocation = { requestDigest: await digest(input), deckDigests: { human: await digest(input.humanDeck), opponent: await digest(input.opponentDeck) } };
const receipt = await nativeAdapter({}).confirmInitialization({ allocation, input, epoch, internalToken: 'fixture-transport-only-no-real-credential', fetchExisting: async request => {
  if (new URL(request.url).pathname !== '/state') throw new Error('unexpected_private_route');
  return Response.json(state, { headers: { 'X-Host-Epoch': epoch } });
} });
console.log(JSON.stringify({ result: 'PASS', proof: 'Actual JVM state/input accepted by real host nativeAdapter; HTTP envelope only is fixture', policyVersion: receipt.policyVersion, viewerId: receipt.viewerId, requestDigest: receipt.requestDigest, humanDigest: receipt.humanDigest, opponentDigest: receipt.opponentDigest, registeredRosterVerified: receipt.registeredRosterVerified, nativeRosterVerified: receipt.nativeRosterVerified }));
