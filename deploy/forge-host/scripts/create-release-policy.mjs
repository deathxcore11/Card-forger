// Local packaging only. Bind actual tested image output; never configure/deploy.
import { readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ENGINE_REVISION, AI_PATCHSET_SHA256, AI_CLASS_SET_SHA256, EXPECTED_RULES, validateReleasePolicy, verifyPolicyReceipt } from '../src/release-policy.mjs';
const args = {};
if ((process.argv.length - 2) % 2) throw Error('Named key/value arguments required');
for (let i = 2; i < process.argv.length; i += 2) {
  if (!process.argv[i].startsWith('--') || Object.hasOwn(args, process.argv[i])) throw Error('Invalid or repeated release argument');
  args[process.argv[i]] = process.argv[i + 1];
}
for (const key of ['--image', '--native-manifest-sha256', '--native-root', '--build-attestation', '--runtime-index', '--runtime-receipt', '--out']) if (!args[key]) throw Error('Required ' + key);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
const nativeManifestPath = path.join(args['--native-root'], 'SHA256SUMS');
const nativeSourcePath = path.join(args['--native-root'], 'adapter/src/cardstashy/forge/ForgeHttpBridge.java');
if ((await lstat(nativeManifestPath)).isSymbolicLink() || (await lstat(nativeSourcePath)).isSymbolicLink()) throw Error('native_source_symlink_rejected');
const nativeManifest = await readFile(nativeManifestPath), nativeSource = await readFile(nativeSourcePath);
if (sha(nativeManifest) !== args['--native-manifest-sha256']) throw Error('reviewed_native_manifest_mismatch');
const sourceEntry = nativeManifest.toString().split('\n').map(line => /^([a-f0-9]{64})\s+(?:\.\/)?(.+)$/.exec(line)).find(entry => entry?.[2] === 'adapter/src/cardstashy/forge/ForgeHttpBridge.java');
if (!sourceEntry || sourceEntry[1] !== sha(nativeSource)) throw Error('reviewed_native_source_mismatch');
const artifactBytes = await readFile(args['--build-attestation']), indexBytes = await readFile(args['--runtime-index']);
const artifact = JSON.parse(artifactBytes), classes = JSON.parse(indexBytes);
const document = JSON.parse(await readFile(args['--runtime-receipt'], 'utf8')), receipt = document.initialization ?? document;
if (artifact.schema !== 'cardstashy.native-ai-build-attestation.v1' || artifact.forgeRevision !== ENGINE_REVISION
  || artifact.classSetSha256 !== AI_CLASS_SET_SHA256 || sha(indexBytes) !== AI_CLASS_SET_SHA256
  || artifact.classCount !== 12 || Object.keys(classes).length !== 12 || canonical(artifact.classes) !== canonical(classes)
  || artifact.actualCompilerBytecodeMatchesReviewed !== true || artifact.differentCompilerHashFallbackAllowed !== false) throw Error('unverified_actual_image_build_attestation');
const release = { schema: 'cardstashy.forge-release-policy.v1', containerImage: args['--image'], engineRevision: ENGINE_REVISION,
  nativeManifestSha256: args['--native-manifest-sha256'], nativeSourceSha256: sha(nativeSource),
  aiPatchsetSha256: AI_PATCHSET_SHA256, runtimeClassSetSha256: AI_CLASS_SET_SHA256,
  nativeBuildAttestationSha256: sha(artifactBytes), buildCompilerVersion: artifact.javacVersion,
  runtimeJavaVersion: receipt.cpuPolicy?.runtimeJavaVersion, rulesData: EXPECTED_RULES };
validateReleasePolicy(release, release.containerImage);
verifyPolicyReceipt(receipt, { difficultyPolicyVersion: receipt.policyVersion }, release, release.containerImage);
await writeFile(args['--out'], JSON.stringify(release, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ created: true, releasePolicySha256: sha(JSON.stringify(release, null, 2) + '\n'), containerImage: release.containerImage,
  deploymentPerformed: false, imageProofScope: 'metadata binding only; operator must separately review actual same-image runtime proof and registry digest' }));
