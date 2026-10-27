// NEXT CANDIDATE ONLY. Server-owned image contract; never accept from a browser.
export const ENGINE_REVISION = 'e5a0f8156da70ffc7866f923bed371c0111707cd';
export const AI_PATCHSET_VERSION = 'cardstashy-forge-observation-survival-land-v2-review';
export const AI_PATCHSET_SHA256 = 'cd14c95185c4bfd44e90a809a6095f2027f23d102c1cf04464533ca545a0a4b1';
export const AI_CLASS_SET_SHA256 = 'e39ea6388050f31319b121c0605fde23069d35e7133a203fd19f0a6c72528f80';
export const CPU_POLICIES = Object.freeze({
  'forge-heuristic-easy-beta-v1': Object.freeze({ profile: 'CardStashyEasyBetaV1', profileSha256: '7586f8cf57f7d454b4ef5ed46a5b7fec609429b516b4ddde31c8178246737c75' }),
  'forge-heuristic-medium-beta-v1': Object.freeze({ profile: 'CardStashyMediumBetaV1', profileSha256: 'd77ec318868fcdb8fe1dce8d8c2df336fe26d54e13b51f7aab13d259bdf70330' }),
  'forge-heuristic-hard-beta-v1': Object.freeze({ profile: 'CardStashyHardBetaV1', profileSha256: '44aa0e6e3483c05874948813e3f3449a5cde4869885ef5e55cdee509e2891bf6' }),
});
export const EXPECTED_RULES = Object.freeze({
  version: 'rules-20261027-scryfall20261027-native-e5a0f815',
  manifestSha256: '2b770c2d129849e534577d4ab8f3b236c21b9e2e80f2afef5c12af7c3f2c9d11',
  indexSha256: '1903d046e5f6b98b3393c522e933144413f17cb8bfbbb8b90fe3616de74758fb',
  sourceSha256: '6b60448af57f8d8ae01c16f5896749fd61153e2c25df89cdc40866c18c077c3c',
  sourceUpdatedAt: '2026-10-27T09:02:27.916+00:00', asOfDate: '2026-10-27', validUntilExclusive: '2026-11-03',
});
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) && !/^0+$/.test(value);
const fail = code => { throw Error(code); };
export function selectedPolicy(version) {
  if (typeof version !== 'string' || !Object.hasOwn(CPU_POLICIES, version)) fail('unsupported_explicit_cpu_policy');
  return CPU_POLICIES[version];
}
export function validateReleasePolicy(release, configuredImage, now = Date.now()) {
  if (!release || release.schema !== 'cardstashy.forge-release-policy.v1' || release.engineRevision !== ENGINE_REVISION
    || typeof release.containerImage !== 'string' || !/^registry\.cloudflare\.com\/[A-Za-z0-9_/-]+@sha256:[a-f0-9]{64}$/.test(release.containerImage)
    || !sha(release.containerImage.split('@sha256:')[1]) || release.containerImage !== configuredImage
    || !sha(release.nativeManifestSha256) || !sha(release.nativeSourceSha256)
    || !sha(release.nativeBuildAttestationSha256) || !/^javac 21\.[0-9]+\.[0-9]+(?:\S*)?$/.test(release.buildCompilerVersion || '')
    || typeof release.runtimeJavaVersion !== 'string' || !/^21\./.test(release.runtimeJavaVersion) || release.runtimeJavaVersion.length > 128
    || release.aiPatchsetSha256 !== AI_PATCHSET_SHA256 || release.runtimeClassSetSha256 !== AI_CLASS_SET_SHA256) fail('unbound_native_image_policy');
  for (const [key, expected] of Object.entries(EXPECTED_RULES)) if (release.rulesData?.[key] !== expected) fail('unbound_rules_data_policy');
  if (!Number.isSafeInteger(now) || now < Date.parse(EXPECTED_RULES.asOfDate + 'T00:00:00Z')
    || now >= Date.parse(EXPECTED_RULES.validUntilExclusive + 'T00:00:00Z')) fail('rules_data_policy_not_current');
  return release;
}
export function verifyPolicyReceipt(receipt, input, release, configuredImage, now = Date.now()) {
  validateReleasePolicy(release, configuredImage, now);
  const policy = selectedPolicy(input?.difficultyPolicyVersion), cpu = receipt?.cpuPolicy, rules = receipt?.rulesData;
  if (receipt.policyVersion !== input.difficultyPolicyVersion || receipt.aiProfile !== policy.profile || receipt.controlMode !== 'smart'
    || receipt.cpuPolicyRuntimeVerified !== true || receipt.nativeLegal !== true || !cpu
    || cpu.difficultyPolicyVersion !== input.difficultyPolicyVersion || cpu.aiProfile !== policy.profile || cpu.profileSha256 !== policy.profileSha256
    || cpu.controlMode !== 'smart' || cpu.forgeCommit !== ENGINE_REVISION || cpu.aiPatchsetVersion !== AI_PATCHSET_VERSION
    || cpu.aiPatchsetSha256 !== AI_PATCHSET_SHA256 || cpu.runtimeClassSetSha256 !== AI_CLASS_SET_SHA256
    || cpu.nativeBuildAttestationSha256 !== release.nativeBuildAttestationSha256 || cpu.buildCompilerVersion !== release.buildCompilerVersion
    || cpu.runtimeJavaVersion !== release.runtimeJavaVersion || cpu.runtimeBytecodeVerified !== true || cpu.runtimeSettingsVerified !== true
    || cpu.admissionAllowed !== true || cpu.admissionScope !== 'bounded-experimental-native-integration'
    || cpu.nativeAiModified !== true || cpu.monteCarlo !== false || cpu.legacySimulation !== false
    || cpu.strictServiceLatencyProven !== false || cpu.nativePriorityTimeoutSeconds !== 5
    || cpu.opponentDeckKnowledge !== 'secret-current-lawful-observations-only'
    || cpu.calibration !== 'experimental-bounded-tactical-corpus-not-universal-strength-ranking') fail('native_cpu_policy_receipt_mismatch');
  if (!rules || rules.schema !== 'cardstashy.rules-data-receipt.v1' || rules.mode !== 'current'
    || rules.engineRevision !== ENGINE_REVISION || rules.decksVerified !== true) fail('native_rules_data_receipt_mismatch');
  for (const [key, expected] of Object.entries(EXPECTED_RULES)) if (rules[key] !== expected) fail('native_rules_data_receipt_mismatch');
  return policy;
}
