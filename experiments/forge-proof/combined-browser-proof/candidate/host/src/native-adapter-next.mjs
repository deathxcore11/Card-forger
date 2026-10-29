// Explicit NEXT CPU/rules image path. Does not replace frozen Default transport.
import { nativeAdapter as existingTransport } from './native-adapter.mjs';
import { boundedJSON, digest, FORGE_REVISION, NATIVE_SCHEMA } from './policy.mjs';
import { selectedPolicy, validateReleasePolicy, verifyPolicyReceipt } from './release-policy.mjs';
export function nativeAdapter(env, { now = Date.now } = {}) {
  let release = null;
  try {
    if (typeof env.FORGE_RELEASE_POLICY_JSON === 'string' && env.FORGE_RELEASE_POLICY_JSON.length <= 16384) release = JSON.parse(env.FORGE_RELEASE_POLICY_JSON);
  } catch { /* missing/malformed operator-owned release configuration fails shut */ }
  const configuredImage = env.FORGE_CONTAINER_IMAGE;
  const transport = existingTransport(env); // reuse only unchanged private bootstrap transport
  return {
    get ready() { try { validateReleasePolicy(release, configuredImage, now()); return true; } catch { return false; } },
    // Pure policy preflight: reject unsupported versions before reserving or
    // charging scarce trial resources. Native exact-deck validation still owns
    // legality/support and remains mandatory in the allocated JVM.
    validateAdmissionInput(input) {
      selectedPolicy(input?.difficultyPolicyVersion);
      for (const seat of Array.isArray(input?.extraOpponents) ? input.extraOpponents : []) selectedPolicy(seat?.difficultyPolicyVersion);
    },
    async startOptions(options) {
      validateReleasePolicy(release, configuredImage, now()); selectedPolicy(options.input?.difficultyPolicyVersion);
      return transport.startOptions(options);
    },
    bootstrapExisting: transport.bootstrapExisting,
    readStartupFailure: transport.readStartupFailure,
    async confirmInitialization({ allocation, input, epoch, internalToken, fetchExisting }) {
      validateReleasePolicy(release, configuredImage, now()); selectedPolicy(input?.difficultyPolicyVersion);
      const response = await fetchExisting(new Request('http://host001.internal/state', {
        headers: { Authorization: 'Bearer ' + internalToken, 'Content-Type': 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(5000),
      }));
      if (response.status !== 200 || response.headers.get('X-Host-Epoch') !== epoch) throw Error('initialization_epoch_mismatch');
      if (response.headers.get('X-Host-Native-Source-SHA256') !== release.nativeSourceSha256
        || response.headers.get('X-Host-Native-Manifest-SHA256') !== release.nativeManifestSha256) throw Error('initialization_image_identity_mismatch');
      const state = await boundedJSON(response, 4 * 1024 * 1024, AbortSignal.timeout(5000));
      const receipt = state.initialization;
      if (state.schema !== NATIVE_SCHEMA || state.forgeRevision !== FORGE_REVISION || !['running', 'finished'].includes(state.status)
        || receipt?.schema !== 'cardstashy.forge-exact-initialization.v1' || receipt.engineRevision !== FORGE_REVISION
        || receipt.supported !== true || receipt.legal !== true || receipt.registeredRosterVerified !== true || receipt.nativeRosterVerified !== true
        || !Number.isSafeInteger(receipt.viewerId) || receipt.viewerId < 0 || receipt.viewerId !== state.viewer
        || receipt.requestDigest !== allocation.requestDigest || receipt.requestDigest !== await digest(input)
        || receipt.humanDigest !== allocation.deckDigests.human || receipt.opponentDigest !== allocation.deckDigests.opponent
        || !/^[a-f0-9]{64}$/.test(receipt.humanRosterDigest || '') || !/^[a-f0-9]{64}$/.test(receipt.opponentRosterDigest || '')
        || !Array.isArray(receipt.errors) || receipt.errors.length !== 0) throw Error('native_exact_validation_rejected');
      verifyPolicyReceipt(receipt, input, release, configuredImage, now());
      return { ...receipt, schema: NATIVE_SCHEMA }; // existing MatchService strips initialization before browser projection
    },
  };
}
