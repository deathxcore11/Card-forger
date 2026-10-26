# Strict three-policy native CPU integration — local descendant, not deployment

Parent is the combined0334 candidate (exact existing snapshots, Commander/Standard/Modern, dated rules, native concession, native highlights). All those capabilities remain. This descendant applies the separately independently reviewed four-patch AI candidate, not an unmodified stock-AI claim.

Only these policy versions are accepted:
- `forge-heuristic-easy-beta-v1` → `CardStashyEasyBetaV1`
- `forge-heuristic-medium-beta-v1` → `CardStashyMediumBetaV1`
- `forge-heuristic-hard-beta-v1` → `CardStashyHardBetaV1`

Unknown, omitted, unversioned and legacy `forge-default-smart-v1` values reject. No implicit Medium/Default mapping. Existing deck snapshots do not change; the caller explicitly changes only the requested policy version. The preserved0334 image remains the separate explicit Default baseline. No runtime policy switching is provided; select a policy before a new match.

## Native startup and receipt
After FModel initializes but before any Match exists, install the three profiles once into the instance's writable adapter/cpu-profiles directory. Validate the pinned Default bytes, expected generated profile hashes, real loaded native class bytes and actual build attestation. Create the AI lobby with the exact named profile; configure native rules before shuffle; apply and assert effective policy settings before startGame. Exactly one CPU is required. No life totals/decks/rules are weakened to create a difficulty.

`initialization` retains exact source/roster/rules digests and adds `cpuPolicyRuntimeVerified`. Its `policyVersion` and `aiProfile` must match the selected exact pair. `cpuPolicy` reports profile hash, base Forge revision, `nativeAiModified:true`, AI patchset version/hash, reviewed class-set hash, actual build-attestation hash/compiler version, runtime bytecode/settings flags, MC/legacy-off state and bounded experimental calibration. `admissionAllowed:true` is set by this integration only after real runtime settings verification; the frozen policy research helper itself remains unchanged. This is **not** an assertion that external process cancellation or universal AI fairness/strength is certified. `strictServiceLatencyProven:false` remains explicit.

Monte Carlo, max/attack-MC, full/hybrid simulation, cheat shuffle and filtered hands are off. All three share survival/public-information guards; propensity and unused-land timing differ. These are experimental novice/normal/challenging intentions, not a universal monotonic win-rate guarantee. Review/probe evidence is in the separate frozen `cpu-policy-work/heuristic-beta-candidate` (manifest baf9314ae74c0acfb070a7790042515578844febbcb75162f2175aa2fc883d81).

## Build / exact artifact attestation
AI patch SHA256: `cd14c95185c4bfd44e90a809a6095f2027f23d102c1cf04464533ca545a0a4b1`.
Reviewed12-class-set index SHA256: `e39ea6388050f31319b121c0605fde23069d35e7133a203fd19f0a6c72528f80`.

`build-ai-overlay.sh` reads a clean, exact pinned Forge checkout, copies only affected source paths into cpu/native-source, applies the exact patch locally, and compiles with the **actual selected build JDK** using the reviewed plain-javac options. It checks all12 output hashes against the reviewed set, then independently verifies actual classpath resources. It never regenerates the expected hashes to excuse a compiler mismatch. Any difference fails the build and requires a newly reviewed artifact attestation. It records real javac/java versions and generated artifact hashes in cpu/build-attestation.json. The original Forge tree remains unchanged; patched corresponding GPL source is retained in the built image.

The local tested compiler is Temurin21.0.13+9-LTS. This does not claim a Docker build-JDK run occurred. The hosting build must execute the same gate with its pinned BUILD_IMAGE JDK; matching tags or local success are insufficient. Build invocation after native Maven compilation:

```
FORGE_SOURCE=/opt/forge-proof/forge \
FORGE_BASE_CP="$CP" FORGE_JAVA_HOME="$JAVA_HOME" \
  bash /opt/forge-proof/build-ai-overlay.sh
CP="/opt/forge-proof/cpu/runtime-classes:$CP"
# Compile all adapter/src/cardstashy/forge/*.java using this CP.
```

Distribute the patch/index/build script with the candidate. Build-generated native-source/runtime-classes/check-classes/build-attestation are created in the fresh image build, not assumed portable from the local worktree. Keep the generated source and attestation in the resulting image. Runtime classpath must put cpu/runtime-classes before unmodified Forge module classes. Runtime root needs read-only `cpu` and `rules-data` links to immutable image assets, plus writable adapter/home directories.

`run-bridge.sh` uses an explicit `FORGE_MATCH_INPUT` trusted file, or (local alias proof only) an explicit `FORGE_CPU_POLICY`. There is no browser filesystem path.

## Host acceptance delta
Keep exact identity/count/commander, format/current-rules, source/roster digests and both roster flags. Replace Default-only profile checking with the strict policy→profile→profileHash mapping. Require cpuPolicyRuntimeVerified, runtimeBytecodeVerified/runtimeSettingsVerified, correct patch/class-set hashes, modified-AI flag, and MC/legacy false. Bind expected build-attestation hash to the reviewed immutable image. Host authentication/capacity, lifetime/CPU/memory limits, cancellation, confirmed cleanup and cost accounting remain external mandatory gates, not a Java receipt claim.

## Executed / remaining
Real JVM startup passes all three policies with unchanged deck snapshots and current rules. Unknown/legacy policy, absent native overlay and tampered build attestation reject before Match creation. A real Medium-beta human-controller HTTP game reached native terminal turn30, CPU winner1,319steps; exact Standard and Modern initializations retain60main+1side,20life and current-rules/roster checks. Hard-beta concession during actual opponent active/priority busy InputLockUI reached native terminal. An earlier Hard pregame-busy case is explicitly labeled as such, not misrepresented as a CPU-turn test. Native transport/Smart/terminal contracts also pass. Test wrapper fixtures explicitly select Medium; their underlying human/opponent deck snapshots remain unchanged, and the retired Default wrapper is retained as a negative fixture. No browser/public deployment/paid build is performed by this local candidate.
